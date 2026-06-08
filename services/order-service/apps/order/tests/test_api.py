"""
Unit tests for Order Service API endpoints.

Tests: checkout (success, empty cart, non-customer), status transitions,
price snapshot, ownership.
"""

import uuid
from decimal import Decimal
from unittest.mock import patch

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.order.models import ORDER_TRANSITIONS, Order, OrderItem, OrderStatusHistory


@override_settings(
    DATABASES={
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": ":memory:",
        }
    },
    CART_SERVICE_URL="http://cart-service:8003",
    CATALOG_SERVICE_URL="http://catalog-service:8002",
    PAYMENT_SERVICE_URL="http://payment-service:8005",
    SHIPPING_SERVICE_URL="http://shipping-service:8006",
)
class CheckoutAPITests(TestCase):
    """Tests for POST /api/v1/orders/checkout endpoint."""

    def setUp(self):
        self.client = APIClient()
        self.url = "/api/v1/orders/checkout"
        self.user_id = str(uuid.uuid4())
        self.product_id = str(uuid.uuid4())

    def _mock_auth_customer(self, mock_jwt):
        """Helper to set customer auth."""

        def set_customer(request):
            request.user_id = self.user_id
            request.user_role = "customer"

        mock_jwt.side_effect = set_customer

    @patch("apps.core.middleware.JWTAuthenticationMiddleware._extract_jwt")
    @patch("apps.core.http_client.ServiceClient.post")
    @patch("apps.core.http_client.ServiceClient.get")
    def test_checkout_success(self, mock_get, mock_post, mock_jwt):
        """Checkout with valid cart should create order."""
        self._mock_auth_customer(mock_jwt)

        # Mock cart service GET
        mock_get.return_value = {
            "data": {
                "id": str(uuid.uuid4()),
                "user_id": self.user_id,
                "items": [
                    {
                        "product_id": self.product_id,
                        "quantity": 2,
                        "name": "Test Product",
                        "unit_price": "49.99",
                    }
                ],
                "subtotal": "99.98",
            }
        }

        # Mock catalog validate-bulk
        def mock_post_handler(url, **kwargs):
            if "validate-bulk" in url:
                return {
                    "data": [
                        {
                            "product_id": self.product_id,
                            "valid": True,
                            "name": "Test Product",
                            "sku": "TST-001",
                            "price": "49.99",
                            "stock": 100,
                            "image_url": "https://example.com/img.jpg",
                        }
                    ]
                }
            elif "payments" in url:
                return {
                    "data": {
                        "id": str(uuid.uuid4()),
                        "status": "success",
                    }
                }
            elif "shipments" in url:
                return {
                    "data": {
                        "id": str(uuid.uuid4()),
                        "tracking_code": "TS1234567890AB",
                        "status": "processing",
                    }
                }
            return {}

        mock_post.side_effect = mock_post_handler

        payload = {"shipping_address": "123 Test St, City, Country"}
        response = self.client.post(self.url, data=payload, format="json")
        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertTrue(data["success"])
        self.assertIn("id", data["data"])
        self.assertEqual(data["data"]["user_id"], self.user_id)

    @patch("apps.core.middleware.JWTAuthenticationMiddleware._extract_jwt")
    @patch("apps.core.http_client.ServiceClient.get")
    def test_checkout_empty_cart(self, mock_get, mock_jwt):
        """Checkout with empty cart should return 422."""
        self._mock_auth_customer(mock_jwt)

        mock_get.return_value = {
            "data": {
                "id": str(uuid.uuid4()),
                "user_id": self.user_id,
                "items": [],
                "subtotal": "0.00",
            }
        }

        payload = {"shipping_address": "123 Test St"}
        response = self.client.post(self.url, data=payload, format="json")
        self.assertEqual(response.status_code, 422)

    def test_checkout_unauthenticated(self):
        """Checkout without auth should return 401."""
        payload = {"shipping_address": "123 Test St"}
        response = self.client.post(self.url, data=payload, format="json")
        self.assertIn(response.status_code, [401, 403])

    @patch("apps.core.middleware.JWTAuthenticationMiddleware._extract_jwt")
    def test_checkout_non_customer_forbidden(self, mock_jwt):
        """Checkout as non-customer (staff) should return 403."""

        def set_staff(request):
            request.user_id = str(uuid.uuid4())
            request.user_role = "staff"

        mock_jwt.side_effect = set_staff

        payload = {"shipping_address": "123 Test St"}
        response = self.client.post(self.url, data=payload, format="json")
        self.assertEqual(response.status_code, 403)


