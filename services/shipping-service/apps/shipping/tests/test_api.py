"""
Unit tests for Shipping Service API endpoints.

Tests: create shipment, status transitions (valid forward, invalid backward),
tracking code format.
"""

import uuid
from unittest.mock import patch

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.shipping.models import SHIPMENT_TRANSITIONS, Shipment, ShipmentStatusHistory
from apps.shipping.services import ShippingService


@override_settings(
    DATABASES={
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": ":memory:",
        }
    }
)
class ShipmentCreateAPITests(TestCase):
    """Tests for POST /api/v1/shipments/ endpoint."""

    def setUp(self):
        self.client = APIClient()
        self.url = "/api/v1/shipments/"
        self.order_id = str(uuid.uuid4())

    @patch("apps.core.middleware.JWTAuthenticationMiddleware._extract_jwt")
    def test_create_shipment_success(self, mock_jwt):
        """Creating a shipment with valid data should succeed."""

        def set_auth(request):
            request.user_id = str(uuid.uuid4())
            request.user_role = "admin"

        mock_jwt.side_effect = set_auth

        payload = {
            "order_id": self.order_id,
            "shipping_address": "123 Ship St, City, Country",
        }
        response = self.client.post(self.url, data=payload, format="json")
        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["data"]["status"], "processing")
        self.assertEqual(data["data"]["order_id"], self.order_id)
        self.assertIn("tracking_code", data["data"])

    @patch("apps.core.middleware.JWTAuthenticationMiddleware._extract_jwt")
    def test_create_duplicate_shipment_for_order(self, mock_jwt):
        """Creating a second shipment for the same order should fail."""

        def set_auth(request):
            request.user_id = str(uuid.uuid4())
            request.user_role = "admin"

        mock_jwt.side_effect = set_auth

        payload = {
            "order_id": self.order_id,
            "shipping_address": "123 Ship St",
        }
        # First creation
        self.client.post(self.url, data=payload, format="json")
        # Second creation should fail
        response = self.client.post(self.url, data=payload, format="json")
        self.assertEqual(response.status_code, 422)

    def test_create_shipment_unauthenticated(self):
        """Creating shipment without auth should return 401."""
        payload = {
            "order_id": self.order_id,
            "shipping_address": "123 Ship St",
        }
        response = self.client.post(self.url, data=payload, format="json")
        self.assertIn(response.status_code, [401, 403])

    @patch("apps.core.middleware.JWTAuthenticationMiddleware._extract_jwt")
    def test_create_shipment_records_initial_history(self, mock_jwt):
        """Creating a shipment should record initial status history."""

        def set_auth(request):
            request.user_id = str(uuid.uuid4())
            request.user_role = "admin"

        mock_jwt.side_effect = set_auth

        payload = {
            "order_id": self.order_id,
            "shipping_address": "123 Ship St",
        }
        response = self.client.post(self.url, data=payload, format="json")
        self.assertEqual(response.status_code, 201)

        shipment = Shipment.objects.get(order_id=self.order_id)
        history = ShipmentStatusHistory.objects.filter(shipment=shipment)
        self.assertEqual(history.count(), 1)
        self.assertEqual(history.first().to_status, "processing")


