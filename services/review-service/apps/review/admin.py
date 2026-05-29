"""Admin configuration for Review app."""

from django.contrib import admin

from apps.review.models import Review


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = [
        "id",
        "user_id",
        "product_id",
        "rating",
        "sentiment_label",
        "sentiment_status",
        "created_at",
    ]
    list_filter = ["rating", "sentiment_status", "sentiment_label"]
    search_fields = ["user_id", "product_id"]
    readonly_fields = ["id", "created_at"]
    ordering = ["-created_at"]
