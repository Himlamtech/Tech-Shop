"""
Unit tests for Cart Service API endpoints.

Tests: add item (success, out of stock, catalog unavailable),
update quantity, remove item, one cart per customer.
"""

import uuid
from decimal import Decimal
from unittest.mock import MagicMock, patch

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.cart.models import Cart, CartItem
from apps.core.exceptions import ProductOutOfStockError, ServiceUnavailableError


@override_settings(
    DATABASES={
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": ":memory:",
        }
    },
    CATALOG_SERVICE_URL="http://catalog-service:8002",
)
class CartAddItemAPITests(TestCase):
    """Tests for POST /api/v1/cart/items endpoint."""

    def setUp(self):
        self.client = APIClient()
        self.url = "/api/v1/cart/items"
        self.user_id = str(uuid.uuid4())
        self.product_id = str(uuid.uuid4())

    def _mock_auth(self, mock_jwt):
        """Helper to set customer auth."""

        def set_customer(request):
            request.user_id = self.user_id
            request.user_role = "customer"

        mock_jwt.side_effect = set_customer

    @patch("apps.core.middleware.JWTAuthenticationMiddleware._extract_jwt")
    @patch("apps.core.http_client.ServiceClient.post")
    def test_add_item_success(self, mock_catalog_post, mock_jwt):
        """Adding a valid product to cart should succeed."""
        self._mock_auth(mock_jwt)
        mock_catalog_post.return_value = {
            "data": [
                {
                    "product_id": self.product_id,
                    "valid": True,
                    "name": "Test Product",
                    "price": "29.99",
                    "stock": 50,
                    "image_url": "https://example.com/img.jpg",
                }
            ]
        }

        payload = {"product_id": self.product_id, "quantity": 2}
        response = self.client.post(self.url, data=payload, format="json")
        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertTrue(data["success"])
        self.assertEqual(len(data["data"]["items"]), 1)

    @patch("apps.core.middleware.JWTAuthenticationMiddleware._extract_jwt")
    @patch("apps.core.http_client.ServiceClient.post")
    def test_add_item_out_of_stock(self, mock_catalog_post, mock_jwt):
        """Adding an out-of-stock product should return error."""
        self._mock_auth(mock_jwt)
        mock_catalog_post.return_value = {
            "data": [
                {
                    "product_id": self.product_id,
                    "valid": False,
                    "reason": "out_of_stock",
                }
            ]
        }

        payload = {"product_id": self.product_id, "quantity": 1}
        response = self.client.post(self.url, data=payload, format="json")
        self.assertIn(response.status_code, [400, 422])

    @patch("apps.core.middleware.JWTAuthenticationMiddleware._extract_jwt")
    @patch("apps.core.http_client.ServiceClient.post")
    def test_add_item_catalog_unavailable(self, mock_catalog_post, mock_jwt):
        """Adding item when catalog is unavailable should return 503."""
        self._mock_auth(mock_jwt)
        mock_catalog_post.side_effect = ServiceUnavailableError(
            message="Service unavailable"
        )

        payload = {"product_id": self.product_id, "quantity": 1}
        response = self.client.post(self.url, data=payload, format="json")
        self.assertEqual(response.status_code, 503)

    @patch("apps.core.middleware.JWTAuthenticationMiddleware._extract_jwt")
    @patch("apps.core.http_client.ServiceClient.post")
    def test_add_item_inactive_product(self, mock_catalog_post, mock_jwt):
        """Adding an inactive product should return error."""
        self._mock_auth(mock_jwt)
        mock_catalog_post.return_value = {
            "data": [
                {
                    "product_id": self.product_id,
                    "valid": False,
                    "reason": "inactive",
                }
            ]
        }

        payload = {"product_id": self.product_id, "quantity": 1}
        response = self.client.post(self.url, data=payload, format="json")
        self.assertIn(response.status_code, [400, 422])

    def test_add_item_unauthenticated(self):
        """Adding item without auth should return 401."""
        payload = {"product_id": self.product_id, "quantity": 1}
        response = self.client.post(self.url, data=payload, format="json")
        self.assertIn(response.status_code, [401, 403])


