"""
Serializers for Order Service.

Handles input validation and output representation for order endpoints.
"""

from rest_framework import serializers


class CheckoutInputSerializer(serializers.Serializer):
    """Validates input for the checkout endpoint."""

    shipping_address = serializers.CharField(required=True, min_length=1, max_length=1000)


class OrderItemOutputSerializer(serializers.Serializer):
    """Output representation for a single order item."""

    id = serializers.UUIDField()
    product_id = serializers.UUIDField()
    product_name = serializers.CharField()
    product_sku = serializers.CharField()
    product_image_url = serializers.URLField()
    unit_price = serializers.DecimalField(max_digits=12, decimal_places=2)
    quantity = serializers.IntegerField()
    line_total = serializers.DecimalField(max_digits=12, decimal_places=2)


class OrderStatusHistoryOutputSerializer(serializers.Serializer):
    """Output representation for an order status history entry."""

    id = serializers.UUIDField()
    from_status = serializers.CharField(allow_null=True)
    to_status = serializers.CharField()
    reason = serializers.CharField(allow_null=True)
    created_at = serializers.DateTimeField()


class OrderListOutputSerializer(serializers.Serializer):
    """Compact output representation for order list endpoint."""

    id = serializers.UUIDField()
    status = serializers.CharField()
    total_amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    item_count = serializers.IntegerField()
    created_at = serializers.DateTimeField()


class OrderOutputSerializer(serializers.Serializer):
    """Output representation for an order."""

    id = serializers.UUIDField()
    user_id = serializers.UUIDField()
    status = serializers.CharField()
    subtotal = serializers.DecimalField(max_digits=12, decimal_places=2)
    shipping_fee = serializers.DecimalField(max_digits=12, decimal_places=2)
    discount_amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    total_amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    shipping_address = serializers.CharField()
    items = OrderItemOutputSerializer(many=True)
    created_at = serializers.DateTimeField()
    updated_at = serializers.DateTimeField()


class OrderDetailOutputSerializer(serializers.Serializer):
    """Full output representation for order detail with items and status history."""

    id = serializers.UUIDField()
    user_id = serializers.UUIDField()
    status = serializers.CharField()
    subtotal = serializers.DecimalField(max_digits=12, decimal_places=2)
    shipping_fee = serializers.DecimalField(max_digits=12, decimal_places=2)
    discount_amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    total_amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    shipping_address = serializers.CharField()
    items = OrderItemOutputSerializer(many=True)
    status_history = OrderStatusHistoryOutputSerializer(many=True)
    created_at = serializers.DateTimeField()
    updated_at = serializers.DateTimeField()


class CancelOrderInputSerializer(serializers.Serializer):
    """Validates input for the cancel order endpoint."""

    reason = serializers.CharField(required=False, max_length=500, allow_blank=True)
