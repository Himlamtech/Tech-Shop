"""URL configuration for Review app."""

from django.urls import path

from apps.review.views import (
    AdminReviewDetailView,
    AdminReviewListView,
    AdminReviewStatsView,
    ProductReviewsView,
    ReviewCreateView,
)

urlpatterns = [
    path("admin/list", AdminReviewListView.as_view(), name="review-admin-list"),
    path("admin/stats", AdminReviewStatsView.as_view(), name="review-admin-stats"),
    path("admin/<uuid:review_id>", AdminReviewDetailView.as_view(), name="review-admin-detail"),
    path("", ReviewCreateView.as_view(), name="review-create"),
    path("product/<uuid:product_id>", ProductReviewsView.as_view(), name="product-reviews"),
]
