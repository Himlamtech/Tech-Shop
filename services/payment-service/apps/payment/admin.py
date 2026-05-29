from django.contrib import admin

from apps.payment.models import PaymentStatusHistory, PaymentTransaction


@admin.register(PaymentTransaction)
class PaymentTransactionAdmin(admin.ModelAdmin):
    list_display = ("id", "order_id", "amount", "status", "idempotency_key", "created_at")
    list_filter = ("status",)
    search_fields = ("order_id", "idempotency_key")
    readonly_fields = ("id", "created_at", "updated_at")
    ordering = ("-created_at",)


@admin.register(PaymentStatusHistory)
class PaymentStatusHistoryAdmin(admin.ModelAdmin):
    list_display = ("id", "transaction", "from_status", "to_status", "created_at")
    list_filter = ("from_status", "to_status")
    search_fields = ("transaction__order_id",)
    readonly_fields = ("id", "created_at")
    ordering = ("-created_at",)
