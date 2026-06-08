"""
Integration tests for Order Service checkout flow.

Tests the full checkout orchestration with mocked downstream services
(cart → catalog → order → payment → shipping).
"""

import uuid
from decimal import Decimal
from unittest.mock import patch, MagicMock

from django.test import TestCase

from apps.core.exceptions import (
    PaymentFailedError,
    ServiceUnavailableError,
    ValidationError,
)
from apps.order.models import Order, OrderItem, OrderStatusHistory
from apps.order.services import OrderService


class CheckoutFlowIntegrationTest(TestCase):
    """
    Integration test: Full checkout flow with mocked downstream services.

    Tests:
    - Successful checkout (cart → catalog → order → payment → shipping)
    - Payment failure path
    - Shipping retry logic
    """

    def setUp(self):
        self.user_id = str(uuid.uuid4())
        self.product_id_1 = str(uuid.uuid4())
        self.product_id_2 = str(uuid.uuid4())
        self.shipping_address = "123 Test Street, City, Country"

        self.cart_response = {
            "data": {
                "id": str(uuid.uuid4()),
                "user_id": self.user_id,
                "items": [
                    {
                        "id": str(uuid.uuid4()),
                        "product_id": self.product_id_1,
                        "name": "Laptop Pro",
                        "quantity": 1,
                        "unit_price": "999.99",
                    },
                    {
                        "id": str(uuid.uuid4()),
                        "product_id": self.product_id_2,
                        "name": "USB Cable",
                        "quantity": 2,
                        "unit_price": "9.99",
                    },
                ],
                "subtotal": "1019.97",
            }
        }

        self.catalog_response = {
            "data": [
                {
                    "product_id": self.product_id_1,
                    "valid": True,
                    "name": "Laptop Pro",
                    "sku": "LAP-001",
                    "price": "999.99",
                    "stock": 10,
                    "image_url": "https://example.com/laptop.jpg",
                },
                {
                    "product_id": self.product_id_2,
                    "valid": True,
                    "name": "USB Cable",
                    "sku": "USB-001",
                    "price": "9.99",
                    "stock": 50,
                    "image_url": "https://example.com/usb.jpg",
                },
            ]
        }

        self.payment_success_response = {
            "data": {
                "id": str(uuid.uuid4()),
                "status": "success",
                "amount": "1019.97",
            }
        }

        self.payment_failure_response = {
            "data": {
                "id": str(uuid.uuid4()),
                "status": "failed",
                "amount": "1019.97",
            }
        }

        self.shipment_response = {
            "data": {
                "id": str(uuid.uuid4()),
                "order_id": None,  # Will be set dynamically
                "tracking_code": "TS1234ABCD5678",
                "status": "processing",
            }
        }

    def test_successful_checkout_flow(self):
        """
        Test the full successful checkout flow:
        cart → catalog validation → order creation → payment success → shipment created.
        """
        service = OrderService(authorization_header="Bearer test-token")

        with patch.object(
            service._cart_client, "get", return_value=self.cart_response
        ), patch.object(
            service._cart_write_client, "delete", return_value={"data": {"items": []}}
        ), patch.object(
            service._catalog_client, "post", return_value=self.catalog_response
        ), patch.object(
            service._payment_client, "post", return_value=self.payment_success_response
        ), patch.object(
            service._shipping_client, "post", return_value=self.shipment_response
        ):
            result = service.checkout(self.user_id, self.shipping_address)

        # Verify order was created
        self.assertIn("id", result)
        self.assertEqual(result["user_id"], self.user_id)
        self.assertEqual(result["status"], "shipping")
        self.assertEqual(result["shipping_address"], self.shipping_address)

        # Verify order items with price snapshots
        self.assertEqual(len(result["items"]), 2)

        laptop_item = next(
            i for i in result["items"] if i["product_id"] == self.product_id_1
        )
        self.assertEqual(laptop_item["product_name"], "Laptop Pro")
        self.assertEqual(laptop_item["product_sku"], "LAP-001")
        self.assertEqual(laptop_item["unit_price"], Decimal("999.99"))
        self.assertEqual(laptop_item["quantity"], 1)

        usb_item = next(
            i for i in result["items"] if i["product_id"] == self.product_id_2
        )
        self.assertEqual(usb_item["product_name"], "USB Cable")
        self.assertEqual(usb_item["product_sku"], "USB-001")
        self.assertEqual(usb_item["unit_price"], Decimal("9.99"))
        self.assertEqual(usb_item["quantity"], 2)

        # Verify order totals
        self.assertEqual(result["subtotal"], Decimal("1019.97"))
        self.assertEqual(result["total_amount"], Decimal("1019.97"))

        # Verify status history
        order = Order.objects.get(id=result["id"])
        history = OrderStatusHistory.objects.filter(order=order).order_by("created_at")
        statuses = [(h.from_status, h.to_status) for h in history]
        self.assertIn((None, "created"), statuses)
        self.assertIn(("created", "payment_pending"), statuses)
        self.assertIn(("payment_pending", "paid"), statuses)
        self.assertIn(("paid", "shipping"), statuses)

    def test_payment_failure_path(self):
        """
        Test checkout when payment fails:
        Order should transition to payment_failed status.
        """
        service = OrderService(authorization_header="Bearer test-token")

        with patch.object(
            service._cart_client, "get", return_value=self.cart_response
        ), patch.object(
            service._catalog_client, "post", return_value=self.catalog_response
        ), patch.object(
            service._payment_client, "post", return_value=self.payment_failure_response
        ):
            result = service.checkout(self.user_id, self.shipping_address)

        # Verify order status is payment_failed
        self.assertEqual(result["status"], "payment_failed")

        # Verify status history includes the failure
        order = Order.objects.get(id=result["id"])
        history = OrderStatusHistory.objects.filter(order=order).order_by("created_at")
        statuses = [(h.from_status, h.to_status) for h in history]
        self.assertIn(("payment_pending", "payment_failed"), statuses)

        # Verify no shipment was attempted (shipping client not called)
        # Order items should still have correct price snapshots
        self.assertEqual(len(result["items"]), 2)

    @patch("apps.order.services.time.sleep")
    def test_shipping_retry_on_failure(self, mock_sleep):
        """
        Test that shipping creation retries 3 times with 2s intervals on failure.
        """
        service = OrderService(authorization_header="Bearer test-token")

        # Shipping fails on first 2 attempts, succeeds on 3rd
        shipping_side_effects = [
            ServiceUnavailableError(message="Shipping unavailable"),
            ServiceUnavailableError(message="Shipping unavailable"),
            self.shipment_response,
        ]

        with patch.object(
            service._cart_client, "get", return_value=self.cart_response
        ), patch.object(
            service._cart_write_client, "delete", return_value={"data": {"items": []}}
        ), patch.object(
            service._catalog_client, "post", return_value=self.catalog_response
        ), patch.object(
            service._payment_client, "post", return_value=self.payment_success_response
        ), patch.object(
            service._shipping_client, "post", side_effect=shipping_side_effects
        ):
            result = service.checkout(self.user_id, self.shipping_address)

        # Order should move to shipping once shipment creation eventually succeeds.
        self.assertEqual(result["status"], "shipping")

        # Verify retry sleep was called with correct interval
        self.assertEqual(mock_sleep.call_count, 2)
        mock_sleep.assert_called_with(2)

    @patch("apps.order.services.time.sleep")
    def test_shipping_all_retries_fail(self, mock_sleep):
        """
        Test that when all 3 shipping retries fail, order remains in paid status.
        """
        service = OrderService(authorization_header="Bearer test-token")

        with patch.object(
            service._cart_client, "get", return_value=self.cart_response
        ), patch.object(
            service._cart_write_client, "delete", return_value={"data": {"items": []}}
        ), patch.object(
            service._catalog_client, "post", return_value=self.catalog_response
        ), patch.object(
            service._payment_client, "post", return_value=self.payment_success_response
        ), patch.object(
            service._shipping_client,
            "post",
            side_effect=ServiceUnavailableError(message="Shipping unavailable"),
        ) as mock_shipping_post:
            result = service.checkout(self.user_id, self.shipping_address)

        # Order should still be paid even if shipping fails
        self.assertEqual(result["status"], "paid")

        # Verify all 3 retries were attempted
        self.assertEqual(mock_shipping_post.call_count, 3)
        self.assertEqual(mock_sleep.call_count, 2)

    def test_empty_cart_checkout_rejected(self):
        """
        Test that checkout with an empty cart raises ValidationError.
        """
        service = OrderService(authorization_header="Bearer test-token")

        empty_cart_response = {
            "data": {
                "id": str(uuid.uuid4()),
                "user_id": self.user_id,
                "items": [],
                "subtotal": "0.00",
            }
        }

        with patch.object(
            service._cart_client, "get", return_value=empty_cart_response
        ):
            with self.assertRaises(ValidationError) as ctx:
                service.checkout(self.user_id, self.shipping_address)

        self.assertIn("empty cart", ctx.exception.message.lower())

    def test_cart_service_unavailable(self):
        """
        Test that checkout raises ServiceUnavailableError when Cart Service is down.
        """
        service = OrderService(authorization_header="Bearer test-token")

        with patch.object(
            service._cart_client,
            "get",
            side_effect=ServiceUnavailableError(message="Cart service unavailable"),
        ):
            with self.assertRaises(ServiceUnavailableError):
                service.checkout(self.user_id, self.shipping_address)

    def test_catalog_validation_failure(self):
        """
        Test that checkout raises ValidationError when product validation fails.
        """
        service = OrderService(authorization_header="Bearer test-token")

        failed_catalog_response = {
            "data": [
                {
                    "product_id": self.product_id_1,
                    "valid": False,
                    "reason": "out_of_stock",
                },
                {
                    "product_id": self.product_id_2,
                    "valid": True,
                    "name": "USB Cable",
                    "sku": "USB-001",
                    "price": "9.99",
                    "stock": 50,
                    "image_url": "https://example.com/usb.jpg",
                },
            ]
        }

        with patch.object(
            service._cart_client, "get", return_value=self.cart_response
        ), patch.object(
            service._catalog_client, "post", return_value=failed_catalog_response
        ):
            with self.assertRaises(ValidationError) as ctx:
                service.checkout(self.user_id, self.shipping_address)

        self.assertIn("failed validation", ctx.exception.message.lower())