@override_settings(
    DATABASES={
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": ":memory:",
        }
    },
    CATALOG_SERVICE_URL="http://catalog-service:8002",
)
class CartUpdateRemoveAPITests(TestCase):
    """Tests for PATCH/DELETE /api/v1/cart/items/{id} endpoints."""

    def setUp(self):
        self.client = APIClient()
        self.user_id = str(uuid.uuid4())
        self.product_id = str(uuid.uuid4())
        # Create cart and item
        self.cart = Cart.objects.create(user_id=self.user_id)
        self.cart_item = CartItem.objects.create(
            cart=self.cart,
            product_id=self.product_id,
            quantity=2,
        )

    def _mock_auth(self, mock_jwt):
        """Helper to set customer auth."""

        def set_customer(request):
            request.user_id = self.user_id
            request.user_role = "customer"

        mock_jwt.side_effect = set_customer

    @patch("apps.core.middleware.JWTAuthenticationMiddleware._extract_jwt")
    @patch("apps.core.http_client.ServiceClient.post")
    def test_update_quantity_success(self, mock_catalog_post, mock_jwt):
        """Updating cart item quantity should succeed."""
        self._mock_auth(mock_jwt)
        mock_catalog_post.return_value = {
            "data": [
                {
                    "product_id": self.product_id,
                    "valid": True,
                    "name": "Test Product",
                    "price": "29.99",
                    "stock": 50,
                    "image_url": "https://example.com/img.jpg",
                }
            ]
        }

        url = f"/api/v1/cart/items/{self.cart_item.id}"
        response = self.client.patch(url, data={"quantity": 5}, format="json")
        self.assertEqual(response.status_code, 200)
        self.cart_item.refresh_from_db()
        self.assertEqual(self.cart_item.quantity, 5)

    @patch("apps.core.middleware.JWTAuthenticationMiddleware._extract_jwt")
    @patch("apps.core.http_client.ServiceClient.post")
    def test_remove_item_success(self, mock_catalog_post, mock_jwt):
        """Removing a cart item should succeed and return updated cart."""
        self._mock_auth(mock_jwt)
        mock_catalog_post.return_value = {"data": []}

        url = f"/api/v1/cart/items/{self.cart_item.id}"
        response = self.client.delete(url)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data["data"]["items"]), 0)

    @patch("apps.core.middleware.JWTAuthenticationMiddleware._extract_jwt")
    def test_remove_nonexistent_item(self, mock_jwt):
        """Removing a non-existent item should return 404."""
        self._mock_auth(mock_jwt)

        fake_id = uuid.uuid4()
        url = f"/api/v1/cart/items/{fake_id}"
        response = self.client.delete(url)
        self.assertEqual(response.status_code, 404)


@override_settings(
    DATABASES={
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": ":memory:",
        }
    },
    CATALOG_SERVICE_URL="http://catalog-service:8002",
)
class CartOnePerCustomerTests(TestCase):
    """Tests for one cart per customer constraint."""

    def setUp(self):
        self.user_id = str(uuid.uuid4())

    def test_one_cart_per_user(self):
        """Each user should have exactly one cart (unique user_id)."""
        Cart.objects.create(user_id=self.user_id)
        from django.db import IntegrityError

        with self.assertRaises(IntegrityError):
            Cart.objects.create(user_id=self.user_id)

    def test_get_or_create_returns_same_cart(self):
        """get_or_create should return the same cart for the same user."""
        cart1, created1 = Cart.objects.get_or_create(user_id=self.user_id)
        cart2, created2 = Cart.objects.get_or_create(user_id=self.user_id)
        self.assertTrue(created1)
        self.assertFalse(created2)
        self.assertEqual(cart1.id, cart2.id)

    @patch("apps.core.middleware.JWTAuthenticationMiddleware._extract_jwt")
    @patch("apps.core.http_client.ServiceClient.post")
    def test_get_cart_creates_if_not_exists(self, mock_catalog_post, mock_jwt):
        """GET /api/v1/cart/current should create cart if none exists."""
        client = APIClient()
        user_id = str(uuid.uuid4())

        def set_customer(request):
            request.user_id = user_id
            request.user_role = "customer"

        mock_jwt.side_effect = set_customer
        mock_catalog_post.return_value = {"data": []}

        response = client.get("/api/v1/cart/current")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["data"]["items"], [])
        self.assertTrue(Cart.objects.filter(user_id=user_id).exists())
