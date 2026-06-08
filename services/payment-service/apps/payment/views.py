"""API views for the Payment Service."""

from django.db.models import Count, Sum

from rest_framework.views import APIView

from apps.core.exceptions import NotFoundError, ValidationError
from apps.core.pagination import StandardPagination
from apps.core.permissions import IsAdmin
from apps.core.responses import success_response
from apps.payment.serializers import (
    CreatePaymentSerializer,
    PaymentStatsSerializer,
    PaymentTransactionSerializer,
)
from apps.payment.models import PaymentTransaction
from apps.payment.services import PaymentService


class PaymentCreateView(APIView):
    """
    POST /api/v1/payments/ — Create a payment transaction.

    Requires order_id, amount, and idempotency_key.
    Returns existing transaction if idempotency_key already exists.
    """

    permission_classes = []

    def post(self, request):
        serializer = CreatePaymentSerializer(data=request.data)
        if not serializer.is_valid():
            raise ValidationError(
                message="Invalid payment data",
                details=_format_serializer_errors(serializer.errors),
            )

        data = serializer.validated_data
        payment_transaction = PaymentService.create_payment(
            order_id=data["order_id"],
            amount=data["amount"],
            idempotency_key=data["idempotency_key"],
        )

        # Reload with status history
        payment_transaction = _reload_with_history(payment_transaction.id)
        output = PaymentTransactionSerializer(payment_transaction).data
        return success_response(output, status=201)


class PaymentSimulateSuccessView(APIView):
    """
    POST /api/v1/payments/{id}/simulate-success/ — Simulate payment success.

    Transitions a pending payment to success and records status history.
    """

    permission_classes = [IsAdmin]

    def post(self, request, pk):
        payment_transaction = PaymentService.simulate_success(transaction_id=pk)

        # Reload with status history
        payment_transaction = _reload_with_history(payment_transaction.id)
        output = PaymentTransactionSerializer(payment_transaction).data
        return success_response(output)


class PaymentSimulateFailureView(APIView):
    """
    POST /api/v1/payments/{id}/simulate-failure/ — Simulate payment failure.

    Transitions a pending payment to failed and records status history.
    """

    permission_classes = [IsAdmin]

    def post(self, request, pk):
        payment_transaction = PaymentService.simulate_failure(transaction_id=pk)

        # Reload with status history
        payment_transaction = _reload_with_history(payment_transaction.id)
        output = PaymentTransactionSerializer(payment_transaction).data
        return success_response(output)


class PaymentAdminListView(APIView):
    """GET /api/v1/payments/ — Admin list of payment transactions."""

    permission_classes = [IsAdmin]

    def get(self, request):
        queryset = _get_filtered_transactions(request)

        paginator = StandardPagination()
        page = paginator.paginate_queryset(queryset, request)

        serializer = PaymentTransactionSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class PaymentAdminDetailView(APIView):
    """GET /api/v1/payments/{id}/ — Admin payment detail."""

    permission_classes = [IsAdmin]

    def get(self, request, pk):
        payment_transaction = _get_transaction_or_404(pk)
        output = PaymentTransactionSerializer(payment_transaction).data
        return success_response(output)


class PaymentAdminStatsView(APIView):
    """GET /api/v1/payments/stats/ — Admin payment statistics."""

    permission_classes = [IsAdmin]

    def get(self, request):
        queryset = _get_filtered_transactions(request)
        total_transactions = queryset.count()
        total_amount = queryset.aggregate(total=Sum("amount"))["total"] or "0.00"
        successful_amount = (
            queryset.filter(status="success").aggregate(total=Sum("amount"))["total"]
            or "0.00"
        )
        status_counts = (
            queryset.values("status").annotate(count=Count("id")).order_by("status")
        )

        data = {
            "total_transactions": total_transactions,
            "total_amount": total_amount,
            "successful_amount": successful_amount,
            "transactions_by_status": {
                item["status"]: item["count"] for item in status_counts
            },
        }
        output = PaymentStatsSerializer(data).data
        return success_response(output)


# =============================================================================
# Private Helpers
# =============================================================================


def _reload_with_history(transaction_id):
    """Reload a payment transaction with its status history prefetched."""
    return (
        PaymentTransaction.objects.prefetch_related("status_history")
        .get(id=transaction_id)
    )


def _get_transaction_or_404(transaction_id):
    try:
        return _reload_with_history(transaction_id)
    except PaymentTransaction.DoesNotExist as exc:
        raise NotFoundError("Payment transaction not found") from exc


def _get_filtered_transactions(request):
    queryset = PaymentTransaction.objects.prefetch_related("status_history").all()

    status_filter = request.query_params.get("status")
    order_id = request.query_params.get("order_id")

    if status_filter in {choice for choice, _ in PaymentTransaction.Status.choices}:
        queryset = queryset.filter(status=status_filter)

    if order_id:
        queryset = queryset.filter(order_id=order_id)

    return queryset.order_by("-created_at")


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
