import uuid

from django.db import models


class PaymentTransaction(models.Model):
    """Represents a payment transaction linked to an order.

    Uses idempotency_key to ensure duplicate payment requests
    for the same order return the same result.
    """

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        SUCCESS = "success", "Success"
        FAILED = "failed", "Failed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order_id = models.UUIDField()
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    status = models.CharField(
        max_length=10,
        choices=Status.choices,
        default=Status.PENDING,
    )
    idempotency_key = models.CharField(max_length=255, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "payment_transactions"
        ordering = ["-created_at"]

    def __str__(self):
        return f"PaymentTransaction(order={self.order_id}, status={self.status})"


class PaymentStatusHistory(models.Model):
    """Tracks status transitions for payment transactions."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    transaction = models.ForeignKey(
        PaymentTransaction,
        on_delete=models.CASCADE,
        related_name="status_history",
    )
    from_status = models.CharField(max_length=10)
    to_status = models.CharField(max_length=10)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "payment_status_history"
        ordering = ["-created_at"]

    def __str__(self):
        return f"StatusHistory(tx={self.transaction_id}, {self.from_status} -> {self.to_status})"
