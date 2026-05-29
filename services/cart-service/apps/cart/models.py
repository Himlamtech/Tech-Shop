import uuid

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


class Cart(models.Model):
    """
    Shopping cart for a customer. One cart per user (enforced by unique user_id).
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user_id = models.UUIDField(unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "carts"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Cart for user {self.user_id}"


class CartItem(models.Model):
    """
    Item in a shopping cart. Quantity constrained to 1-99.
    Constraint: unique(cart_id, product_id) — one entry per product per cart.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    cart = models.ForeignKey(
        Cart,
        on_delete=models.CASCADE,
        related_name="items",
    )
    product_id = models.UUIDField()
    quantity = models.PositiveIntegerField(
        validators=[
            MinValueValidator(1),
            MaxValueValidator(99),
        ],
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "cart_items"
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["cart", "product_id"],
                name="unique_product_per_cart",
            ),
        ]

    def __str__(self):
        return f"CartItem(product={self.product_id}, qty={self.quantity})"
