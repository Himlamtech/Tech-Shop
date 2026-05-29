"""
Property-based tests for Payment Service.

Uses hypothesis to verify payment idempotency invariants across randomized inputs.
"""

import uuid
from decimal import Decimal

from hypothesis import given, settings
from hypothesis import strategies as st
from hypothesis.extra.django import TestCase

from apps.payment.models import PaymentTransaction, PaymentStatusHistory
from apps.payment.services import PaymentService


class PaymentIdempotencyPropertyTest(TestCase):
    """
    Property 6: Payment Idempotency

    Verify duplicate payment requests with same idempotency_key return same result
    without creating additional transactions.

    **Validates: Requirements 9.6**
    """

    @given(
        amount=st.decimals(
            min_value=Decimal("0.01"),
            max_value=Decimal("999999.99"),
            places=2,
            allow_nan=False,
            allow_infinity=False,
        ),
        num_duplicates=st.integers(min_value=2, max_value=5),
    )
    @settings(max_examples=50)
    def test_duplicate_requests_return_same_result(self, amount, num_duplicates):
        """
        For any payment amount and any number of duplicate requests with the
        same idempotency_key, only one PaymentTransaction is created and all
        subsequent requests return the same transaction.
        """
        order_id = uuid.uuid4()
        idempotency_key = f"idem_{uuid.uuid4()}"

        # First request — creates the transaction
        first_result = PaymentService.create_payment(
            order_id=order_id,
            amount=amount,
            idempotency_key=idempotency_key,
        )

        self.assertIsNotNone(first_result)
        self.assertEqual(first_result.order_id, order_id)
        self.assertEqual(first_result.amount, amount)
        self.assertEqual(first_result.idempotency_key, idempotency_key)

        # Submit duplicate requests
        for i in range(num_duplicates - 1):
            duplicate_result = PaymentService.create_payment(
                order_id=order_id,
                amount=amount,
                idempotency_key=idempotency_key,
            )

            # Must return the same transaction
            self.assertEqual(duplicate_result.id, first_result.id)
            self.assertEqual(duplicate_result.order_id, first_result.order_id)
            self.assertEqual(duplicate_result.amount, first_result.amount)
            self.assertEqual(duplicate_result.status, first_result.status)
            self.assertEqual(
                duplicate_result.idempotency_key, first_result.idempotency_key
            )

        # Verify only ONE transaction exists for this idempotency_key
        transaction_count = PaymentTransaction.objects.filter(
            idempotency_key=idempotency_key
        ).count()
        self.assertEqual(transaction_count, 1)

    @given(
        amount_1=st.decimals(
            min_value=Decimal("0.01"),
            max_value=Decimal("999999.99"),
            places=2,
            allow_nan=False,
            allow_infinity=False,
        ),
        amount_2=st.decimals(
            min_value=Decimal("0.01"),
            max_value=Decimal("999999.99"),
            places=2,
            allow_nan=False,
            allow_infinity=False,
        ),
    )
    @settings(max_examples=50)
    def test_same_idempotency_key_ignores_different_amounts(self, amount_1, amount_2):
        """
        For any two requests with the same idempotency_key but different amounts,
        the second request returns the original transaction (first amount wins).
        No additional transaction is created.
        """
        order_id = uuid.uuid4()
        idempotency_key = f"idem_{uuid.uuid4()}"

        # First request
        first_result = PaymentService.create_payment(
            order_id=order_id,
            amount=amount_1,
            idempotency_key=idempotency_key,
        )

        # Second request with potentially different amount
        second_result = PaymentService.create_payment(
            order_id=order_id,
            amount=amount_2,
            idempotency_key=idempotency_key,
        )

        # Must return the same transaction (first one wins)
        self.assertEqual(second_result.id, first_result.id)
        self.assertEqual(second_result.amount, amount_1)  # Original amount preserved

        # Only one transaction exists
        transaction_count = PaymentTransaction.objects.filter(
            idempotency_key=idempotency_key
        ).count()
        self.assertEqual(transaction_count, 1)
