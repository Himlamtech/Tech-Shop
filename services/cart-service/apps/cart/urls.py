"""URL configuration for Cart app."""

from django.urls import path

from apps.cart.views import CartClearView, CartDetailView, CartItemDetailView, CartItemListView

urlpatterns = [
    path("current", CartDetailView.as_view(), name="cart-current"),
    path("current/items", CartClearView.as_view(), name="cart-clear"),
    path("items", CartItemListView.as_view(), name="cart-items"),
    path("items/<uuid:pk>", CartItemDetailView.as_view(), name="cart-item-detail"),
]
