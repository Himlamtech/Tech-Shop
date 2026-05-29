"""
Standard API response envelope helpers for the AI Service.

Matches the format used across all TechShop services:
- Success: {"success": true, "data": ..., "meta": {"request_id": ...}}
- Error: {"success": false, "error": {"code": ..., "message": ..., "details": ...}, "meta": {"request_id": ...}}
"""

from typing import Any

from starlette.requests import Request


def get_request_id(request: Request | None = None) -> str | None:
    """Extract request_id from the current request state."""
    if request and hasattr(request.state, "request_id"):
        return request.state.request_id
    return None


def success_response(
    data: Any,
    meta: dict | None = None,
    request: Request | None = None,
) -> dict:
    """
    Build a standard success response envelope.

    Args:
        data: The response payload (dict, list, or None).
        meta: Optional additional metadata to include.
        request: The current request (for request_id extraction).

    Returns:
        Dict with standard envelope format.
    """
    response_meta: dict[str, Any] = {"request_id": get_request_id(request)}
    if meta:
        response_meta.update(meta)

    return {
        "success": True,
        "data": data,
        "meta": response_meta,
    }


def error_response(
    code: str,
    message: str,
    details: Any = None,
    request: Request | None = None,
) -> dict:
    """
    Build a standard error response envelope.

    Args:
        code: Machine-readable error code (e.g., "VALIDATION_ERROR").
        message: Human-readable error message.
        details: Optional additional error details.
        request: The current request (for request_id extraction).

    Returns:
        Dict with standard error envelope format.
    """
    response_meta: dict[str, Any] = {"request_id": get_request_id(request)}

    error_body: dict[str, Any] = {
        "code": code,
        "message": message,
    }
    if details is not None:
        error_body["details"] = details

    return {
        "success": False,
        "error": error_body,
        "meta": response_meta,
    }
