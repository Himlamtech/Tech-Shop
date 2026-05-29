"""
Custom exception classes for TechShop services.

Each exception maps to a specific error code and HTTP status,
ensuring consistent error responses across all services.
"""

from rest_framework.views import exception_handler as drf_exception_handler

from apps.core.request_context import get_current_request_id


class TechShopException(Exception):
    """Base exception for all TechShop services."""

    error_code = "INTERNAL_ERROR"
    http_status = 500
    message = "An unexpected error occurred"

    def __init__(self, message=None, details=None):
        self.message = message or self.__class__.message
        self.details = details
        super().__init__(self.message)


class ValidationError(TechShopException):
    """Raised when input validation fails."""

    error_code = "VALIDATION_ERROR"
    http_status = 422
    message = "Invalid request data"


class NotFoundError(TechShopException):
    """Raised when a requested resource does not exist."""

    error_code = "NOT_FOUND"
    http_status = 404
    message = "Resource not found"


class ForbiddenError(TechShopException):
    """Raised when the user lacks permission for the requested action."""

    error_code = "FORBIDDEN"
    http_status = 403
    message = "You do not have permission to perform this action"


class UnauthorizedError(TechShopException):
    """Raised when authentication is missing or invalid."""

    error_code = "UNAUTHORIZED"
    http_status = 401
    message = "Authentication credentials were not provided or are invalid"


class ProductOutOfStockError(TechShopException):
    """Raised when a product is out of stock or has insufficient quantity."""

    error_code = "PRODUCT_OUT_OF_STOCK"
    http_status = 422
    message = "Product is out of stock"


class ServiceUnavailableError(TechShopException):
    """Raised when a downstream service is unreachable or returns 5xx."""

    error_code = "SERVICE_UNAVAILABLE"
    http_status = 503
    message = "A required service is temporarily unavailable"


class PaymentFailedError(TechShopException):
    """Raised when a payment transaction fails."""

    error_code = "PAYMENT_FAILED"
    http_status = 502
    message = "Payment processing failed"


class ConflictError(TechShopException):
    """Raised when a resource conflict occurs (e.g., duplicate entry)."""

    error_code = "CONFLICT"
    http_status = 409
    message = "Resource conflict"


def custom_exception_handler(exc, context):
    """
    Custom DRF exception handler that wraps all errors in the standard envelope.

    Handles:
    - TechShopException subclasses → mapped to their error_code and http_status
    - DRF built-in exceptions → mapped to appropriate error codes
    - Unhandled exceptions → 500 INTERNAL_ERROR
    """
    # Handle TechShop custom exceptions
    if isinstance(exc, TechShopException):
        from rest_framework.response import Response

        error_body = {
            "code": exc.error_code,
            "message": exc.message,
        }
        if exc.details is not None:
            error_body["details"] = exc.details

        body = {
            "success": False,
            "error": error_body,
            "meta": {"request_id": get_current_request_id()},
        }
        return Response(body, status=exc.http_status)

    # Let DRF handle its own exceptions first
    response = drf_exception_handler(exc, context)

    if response is not None:
        # Map DRF exceptions to our standard envelope
        error_code = _map_drf_status_to_code(response.status_code)
        message = _extract_drf_message(response.data)
        details = _extract_drf_details(response.data)

        body = {
            "success": False,
            "error": {
                "code": error_code,
                "message": message,
            },
            "meta": {"request_id": get_current_request_id()},
        }
        if details:
            body["error"]["details"] = details

        response.data = body
        return response

    # Unhandled exception — return 500
    from rest_framework.response import Response

    body = {
        "success": False,
        "error": {
            "code": "INTERNAL_ERROR",
            "message": "An unexpected error occurred",
        },
        "meta": {"request_id": get_current_request_id()},
    }
    return Response(body, status=500)


def _map_drf_status_to_code(status_code):
    """Map HTTP status codes to TechShop error codes."""
    mapping = {
        400: "VALIDATION_ERROR",
        401: "UNAUTHORIZED",
        403: "FORBIDDEN",
        404: "NOT_FOUND",
        405: "VALIDATION_ERROR",
        409: "CONFLICT",
        422: "VALIDATION_ERROR",
        429: "VALIDATION_ERROR",
        500: "INTERNAL_ERROR",
    }
    return mapping.get(status_code, "INTERNAL_ERROR")


def _extract_drf_message(data):
    """Extract a human-readable message from DRF error data."""
    if isinstance(data, dict):
        if "detail" in data:
            return str(data["detail"])
        # Field-level errors
        return "Invalid request data"
    if isinstance(data, list):
        return str(data[0]) if data else "Invalid request data"
    return str(data)


def _extract_drf_details(data):
    """Extract field-level error details from DRF error data."""
    if isinstance(data, dict):
        if "detail" in data:
            return None
        # Convert field errors to list of {field, reason} dicts
        details = []
        for field, errors in data.items():
            if isinstance(errors, list):
                for error in errors:
                    details.append({"field": field, "reason": str(error)})
            else:
                details.append({"field": field, "reason": str(errors)})
        return details if details else None
    return None
