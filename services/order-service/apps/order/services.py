"""
Business logic for Order Service.

Handles the checkout orchestration workflow and order status transitions.
"""

import logging
import time
from decimal import Decimal

from django.conf import settings
from django.db import transaction

from apps.core.exceptions import (
    PaymentFailedError,
    ServiceUnavailableError,
    ValidationError,
)
from apps.core.http_client import ServiceClient
from apps.order.models import ORDER_TRANSITIONS, Order, OrderItem, OrderStatusHistory

logger = logging.getLogger(__name__)


class OrderService:
    """Service layer for order operations."""

    def __init__(self, authorization_header: str | None = None):
        """
        Initialize OrderService with optional authorization header for
        inter-service calls.

        Args:
            authorization_header: The Authorization header value from the
                                  incoming request, propagated to service calls.
        """
        self._cart_client = ServiceClient(
            settings.CART_SERVICE_URL, timeout_seconds=5.0
        )
        self._catalog_client = ServiceClient(
            settings.CATALOG_SERVICE_URL, timeout_seconds=5.0
        )
        self._payment_client = ServiceClient(
            settings.PAYMENT_SERVICE_URL, timeout_seconds=5.0
        )
        self._shipping_client = ServiceClient(
            settings.SHIPPING_SERVICE_URL, timeout_seconds=5.0
        )
        self._cart_write_client = ServiceClient(
            settings.CART_SERVICE_URL, timeout_seconds=5.0
        )
        self._auth_header = authorization_header

    def _get_service_headers(self) -> dict | None:
        """Build headers for inter-service calls."""
        if self._auth_header:
            return {"Authorization": self._auth_header}
        return None

    def checkout(self, user_id: str, shipping_address: str) -> dict:
        """
        Orchestrate the full checkout workflow.

        Steps:
            1. Get cart from Cart Service (5s timeout)
            2. Validate all products via Catalog Service (5s timeout)
            3. Create Order + OrderItems with price snapshots
            4. Set status to payment_pending, create status history
            5. Create payment via Payment Service
            6. On payment success: update order to paid, create shipment
            7. On payment failure: update order to payment_failed

        Args:
            user_id: UUID string of the authenticated customer.
            shipping_address: Shipping address for the order.

        Returns:
            Dict with order data including items.

        Raises:
            ValidationError: If cart is empty or product validation fails.
            ServiceUnavailableError: If Cart/Catalog service is unavailable.
            PaymentFailedError: If payment processing fails.
        """
        headers = self._get_service_headers()

        # Step 1: Get cart from Cart Service
        cart_data = self._get_cart(headers)

        # Step 2: Validate cart is not empty
        cart_items = cart_data.get("items", [])
        if not cart_items:
            raise ValidationError(message="Cannot checkout with an empty cart")

        # Step 3: Validate all products via Catalog Service
        product_ids = [item["product_id"] for item in cart_items]
        validated_products = self._validate_products(product_ids, headers)

        # Check for validation failures
        failed_items = [
            {
                "product_id": p["product_id"],
                "reason": p.get("reason", "unknown"),
            }
            for p in validated_products
            if not p.get("valid")
        ]
        if failed_items:
            raise ValidationError(
                message="Some products failed validation",
                details=failed_items,
            )

        # Build product lookup map
        product_map = {p["product_id"]: p for p in validated_products}

        # Step 4: Create Order + OrderItems with price snapshots
        order = self._create_order(user_id, shipping_address, cart_items, product_map)

        # Step 5: Transition to payment_pending
        self.transition_status(str(order.id), "payment_pending", reason="Checkout initiated")

        # Step 6: Create payment via Payment Service
        idempotency_key = f"order_{order.id}_payment"
        payment_result = self._create_payment(order, idempotency_key, headers)

        # Step 7: Handle payment result
        payment_status = payment_result.get("data", {}).get("status", "failed")
        if payment_status == "success":
            self.transition_status(str(order.id), "paid", reason="Payment successful")
            # Create shipment with retry (3x, 2s interval)
            shipment_result = self._create_shipment_with_retry(order, shipping_address, headers)
            if shipment_result is not None:
                self.transition_status(
                    str(order.id),
                    "shipping",
                    reason="Shipment created successfully",
                )
            self._clear_cart_after_success(headers)
        else:
            self.transition_status(
                str(order.id), "payment_failed", reason="Payment processing failed"
            )

        # Refresh order from DB
        order.refresh_from_db()
        return self._build_order_response(order)

    def transition_status(
        self, order_id: str, new_status: str, reason: str | None = None
    ) -> Order:
        """
        Transition an order to a new status with optimistic locking.

        Validates the transition against ORDER_TRANSITIONS map and uses
        WHERE current_status = expected to prevent race conditions.

        Args:
            order_id: UUID string of the order.
            new_status: Target status to transition to.
            reason: Optional reason for the transition.

        Returns:
            Updated Order instance.

        Raises:
            ValidationError: If the transition is not allowed.
        """
        order = Order.objects.get(id=order_id)
        current_status = order.status

        # Validate transition
        allowed = ORDER_TRANSITIONS.get(current_status, set())
        if new_status not in allowed:
            raise ValidationError(
                message=f"Cannot transition from '{current_status}' to '{new_status}'",
                details={
                    "current_status": current_status,
                    "requested_status": new_status,
                    "allowed_transitions": list(allowed),
                },
            )

        # Optimistic locking: only update if status hasn't changed
        updated_count = Order.objects.filter(
            id=order_id, status=current_status
        ).update(status=new_status)

        if updated_count == 0:
            raise ValidationError(
                message="Order status was modified concurrently. Please retry."
            )

        # Create status history record
        OrderStatusHistory.objects.create(
            order_id=order_id,
            from_status=current_status,
            to_status=new_status,
            reason=reason,
        )

        order.refresh_from_db()
        return order

    # =========================================================================
    # Private Helpers
    # =========================================================================

    def _get_cart(self, headers: dict | None) -> dict:
        """
        Fetch the current user's cart from Cart Service.

        Args:
            headers: Authorization headers to propagate.

        Returns:
            Cart data dict with items.

        Raises:
            ServiceUnavailableError: If Cart Service is unavailable within 5s.
        """
        try:
            response = self._cart_client.get(
                "/api/v1/cart/current",
                headers=headers,
            )
        except ServiceUnavailableError:
            raise ServiceUnavailableError(
                message="Cart service is temporarily unavailable. Please try again later."
            )

        return response.get("data", {})

    def _validate_products(self, product_ids: list[str], headers: dict | None) -> list:
        """
        Validate products via Catalog Service bulk validation endpoint.

        Args:
            product_ids: List of product UUID strings to validate.
            headers: Authorization headers to propagate.

        Returns:
            List of validation result dicts from Catalog Service.

        Raises:
            ServiceUnavailableError: If Catalog Service is unavailable within 5s.
        """
        try:
            response = self._catalog_client.post(
                "/api/v1/products/validate-bulk/",
                headers=headers,
                json={"product_ids": product_ids},
            )
        except ServiceUnavailableError:
            raise ServiceUnavailableError(
                message="Catalog service is temporarily unavailable. Please try again later."
            )

        return response.get("data", [])

    @transaction.atomic
    def _create_order(
        self,
        user_id: str,
        shipping_address: str,
        cart_items: list[dict],
        product_map: dict,
    ) -> Order:
        """
        Create an Order and OrderItems with price snapshots.

        Args:
            user_id: UUID string of the customer.
            shipping_address: Shipping address text.
            cart_items: List of cart item dicts (product_id, quantity).
            product_map: Dict mapping product_id to validated product info.

        Returns:
            Created Order instance.
        """
        # Build order items and calculate totals
        subtotal = Decimal("0.00")
        order_items_data = []

        for cart_item in cart_items:
            product_id = cart_item["product_id"]
            quantity = cart_item["quantity"]
            product_info = product_map.get(product_id, {})

            unit_price = Decimal(str(product_info.get("price", "0.00")))
            line_total = unit_price * quantity
            subtotal += line_total

            order_items_data.append({
                "product_id": product_id,
                "product_name": product_info.get("name", "Unknown Product"),
                "product_sku": product_info.get("sku", ""),
                "product_image_url": product_info.get("image_url", ""),
                "unit_price": unit_price,
                "quantity": quantity,
                "line_total": line_total,
            })

        # Calculate totals
        shipping_fee = Decimal("0.00")
        discount_amount = Decimal("0.00")
        total_amount = subtotal + shipping_fee - discount_amount

        # Create order
        order = Order.objects.create(
            user_id=user_id,
            status="created",
            subtotal=subtotal,
            shipping_fee=shipping_fee,
            discount_amount=discount_amount,
            total_amount=total_amount,
            shipping_address=shipping_address,
        )

        # Create order items
        order_items = [
            OrderItem(order=order, **item_data) for item_data in order_items_data
        ]
        OrderItem.objects.bulk_create(order_items)

        # Create initial status history
        OrderStatusHistory.objects.create(
            order=order,
            from_status=None,
            to_status="created",
            reason="Order created during checkout",
        )

        return order

    def _create_payment(
        self, order: Order, idempotency_key: str, headers: dict | None
    ) -> dict:
        """
        Create a payment transaction via Payment Service.

        Args:
            order: The Order instance to pay for.
            idempotency_key: Unique key to ensure payment idempotency.
            headers: Authorization headers to propagate.

        Returns:
            Payment response dict.

        Raises:
            ServiceUnavailableError: If Payment Service is unavailable.
        """
        try:
            response = self._payment_client.post(
                "/api/v1/payments/",
                headers=headers,
                json={
                    "order_id": str(order.id),
                    "amount": str(order.total_amount),
                    "idempotency_key": idempotency_key,
                },
            )
        except ServiceUnavailableError:
            raise ServiceUnavailableError(
                message="Payment service is temporarily unavailable. Please try again later."
            )

        return response

    def _create_shipment_with_retry(
        self, order: Order, shipping_address: str, headers: dict | None
    ) -> dict | None:
        """
        Create a shipment via Shipping Service with retry logic.

        Retries up to 3 times with 2-second intervals on failure.

        Args:
            order: The Order instance to ship.
            shipping_address: Shipping address for the shipment.
            headers: Authorization headers to propagate.

        Returns:
            Shipment response dict, or None if all retries fail.
        """
        max_retries = 3
        retry_interval = 2  # seconds

        for attempt in range(1, max_retries + 1):
            try:
                response = self._shipping_client.post(
                    "/api/v1/shipments/",
                    headers=headers,
                    json={
                        "order_id": str(order.id),
                        "shipping_address": shipping_address,
                    },
                )
                logger.info(
                    "Shipment created successfully",
                    extra={
                        "order_id": str(order.id),
                        "attempt": attempt,
                    },
                )
                return response
            except (ServiceUnavailableError, Exception) as e:
                logger.warning(
                    "Shipment creation failed",
                    extra={
                        "order_id": str(order.id),
                        "attempt": attempt,
                        "max_retries": max_retries,
                        "error": str(e),
                    },
                )
                if attempt < max_retries:
                    time.sleep(retry_interval)

        logger.error(
            "All shipment creation attempts failed",
            extra={"order_id": str(order.id), "max_retries": max_retries},
        )
        return None

    def _clear_cart_after_success(self, headers: dict | None) -> None:
        """
        Clear the customer's cart after a successful checkout.

        This is a best-effort operation so a successful order is not rolled back
        if the cart service becomes unavailable after payment succeeds.
        """
        try:
            self._cart_write_client.delete(
                "/api/v1/cart/current/items",
                headers=headers,
            )
        except Exception as exc:
            logger.warning(
                "Cart clear after checkout failed",
                extra={"error": str(exc)},
            )

    def _build_order_response(self, order: Order) -> dict:
        """
        Build the order response dict including items.

        Args:
            order: The Order instance.

        Returns:
            Dict with order data and items list.
        """
        items = order.items.all()
        items_data = [
            {
                "id": str(item.id),
                "product_id": str(item.product_id),
                "product_name": item.product_name,
                "product_sku": item.product_sku,
                "product_image_url": item.product_image_url,
                "unit_price": item.unit_price,
                "quantity": item.quantity,
                "line_total": item.line_total,
            }
            for item in items
        ]

        return {
            "id": str(order.id),
            "user_id": str(order.user_id),
            "status": order.status,
            "subtotal": order.subtotal,
            "shipping_fee": order.shipping_fee,
            "discount_amount": order.discount_amount,
            "total_amount": order.total_amount,
            "shipping_address": order.shipping_address,
            "items": items_data,
            "created_at": order.created_at,
            "updated_at": order.updated_at,
        }
