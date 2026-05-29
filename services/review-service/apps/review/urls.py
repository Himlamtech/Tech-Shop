"""URL configuration for Review app."""

from django.urls import path

from apps.review.views import ProductReviewsView, ReviewCreateView

urlpatterns = [
    path("", ReviewCreateView.as_view(), name="review-create"),
    path("product/<uuid:product_id>", ProductReviewsView.as_view(), name="product-reviews"),
]
