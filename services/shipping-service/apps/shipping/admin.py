from django.contrib import admin

from apps.shipping.models import Shipment, ShipmentStatusHistory


class ShipmentStatusHistoryInline(admin.TabularInline):
    model = ShipmentStatusHistory
    extra = 0
    readonly_fields = ("from_status", "to_status", "created_at")


@admin.register(Shipment)
class ShipmentAdmin(admin.ModelAdmin):
    list_display = ("tracking_code", "order_id", "status", "created_at", "updated_at")
    list_filter = ("status",)
    search_fields = ("tracking_code", "order_id")
    readonly_fields = ("id", "created_at", "updated_at")
    inlines = [ShipmentStatusHistoryInline]


@admin.register(ShipmentStatusHistory)
class ShipmentStatusHistoryAdmin(admin.ModelAdmin):
    list_display = ("shipment", "from_status", "to_status", "created_at")
    list_filter = ("from_status", "to_status")
    readonly_fields = ("id", "created_at")
