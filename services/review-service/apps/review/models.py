"""
Review model for TechShop Review Service.

Stores product reviews with optional AI-generated sentiment analysis.
"""

import uuid

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


class Review(models.Model):
    """
    Product review submitted by a customer.

    Each customer can submit only one review per product (enforced by unique constraint).
    Sentiment analysis is performed asynchronously via the AI Service.
    """

    SENTIMENT_STATUS_CHOICES = [
        ("completed", "Completed"),
        ("pending", "Pending"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user_id = models.UUIDField(db_index=True)
    product_id = models.UUIDField(db_index=True)
    rating = models.IntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)],
    )
    comment = models.TextField(max_length=2000)
    sentiment_label = models.CharField(max_length=20, null=True, blank=True)
    sentiment_score = models.FloatField(null=True, blank=True)
    sentiment_status = models.CharField(
        max_length=10,
        choices=SENTIMENT_STATUS_CHOICES,
        default="pending",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "reviews"
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["user_id", "product_id"],
                name="unique_user_product_review",
            ),
        ]

    def __str__(self):
        return f"Review {self.id} - Product {self.product_id} by User {self.user_id}"