@override_settings(
    DATABASES={
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": ":memory:",
        }
    }
)
class ShipmentStatusTransitionAPITests(TestCase):
    """Tests for PATCH /api/v1/shipments/{id}/status/ endpoint."""

    def setUp(self):
        self.client = APIClient()
        self.order_id = str(uuid.uuid4())
        self.shipment = Shipment.objects.create(
            order_id=self.order_id,
            tracking_code="TS" + "A1B2C3D4E5F6",
            status="processing",
            shipping_address="123 Test St",
        )
        ShipmentStatusHistory.objects.create(
            shipment=self.shipment,
            from_status="",
            to_status="processing",
        )

    def _mock_staff_auth(self, mock_jwt):
        """Helper to set staff auth."""

        def set_staff(request):
            request.user_id = str(uuid.uuid4())
            request.user_role = "staff"

        mock_jwt.side_effect = set_staff

    @patch("apps.core.middleware.JWTAuthenticationMiddleware._extract_jwt")
    def test_valid_transition_processing_to_shipping(self, mock_jwt):
        """Transitioning from processing to shipping should succeed."""
        self._mock_staff_auth(mock_jwt)

        url = f"/api/v1/shipments/{self.shipment.id}/status/"
        response = self.client.patch(
            url, data={"status": "shipping"}, format="json"
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["data"]["status"], "shipping")

    @patch("apps.core.middleware.JWTAuthenticationMiddleware._extract_jwt")
    def test_valid_transition_shipping_to_delivered(self, mock_jwt):
        """Transitioning from shipping to delivered should succeed."""
        self._mock_staff_auth(mock_jwt)
        self.shipment.status = "shipping"
        self.shipment.save()

        url = f"/api/v1/shipments/{self.shipment.id}/status/"
        response = self.client.patch(
            url, data={"status": "delivered"}, format="json"
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["data"]["status"], "delivered")

    @patch("apps.core.middleware.JWTAuthenticationMiddleware._extract_jwt")
    def test_invalid_backward_transition(self, mock_jwt):
        """Backward transition (shipping to processing) should fail."""
        self._mock_staff_auth(mock_jwt)
        self.shipment.status = "shipping"
        self.shipment.save()

        url = f"/api/v1/shipments/{self.shipment.id}/status/"
        response = self.client.patch(
            url, data={"status": "processing"}, format="json"
        )
        self.assertEqual(response.status_code, 422)

    @patch("apps.core.middleware.JWTAuthenticationMiddleware._extract_jwt")
    def test_invalid_skip_transition(self, mock_jwt):
        """Skipping a status (processing to delivered) should fail."""
        self._mock_staff_auth(mock_jwt)

        url = f"/api/v1/shipments/{self.shipment.id}/status/"
        response = self.client.patch(
            url, data={"status": "delivered"}, format="json"
        )
        self.assertEqual(response.status_code, 422)

    @patch("apps.core.middleware.JWTAuthenticationMiddleware._extract_jwt")
    def test_transition_from_delivered_fails(self, mock_jwt):
        """Delivered is terminal; no transitions allowed."""
        self._mock_staff_auth(mock_jwt)
        self.shipment.status = "delivered"
        self.shipment.save()

        url = f"/api/v1/shipments/{self.shipment.id}/status/"
        response = self.client.patch(
            url, data={"status": "shipping"}, format="json"
        )
        self.assertEqual(response.status_code, 422)

    def test_status_update_requires_staff(self):
        """Status update without staff auth should return 401/403."""
        url = f"/api/v1/shipments/{self.shipment.id}/status/"
        response = self.client.patch(
            url, data={"status": "shipping"}, format="json"
        )
        self.assertIn(response.status_code, [401, 403])


@override_settings(
    DATABASES={
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": ":memory:",
        }
    }
)
class TrackingCodeFormatTests(TestCase):
    """Tests for tracking code generation and format."""

    def test_tracking_code_format(self):
        """Generated tracking code should match TS + 12 hex chars."""
        import re

        code = ShippingService.generate_tracking_code()
        self.assertTrue(
            re.match(r"^TS[A-F0-9]{12}$", code),
            f"Tracking code '{code}' does not match expected format",
        )

    def test_tracking_code_length(self):
        """Tracking code should be 14 characters total."""
        code = ShippingService.generate_tracking_code()
        self.assertEqual(len(code), 14)

    def test_tracking_code_uniqueness(self):
        """Multiple generated codes should be unique."""
        codes = {ShippingService.generate_tracking_code() for _ in range(100)}
        self.assertEqual(len(codes), 100)

    def test_tracking_code_starts_with_ts(self):
        """Tracking code should start with 'TS' prefix."""
        code = ShippingService.generate_tracking_code()
        self.assertTrue(code.startswith("TS"))

    def test_shipment_model_tracking_code_validator(self):
        """Shipment model should validate tracking code format."""
        from django.core.exceptions import ValidationError

        shipment = Shipment(
            order_id=uuid.uuid4(),
            tracking_code="invalid!code",
            status="processing",
            shipping_address="123 Test St",
        )
        with self.assertRaises(ValidationError):
            shipment.full_clean()
