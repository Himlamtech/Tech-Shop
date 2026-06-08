"""URL configuration for Order app."""

from django.urls import path

from apps.order.views import (
    AdminOrderStatsView,
    CheckoutView,
    OrderCompleteView,
    OrderCancelView,
    OrderDetailView,
    OrderListView,
)

urlpatterns = [
    path("checkout", CheckoutView.as_view(), name="order-checkout"),
    path("stats", AdminOrderStatsView.as_view(), name="order-stats"),
    path("", OrderListView.as_view(), name="order-list"),
    path("<uuid:pk>", OrderDetailView.as_view(), name="order-detail"),
    path("<uuid:pk>/cancel", OrderCancelView.as_view(), name="order-cancel"),
    path("<uuid:pk>/complete", OrderCompleteView.as_view(), name="order-complete"),
]

# Admin endpoints are mounted at the config level under /api/v1/admin/
admin_urlpatterns = [
    path("stats", AdminOrderStatsView.as_view(), name="admin-order-stats"),
]
