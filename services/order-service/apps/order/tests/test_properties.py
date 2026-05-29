"""
Property-based tests for Order Service.

Uses hypothesis to verify order invariants across randomized inputs.
"""

import uuid
from decimal import Decimal

from hypothesis import given, settings
from hypothesis import strategies as st
from hypothesis.extra.django import TestCase

from apps.core.exceptions import ValidationError
from apps.order.models import ORDER_TRANSITIONS, Order, OrderItem, OrderStatusHistory
from apps.order.services import OrderService


# All valid order statuses
ALL_STATUSES = [
    "created",
    "payment_pending",
    "paid",
    "payment_failed",
    "shipping",
    "completed",
    "cancelled",
]


class PriceSnapshotImmutabilityPropertyTest(TestCase):
    """
    Property 1: Price Snapshot Immutability

    Verify OrderItem fields (unit_price, product_name, product_sku, product_image_url)
    never change after creation.

    **Validates: Requirements 8.2**
    """

    @given(
        unit_price=st.decimals(
            min_value=Decimal("0.01"),
            max_value=Decimal("999999.99"),
            places=2,
            allow_nan=False,
            allow_infinity=False,
        ),
        product_name=st.text(min_size=1, max_size=100, alphabet=st.characters(
            whitelist_categories=("L", "N", "Z"),
        )),
        product_sku=st.text(min_size=1, max_size=50, alphabet=st.characters(
            whitelist_categories=("L", "N"),
        )),
        quantity=st.integers(min_value=1, max_value=99),
    )
    @settings(max_examples=50)
    def test_order_item_snapshot_fields_immutable_after_creation(
        self, unit_price, product_name, product_sku, quantity
    ):
        """
        For any valid OrderItem creation parameters, the snapshot fields
        (unit_price, product_name, product_sku, product_image_url) must
        remain unchanged after the item is persisted and re-read from DB.
        """
        user_id = uuid.uuid4()
        product_id = uuid.uuid4()
        product_image_url = f"https://example.com/images/{uuid.uuid4().hex[:8]}.jpg"
        line_total = unit_price * quantity

        # Create order
        order = Order.objects.create(
            user_id=user_id,
            status="created",
            subtotal=line_total,
            shipping_fee=Decimal("0.00"),
            discount_amount=Decimal("0.00"),
            total_amount=line_total,
            shipping_address="123 Test St",
        )

        # Create order item with snapshot fields
        order_item = OrderItem.objects.create(
            order=order,
            product_id=product_id,
            product_name=product_name,
            product_sku=product_sku,
            product_image_url=product_image_url,
            unit_price=unit_price,
            quantity=quantity,
            line_total=line_total,
        )

        # Re-read from database
        saved_item = OrderItem.objects.get(id=order_item.id)

        # Verify snapshot fields are unchanged
        self.assertEqual(saved_item.unit_price, unit_price)
        self.assertEqual(saved_item.product_name, product_name)
        self.assertEqual(saved_item.product_sku, product_sku)
        self.assertEqual(saved_item.product_image_url, product_image_url)

        # Verify fields survive order status changes
        order.status = "payment_pending"
        order.save()

        saved_item.refresh_from_db()
        self.assertEqual(saved_item.unit_price, unit_price)
        self.assertEqual(saved_item.product_name, product_name)
        self.assertEqual(saved_item.product_sku, product_sku)
        self.assertEqual(saved_item.product_image_url, product_image_url)


class OrderStatusTransitionValidityPropertyTest(TestCase):
    """
    Property 2: Order Status Transition Validity

    Verify only allowed transitions succeed; invalid transitions are rejected.
    Use hypothesis to generate random (current_status, target_status) pairs.

    **Validates: Requirements 23.2, 23.4**
    """

    @given(
        current_status=st.sampled_from(ALL_STATUSES),
        target_status=st.sampled_from(ALL_STATUSES),
    )
    @settings(max_examples=50)
    def test_order_status_transitions(self, current_status, target_status):
        """
        For any (current_status, target_status) pair:
        - If the transition is in ORDER_TRANSITIONS, it must succeed
        - If the transition is NOT in ORDER_TRANSITIONS, it must be rejected
        """
        user_id = uuid.uuid4()

        # Create order with the given current_status
        order = Order.objects.create(
            user_id=user_id,
            status=current_status,
            subtotal=Decimal("100.00"),
            shipping_fee=Decimal("0.00"),
            discount_amount=Decimal("0.00"),
            total_amount=Decimal("100.00"),
            shipping_address="123 Test St",
        )

        service = OrderService(authorization_header="Bearer test-token")
        allowed_transitions = ORDER_TRANSITIONS.get(current_status, set())

        if target_status in allowed_transitions:
            # Valid transition — should succeed
            updated_order = service.transition_status(
                str(order.id), target_status, reason="Test transition"
            )
            self.assertEqual(updated_order.status, target_status)

            # Verify status history was recorded
            history = OrderStatusHistory.objects.filter(
                order_id=order.id,
                from_status=current_status,
                to_status=target_status,
            )
            self.assertTrue(history.exists())
        else:
            # Invalid transition — should be rejected
            with self.assertRaises(ValidationError):
                service.transition_status(
                    str(order.id), target_status, reason="Test transition"
                )

            # Verify order status was NOT changed
            order.refresh_from_db()
            self.assertEqual(order.status, current_status)
