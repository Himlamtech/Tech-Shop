"""
Standard API response envelope for TechShop services.

All API responses follow a consistent format:
- Success: {"success": true, "data": ..., "meta": {"request_id": ...}}
- Error: {"success": false, "error": {"code": ..., "message": ..., "details": ...}, "meta": {"request_id": ...}}
"""

from rest_framework.response import Response

from apps.core.request_context import get_current_request_id


def success_response(data, meta=None, status=200):
    """
    Build a standard success response envelope.

    Args:
        data: The response payload (dict, list, or None).
        meta: Optional additional metadata to include.
        status: HTTP status code (default 200).

    Returns:
        DRF Response with standard envelope format.
    """
    response_meta = {"request_id": get_current_request_id()}
    if meta:
        response_meta.update(meta)

    body = {
        "success": True,
        "data": data,
        "meta": response_meta,
    }
    return Response(body, status=status)


def error_response(code, message, details=None, status=400):
    """
    Build a standard error response envelope.

    Args:
        code: Machine-readable error code (e.g., "VALIDATION_ERROR").
        message: Human-readable error message.
        details: Optional additional error details (dict or list).
        status: HTTP status code (default 400).

    Returns:
        DRF Response with standard error envelope format.
    """
    response_meta = {"request_id": get_current_request_id()}

    error_body = {
        "code": code,
        "message": message,
    }
    if details is not None:
        error_body["details"] = details

    body = {
        "success": False,
        "error": error_body,
        "meta": response_meta,
    }
    return Response(body, status=status)
