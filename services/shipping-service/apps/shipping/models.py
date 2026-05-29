import uuid

from django.core.validators import RegexValidator
from django.db import models


# Forward-only shipment status transitions
SHIPMENT_TRANSITIONS = {
    "processing": ["shipping"],
    "shipping": ["delivered"],
}


class Shipment(models.Model):
    """
    Represents a shipment associated with an order.
    Status transitions are forward-only: processing → shipping → delivered.
    """

    STATUS_CHOICES = [
        ("processing", "Processing"),
        ("shipping", "Shipping"),
        ("delivered", "Delivered"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order_id = models.UUIDField(unique=True)
    tracking_code = models.CharField(
        max_length=20,
        unique=True,
        validators=[
            RegexValidator(
                regex=r"^[A-Za-z0-9]{8,20}$",
                message="Tracking code must be 8-20 alphanumeric characters.",
            ),
        ],
    )
    status = models.CharField(
        max_length=10,
        choices=STATUS_CHOICES,
        default="processing",
    )
    shipping_address = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "shipments"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status"], name="idx_shipment_status"),
            models.Index(fields=["order_id"], name="idx_shipment_order_id"),
        ]

    def __str__(self):
        return f"Shipment {self.tracking_code} ({self.status})"


class ShipmentStatusHistory(models.Model):
    """
    Tracks status transitions for a shipment.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    shipment = models.ForeignKey(
        Shipment,
        on_delete=models.CASCADE,
        related_name="status_history",
    )
    from_status = models.CharField(max_length=10)
    to_status = models.CharField(max_length=10)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "shipment_status_history"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.shipment.tracking_code}: {self.from_status} → {self.to_status}"
