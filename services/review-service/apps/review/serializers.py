"""
Serializers for Review Service.

Handles input validation and output representation for review endpoints.
"""

from rest_framework import serializers


class CreateReviewInputSerializer(serializers.Serializer):
    """Validates input for creating a review."""

    product_id = serializers.UUIDField(required=True)
    rating = serializers.IntegerField(required=True, min_value=1, max_value=5)
    comment = serializers.CharField(required=True, min_length=1, max_length=2000)


class ReviewOutputSerializer(serializers.Serializer):
    """Output representation for a single review."""

    id = serializers.UUIDField()
    user_id = serializers.UUIDField()
    product_id = serializers.UUIDField()
    rating = serializers.IntegerField()
    comment = serializers.CharField()
    sentiment_label = serializers.CharField(allow_null=True)
    sentiment_score = serializers.FloatField(allow_null=True)
    sentiment_status = serializers.CharField()
    created_at = serializers.DateTimeField()


class ProductReviewsOutputSerializer(serializers.Serializer):
    """Output representation for product reviews with aggregation."""

    average_rating = serializers.FloatField()
    total_reviews = serializers.IntegerField()
    reviews = ReviewOutputSerializer(many=True)