@override_settings(
    DATABASES={
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": ":memory:",
        }
    },
)
class OrderStatusTransitionTests(TestCase):
    """Tests for order status transitions."""

    def setUp(self):
        self.user_id = str(uuid.uuid4())
        self.order = Order.objects.create(
            user_id=self.user_id,
            status="created",
            subtotal=Decimal("100.00"),
            shipping_fee=Decimal("0.00"),
            discount_amount=Decimal("0.00"),
            total_amount=Decimal("100.00"),
            shipping_address="123 Test St",
        )

    def test_valid_transition_created_to_payment_pending(self):
        """Order can transition from created to payment_pending."""
        allowed = ORDER_TRANSITIONS.get("created", set())
        self.assertIn("payment_pending", allowed)

    def test_valid_transition_payment_pending_to_paid(self):
        """Order can transition from payment_pending to paid."""
        allowed = ORDER_TRANSITIONS.get("payment_pending", set())
        self.assertIn("paid", allowed)

    def test_valid_transition_paid_to_shipping(self):
        """Order can transition from paid to shipping."""
        allowed = ORDER_TRANSITIONS.get("paid", set())
        self.assertIn("shipping", allowed)

    def test_valid_transition_shipping_to_completed(self):
        """Order can transition from shipping to completed."""
        allowed = ORDER_TRANSITIONS.get("shipping", set())
        self.assertIn("completed", allowed)

    def test_invalid_transition_completed_to_any(self):
        """Completed is a terminal status with no outgoing transitions."""
        allowed = ORDER_TRANSITIONS.get("completed", set())
        self.assertEqual(allowed, None if allowed is None else set())

    def test_cancel_from_created(self):
        """Order can be cancelled from created status."""
        allowed = ORDER_TRANSITIONS.get("created", set())
        self.assertIn("cancelled", allowed)

    def test_cancel_from_paid(self):
        """Order can be cancelled from paid status."""
        allowed = ORDER_TRANSITIONS.get("paid", set())
        self.assertIn("cancelled", allowed)

    def test_cannot_cancel_from_shipping(self):
        """Order cannot be cancelled from shipping status."""
        allowed = ORDER_TRANSITIONS.get("shipping", set())
        self.assertNotIn("cancelled", allowed)


@override_settings(
    DATABASES={
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": ":memory:",
        }
    },
)
class OrderPriceSnapshotTests(TestCase):
    """Tests for price snapshot in order items."""

    def setUp(self):
        self.user_id = str(uuid.uuid4())
        self.order = Order.objects.create(
            user_id=self.user_id,
            status="paid",
            subtotal=Decimal("149.97"),
            shipping_fee=Decimal("0.00"),
            discount_amount=Decimal("0.00"),
            total_amount=Decimal("149.97"),
            shipping_address="123 Test St",
        )
        self.order_item = OrderItem.objects.create(
            order=self.order,
            product_id=uuid.uuid4(),
            product_name="Snapshot Product",
            product_sku="SNAP-001",
            product_image_url="https://example.com/snap.jpg",
            unit_price=Decimal("49.99"),
            quantity=3,
            line_total=Decimal("149.97"),
        )

    def test_order_item_stores_price_snapshot(self):
        """Order item should store the price at time of order."""
        self.assertEqual(self.order_item.unit_price, Decimal("49.99"))
        self.assertEqual(self.order_item.line_total, Decimal("149.97"))

    def test_order_item_stores_product_info(self):
        """Order item should store product name, SKU, and image."""
        self.assertEqual(self.order_item.product_name, "Snapshot Product")
        self.assertEqual(self.order_item.product_sku, "SNAP-001")
        self.assertEqual(
            self.order_item.product_image_url, "https://example.com/snap.jpg"
        )

    def test_order_total_matches_items(self):
        """Order total should match sum of line totals."""
        total_from_items = sum(
            item.line_total for item in self.order.items.all()
        )
        self.assertEqual(self.order.subtotal, total_from_items)


