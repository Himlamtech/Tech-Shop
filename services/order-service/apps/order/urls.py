"""URL configuration for Order app."""

from django.urls import path

from apps.order.views import CheckoutView, OrderCancelView, OrderDetailView, OrderListView

urlpatterns = [
    path("checkout", CheckoutView.as_view(), name="order-checkout"),
    path("", OrderListView.as_view(), name="order-list"),
    path("<uuid:pk>", OrderDetailView.as_view(), name="order-detail"),
    path("<uuid:pk>/cancel", OrderCancelView.as_view(), name="order-cancel"),
]
