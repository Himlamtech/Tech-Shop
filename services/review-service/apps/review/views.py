"""
API views for the Review Service.

Handles HTTP request/response layer with no business logic.
All responses use the standard envelope format.
"""

import math
from django.db.models import Avg, Count

from rest_framework.views import APIView

from apps.core.exceptions import NotFoundError, ValidationError
from apps.core.pagination import StandardPagination
from apps.core.permissions import IsAdmin, IsAuthenticated
from apps.core.request_context import get_current_request_id
from apps.core.responses import success_response
from apps.review.models import Review
from apps.review.serializers import (
    CreateReviewInputSerializer,
    ReviewOutputSerializer,
    ReviewStatsSerializer,
)
from apps.review.services import ReviewService


class ReviewCreateView(APIView):
    """
    POST /api/v1/reviews — Create a new product review.

    Requires authentication. Verifies purchase via Order Service,
    performs sentiment analysis via AI Service, and stores the review.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = CreateReviewInputSerializer(data=request.data)
        if not serializer.is_valid():
            raise ValidationError(
                message="Invalid request data",
                details=_format_serializer_errors(serializer.errors),
            )

        data = serializer.validated_data
        service = ReviewService(
            authorization_header=request.META.get("HTTP_AUTHORIZATION")
        )

        review = service.create_review(
            user_id=str(request.user_id),
            product_id=str(data["product_id"]),
            rating=data["rating"],
            comment=data["comment"],
        )

        output_serializer = ReviewOutputSerializer(review)
        return success_response(output_serializer.data, status=201)


class ProductReviewsView(APIView):
    """
    GET /api/v1/reviews/product/{product_id} — Get paginated reviews for a product.

    Public endpoint (no authentication required).
    Returns reviews sorted by newest first with average rating and total count.
    """

    permission_classes = []

    def get(self, request, product_id):
        service = ReviewService()

        # Parse pagination params
        page = self._get_positive_int(request.query_params.get("page"), default=1)
        page_size = self._get_positive_int(request.query_params.get("page_size"), default=10)
        page_size = min(page_size, 50)  # Max 50

        # Get reviews queryset
        queryset = service.get_reviews_for_product(str(product_id))

        # Get stats
        stats = service.get_product_review_stats(str(product_id))

        # Manual pagination
        total = queryset.count()
        total_pages = math.ceil(total / page_size) if page_size > 0 else 0
        offset = (page - 1) * page_size
        reviews = queryset[offset:offset + page_size]

        # Serialize
        output_serializer = ReviewOutputSerializer(reviews, many=True)

        response_data = {
            "average_rating": stats["average_rating"],
            "total_reviews": stats["total_reviews"],
            "reviews": output_serializer.data,
        }

        meta = {
            "request_id": get_current_request_id(),
            "pagination": {
                "page": page,
                "page_size": page_size,
                "total": total,
                "total_pages": total_pages,
            },
        }

        return success_response(response_data, meta=meta)


class AdminReviewListView(APIView):
    """GET /api/v1/reviews/admin/list — Admin review list with filters."""

    permission_classes = [IsAdmin]

    def get(self, request):
        queryset = Review.objects.all().order_by("-created_at")

        sentiment_status = request.query_params.get("sentiment_status")
        sentiment_label = request.query_params.get("sentiment_label")
        hidden = request.query_params.get("is_hidden")
        product_id = request.query_params.get("product_id")

        if sentiment_status in {"pending", "completed"}:
            queryset = queryset.filter(sentiment_status=sentiment_status)
        if sentiment_label:
            queryset = queryset.filter(sentiment_label=sentiment_label)
        if hidden in {"true", "false"}:
            queryset = queryset.filter(is_hidden=(hidden == "true"))
        if product_id:
            queryset = queryset.filter(product_id=product_id)

        paginator = StandardPagination()
        page = paginator.paginate_queryset(queryset, request)
        serializer = ReviewOutputSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class AdminReviewDetailView(APIView):
    """GET/DELETE admin review detail and moderation."""

    permission_classes = [IsAdmin]

    def get(self, request, review_id):
        review = _get_review_or_404(review_id)
        serializer = ReviewOutputSerializer(review)
        return success_response(serializer.data)

    def delete(self, request, review_id):
        review = _get_review_or_404(review_id)
        serialized = ReviewOutputSerializer(review).data
        review.delete()
        return success_response({"deleted": True, "review": serialized})


class AdminReviewStatsView(APIView):
    """GET /api/v1/reviews/admin/stats — Admin review statistics."""

    permission_classes = [IsAdmin]

    def get(self, request):
        queryset = Review.objects.all()
        total_reviews = queryset.count()
        average_rating = queryset.aggregate(avg=Avg("rating"))["avg"] or 0.0
        sentiment_groups = (
            queryset.values("sentiment_label")
            .annotate(count=Count("id"))
            .order_by("sentiment_label")
        )

        data = {
            "total_reviews": total_reviews,
            "average_rating": round(float(average_rating), 2) if average_rating else 0.0,
            "reviews_by_sentiment": {
                (item["sentiment_label"] or "unknown"): item["count"]
                for item in sentiment_groups
            },
        }
        output = ReviewStatsSerializer(data).data
        return success_response(output)

    def _get_positive_int(self, value, default=1):
        """Parse a positive integer from query param, returning default if invalid."""
        if value is None:
            return default
        try:
            val = int(value)
            return val if val > 0 else default
        except (ValueError, TypeError):
            return default


# =============================================================================
# Private Helpers
# =============================================================================


def _format_serializer_errors(errors):
    """Convert DRF serializer errors to list of {field, reason} dicts."""
    details = []
    for field, messages in errors.items():
        if isinstance(messages, list):
            for msg in messages:
                details.append({"field": field, "reason": str(msg)})
        else:
            details.append({"field": field, "reason": str(messages)})
    return details


def _get_review_or_404(review_id):
    try:
        return Review.objects.get(id=review_id)
    except Review.DoesNotExist as exc:
        raise NotFoundError("Review not found") from exc
