"""
Unit tests for Payment Service API endpoints.

Tests: create payment (success, idempotency), simulate success/failure,
status history.
"""

import uuid
from decimal import Decimal
from unittest.mock import patch

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.payment.models import PaymentStatusHistory, PaymentTransaction


@override_settings(
    DATABASES={
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": ":memory:",
        }
    }
)
class PaymentCreateAPITests(TestCase):
    """Tests for POST /api/v1/payments/ endpoint."""

    def setUp(self):
        self.client = APIClient()
        self.url = "/api/v1/payments/"
        self.order_id = str(uuid.uuid4())

    def test_create_payment_success(self):
        """Creating a payment with valid data should succeed."""
        payload = {
            "order_id": self.order_id,
            "amount": "99.99",
            "idempotency_key": f"order_{self.order_id}_payment",
        }
        response = self.client.post(self.url, data=payload, format="json")
        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["data"]["status"], "pending")
        self.assertEqual(data["data"]["order_id"], self.order_id)

    def test_create_payment_idempotency(self):
        """Duplicate idempotency_key should return existing transaction."""
        idempotency_key = f"order_{self.order_id}_payment_idem"
        payload = {
            "order_id": self.order_id,
            "amount": "99.99",
            "idempotency_key": idempotency_key,
        }

        # First request
        response1 = self.client.post(self.url, data=payload, format="json")
        self.assertEqual(response1.status_code, 201)
        data1 = response1.json()

        # Second request with same idempotency_key
        response2 = self.client.post(self.url, data=payload, format="json")
        self.assertEqual(response2.status_code, 201)
        data2 = response2.json()

        # Should return the same transaction
        self.assertEqual(data1["data"]["id"], data2["data"]["id"])

    def test_create_payment_different_idempotency_keys(self):
        """Different idempotency keys should create different transactions."""
        payload1 = {
            "order_id": self.order_id,
            "amount": "50.00",
            "idempotency_key": "key-1",
        }
        payload2 = {
            "order_id": self.order_id,
            "amount": "50.00",
            "idempotency_key": "key-2",
        }

        response1 = self.client.post(self.url, data=payload1, format="json")
        response2 = self.client.post(self.url, data=payload2, format="json")

        self.assertEqual(response1.status_code, 201)
        self.assertEqual(response2.status_code, 201)
        self.assertNotEqual(
            response1.json()["data"]["id"], response2.json()["data"]["id"]
        )

    def test_create_payment_missing_fields(self):
        """Missing required fields should return 422."""
        payload = {"order_id": self.order_id}
        response = self.client.post(self.url, data=payload, format="json")
        self.assertEqual(response.status_code, 422)

    def test_create_payment_records_initial_history(self):
        """Creating a payment should record initial status history."""
        payload = {
            "order_id": self.order_id,
            "amount": "25.00",
            "idempotency_key": "history-test-key",
        }
        response = self.client.post(self.url, data=payload, format="json")
        self.assertEqual(response.status_code, 201)

        tx_id = response.json()["data"]["id"]
        history = PaymentStatusHistory.objects.filter(transaction_id=tx_id)
        self.assertEqual(history.count(), 1)
        self.assertEqual(history.first().to_status, "pending")


@override_settings(
    DATABASES={
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": ":memory:",
        }
    }
)
class PaymentSimulateSuccessAPITests(TestCase):
    """Tests for POST /api/v1/payments/{id}/simulate-success/ endpoint."""

    def setUp(self):
        self.client = APIClient()
        self.order_id = str(uuid.uuid4())
        self.transaction = PaymentTransaction.objects.create(
            order_id=self.order_id,
            amount=Decimal("75.00"),
            status="pending",
            idempotency_key=f"sim-success-{uuid.uuid4()}",
        )
        PaymentStatusHistory.objects.create(
            transaction=self.transaction,
            from_status="",
            to_status="pending",
        )

    def test_simulate_success(self):
        """Simulating success on pending transaction should set status to success."""
        url = f"/api/v1/payments/{self.transaction.id}/simulate-success/"
        response = self.client.post(url)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["data"]["status"], "success")

        self.transaction.refresh_from_db()
        self.assertEqual(self.transaction.status, "success")

    def test_simulate_success_on_non_pending(self):
        """Simulating success on non-pending transaction should return 422."""
        self.transaction.status = "success"
        self.transaction.save()

        url = f"/api/v1/payments/{self.transaction.id}/simulate-success/"
        response = self.client.post(url)
        self.assertEqual(response.status_code, 422)

    def test_simulate_success_nonexistent(self):
        """Simulating success on non-existent transaction should return 404."""
        fake_id = uuid.uuid4()
        url = f"/api/v1/payments/{fake_id}/simulate-success/"
        response = self.client.post(url)
        self.assertEqual(response.status_code, 404)


@override_settings(
    DATABASES={
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": ":memory:",
        }
    }
)
class PaymentSimulateFailureAPITests(TestCase):
    """Tests for POST /api/v1/payments/{id}/simulate-failure/ endpoint."""

    def setUp(self):
        self.client = APIClient()
        self.order_id = str(uuid.uuid4())
        self.transaction = PaymentTransaction.objects.create(
            order_id=self.order_id,
            amount=Decimal("60.00"),
            status="pending",
            idempotency_key=f"sim-failure-{uuid.uuid4()}",
        )
        PaymentStatusHistory.objects.create(
            transaction=self.transaction,
            from_status="",
            to_status="pending",
        )

    def test_simulate_failure(self):
        """Simulating failure on pending transaction should set status to failed."""
        url = f"/api/v1/payments/{self.transaction.id}/simulate-failure/"
        response = self.client.post(url)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["data"]["status"], "failed")

        self.transaction.refresh_from_db()
        self.assertEqual(self.transaction.status, "failed")

    def test_simulate_failure_on_non_pending(self):
        """Simulating failure on non-pending transaction should return 422."""
        self.transaction.status = "failed"
        self.transaction.save()

        url = f"/api/v1/payments/{self.transaction.id}/simulate-failure/"
        response = self.client.post(url)
        self.assertEqual(response.status_code, 422)


@override_settings(
    DATABASES={
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": ":memory:",
        }
    }
)
class PaymentStatusHistoryTests(TestCase):
    """Tests for payment status history tracking."""

    def setUp(self):
        self.client = APIClient()
        self.order_id = str(uuid.uuid4())

    def test_full_lifecycle_history(self):
        """Payment lifecycle should record all status transitions."""
        # Create payment
        payload = {
            "order_id": self.order_id,
            "amount": "100.00",
            "idempotency_key": f"lifecycle-{uuid.uuid4()}",
        }
        response = self.client.post("/api/v1/payments/", data=payload, format="json")
        tx_id = response.json()["data"]["id"]

        # Simulate success
        self.client.post(f"/api/v1/payments/{tx_id}/simulate-success/")

        # Check history
        history = PaymentStatusHistory.objects.filter(
            transaction_id=tx_id
        ).order_by("created_at")
        self.assertEqual(history.count(), 2)
        self.assertEqual(history[0].to_status, "pending")
        self.assertEqual(history[1].from_status, "pending")
        self.assertEqual(history[1].to_status, "success")

    def test_status_history_in_response(self):
        """Payment response should include status_history."""
        payload = {
            "order_id": self.order_id,
            "amount": "50.00",
            "idempotency_key": f"history-resp-{uuid.uuid4()}",
        }
        response = self.client.post("/api/v1/payments/", data=payload, format="json")
        data = response.json()
        self.assertIn("status_history", data["data"])
        self.assertGreaterEqual(len(data["data"]["status_history"]), 1)