@override_settings(
    DATABASES={
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": ":memory:",
        }
    },
)
class OrderOwnershipTests(TestCase):
    """Tests for order ownership enforcement."""

    def setUp(self):
        self.client = APIClient()
        self.owner_id = str(uuid.uuid4())
        self.other_user_id = str(uuid.uuid4())
        self.order = Order.objects.create(
            user_id=self.owner_id,
            status="paid",
            subtotal=Decimal("50.00"),
            shipping_fee=Decimal("0.00"),
            discount_amount=Decimal("0.00"),
            total_amount=Decimal("50.00"),
            shipping_address="123 Owner St",
        )

    @patch("apps.core.middleware.JWTAuthenticationMiddleware._extract_jwt")
    def test_owner_can_view_order(self, mock_jwt):
        """Order owner should be able to view their order."""

        def set_owner(request):
            request.user_id = self.owner_id
            request.user_role = "customer"

        mock_jwt.side_effect = set_owner

        response = self.client.get(f"/api/v1/orders/{self.order.id}")
        self.assertEqual(response.status_code, 200)

    @patch("apps.core.middleware.JWTAuthenticationMiddleware._extract_jwt")
    def test_other_customer_cannot_view_order(self, mock_jwt):
        """Non-owner customer should not be able to view the order."""

        def set_other(request):
            request.user_id = self.other_user_id
            request.user_role = "customer"

        mock_jwt.side_effect = set_other

        response = self.client.get(f"/api/v1/orders/{self.order.id}")
        self.assertEqual(response.status_code, 403)

    @patch("apps.core.middleware.JWTAuthenticationMiddleware._extract_jwt")
    def test_admin_can_view_any_order(self, mock_jwt):
        """Admin should be able to view any order."""

        def set_admin(request):
            request.user_id = str(uuid.uuid4())
            request.user_role = "admin"

        mock_jwt.side_effect = set_admin

        response = self.client.get(f"/api/v1/orders/{self.order.id}")
        self.assertEqual(response.status_code, 200)

    @patch("apps.core.middleware.JWTAuthenticationMiddleware._extract_jwt")
    def test_cancel_order_by_owner(self, mock_jwt):
        """Owner should be able to cancel their own order."""

        def set_owner(request):
            request.user_id = self.owner_id
            request.user_role = "customer"

        mock_jwt.side_effect = set_owner

        response = self.client.patch(
            f"/api/v1/orders/{self.order.id}/cancel",
            data={"reason": "Changed my mind"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, "cancelled")


@override_settings(
    DATABASES={
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": ":memory:",
        }
    },
)
class OrderCompletionAPITests(TestCase):
    """Tests for PATCH /api/v1/orders/{id}/complete endpoint."""

    def setUp(self):
        self.client = APIClient()
        self.customer_id = str(uuid.uuid4())
        self.order = Order.objects.create(
            user_id=self.customer_id,
            status="shipping",
            subtotal=Decimal("100.00"),
            shipping_fee=Decimal("0.00"),
            discount_amount=Decimal("0.00"),
            total_amount=Decimal("100.00"),
            shipping_address="123 Test St",
        )

    @patch("apps.core.middleware.JWTAuthenticationMiddleware._extract_jwt")
    def test_customer_can_complete_own_shipping_order(self, mock_jwt):
        def set_customer(request):
            request.user_id = self.customer_id
            request.user_role = "customer"

        mock_jwt.side_effect = set_customer

        response = self.client.patch(f"/api/v1/orders/{self.order.id}/complete")
        self.assertEqual(response.status_code, 200)
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, "completed")
        self.assertTrue(
            OrderStatusHistory.objects.filter(
                order=self.order,
                from_status="shipping",
                to_status="completed",
            ).exists()
        )

    @patch("apps.core.middleware.JWTAuthenticationMiddleware._extract_jwt")
    def test_customer_cannot_complete_other_users_order(self, mock_jwt):
        def set_customer(request):
            request.user_id = str(uuid.uuid4())
            request.user_role = "customer"

        mock_jwt.side_effect = set_customer

        response = self.client.patch(f"/api/v1/orders/{self.order.id}/complete")
        self.assertEqual(response.status_code, 403)

    @patch("apps.core.middleware.JWTAuthenticationMiddleware._extract_jwt")
    def test_cannot_complete_non_shipping_order(self, mock_jwt):
        def set_staff(request):
            request.user_id = str(uuid.uuid4())
            request.user_role = "staff"

        mock_jwt.side_effect = set_staff
        self.order.status = "paid"
        self.order.save(update_fields=["status"])

        response = self.client.patch(f"/api/v1/orders/{self.order.id}/complete")
        self.assertEqual(response.status_code, 422)
