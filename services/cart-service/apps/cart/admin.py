from django.contrib import admin

from apps.cart.models import Cart, CartItem


class CartItemInline(admin.TabularInline):
    model = CartItem
    extra = 0
    readonly_fields = ("id", "created_at", "updated_at")


@admin.register(Cart)
class CartAdmin(admin.ModelAdmin):
    list_display = ("id", "user_id", "created_at", "updated_at")
    search_fields = ("user_id",)
    readonly_fields = ("id", "created_at", "updated_at")
    inlines = [CartItemInline]


@admin.register(CartItem)
class CartItemAdmin(admin.ModelAdmin):
    list_display = ("id", "cart", "product_id", "quantity", "created_at", "updated_at")
    list_filter = ("cart",)
    search_fields = ("product_id",)
    readonly_fields = ("id", "created_at", "updated_at")
