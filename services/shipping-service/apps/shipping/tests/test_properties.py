"""
Property-based tests for Shipping Service.

Uses hypothesis to verify shipment status forward-only transitions.
"""

import uuid

from hypothesis import given, settings
from hypothesis import strategies as st
from hypothesis.extra.django import TestCase

from apps.core.exceptions import ValidationError
from apps.shipping.models import SHIPMENT_TRANSITIONS, Shipment, ShipmentStatusHistory
from apps.shipping.services import ShippingService


# All valid shipment statuses
ALL_SHIPMENT_STATUSES = ["processing", "shipping", "delivered"]


class ShipmentStatusForwardOnlyPropertyTest(TestCase):
    """
    Property 7: Shipment Status Forward-Only

    Verify shipment status only transitions forward (processing→shipping→delivered).
    Backward transitions are rejected.

    **Validates: Requirements 10.3, 10.5**
    """

    @given(
        current_status=st.sampled_from(ALL_SHIPMENT_STATUSES),
        target_status=st.sampled_from(ALL_SHIPMENT_STATUSES),
    )
    @settings(max_examples=50)
    def test_shipment_status_transitions(self, current_status, target_status):
        """
        For any (current_status, target_status) pair:
        - If the transition is forward (in SHIPMENT_TRANSITIONS), it must succeed
        - If the transition is backward or invalid, it must be rejected
        """
        order_id = uuid.uuid4()
        tracking_code = f"TS{uuid.uuid4().hex[:12].upper()}"

        # Create shipment with the given current_status
        shipment = Shipment.objects.create(
            order_id=order_id,
            tracking_code=tracking_code,
            status=current_status,
            shipping_address="123 Test St",
        )

        allowed_transitions = SHIPMENT_TRANSITIONS.get(current_status, [])

        if target_status in allowed_transitions:
            # Valid forward transition — should succeed
            updated_shipment = ShippingService.update_status(
                shipment.id, target_status
            )
            self.assertEqual(updated_shipment.status, target_status)

            # Verify status history was recorded
            history = ShipmentStatusHistory.objects.filter(
                shipment=shipment,
                from_status=current_status,
                to_status=target_status,
            )
            self.assertTrue(history.exists())
        else:
            # Invalid/backward transition — should be rejected
            with self.assertRaises(ValidationError):
                ShippingService.update_status(shipment.id, target_status)

            # Verify shipment status was NOT changed
            shipment.refresh_from_db()
            self.assertEqual(shipment.status, current_status)

    @given(
        target_status=st.sampled_from(["processing", "shipping"]),
    )
    @settings(max_examples=50)
    def test_delivered_cannot_transition_backward(self, target_status):
        """
        For any target status that is not forward from 'delivered',
        the transition must be rejected. 'delivered' is a terminal state.
        """
        order_id = uuid.uuid4()
        tracking_code = f"TS{uuid.uuid4().hex[:12].upper()}"

        shipment = Shipment.objects.create(
            order_id=order_id,
            tracking_code=tracking_code,
            status="delivered",
            shipping_address="123 Test St",
        )

        with self.assertRaises(ValidationError):
            ShippingService.update_status(shipment.id, target_status)

        # Verify status unchanged
        shipment.refresh_from_db()
        self.assertEqual(shipment.status, "delivered")

    @given(
        target_status=st.sampled_from(["processing"]),
    )
    @settings(max_examples=50)
    def test_shipping_cannot_go_back_to_processing(self, target_status):
        """
        A shipment in 'shipping' status cannot transition back to 'processing'.
        """
        order_id = uuid.uuid4()
        tracking_code = f"TS{uuid.uuid4().hex[:12].upper()}"

        shipment = Shipment.objects.create(
            order_id=order_id,
            tracking_code=tracking_code,
            status="shipping",
            shipping_address="123 Test St",
        )

        with self.assertRaises(ValidationError):
            ShippingService.update_status(shipment.id, target_status)

        shipment.refresh_from_db()
        self.assertEqual(shipment.status, "shipping")
