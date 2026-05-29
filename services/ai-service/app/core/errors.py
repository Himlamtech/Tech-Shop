"""
Exception classes and FastAPI exception handlers for the AI Service.

Maps custom exceptions to the standard error envelope format.
Error codes match the TechShop error code registry.
"""

import logging
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.core.responses import error_response

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Custom Exception Hierarchy
# ---------------------------------------------------------------------------


class TechShopException(Exception):
    """Base exception for all TechShop AI Service errors."""

    error_code: str = "INTERNAL_ERROR"
    http_status: int = 500
    message: str = "An unexpected error occurred"

    def __init__(
        self,
        message: str | None = None,
        details: Any = None,
        error_code: str | None = None,
        http_status: int | None = None,
    ):
        self.message = message or self.__class__.message
        self.details = details
        if error_code:
            self.error_code = error_code
        if http_status:
            self.http_status = http_status
        super().__init__(self.message)


class ValidationError(TechShopException):
    """Invalid input data or constraint violations."""

    error_code = "VALIDATION_ERROR"
    http_status = 422
    message = "Validation failed"


class NotFoundError(TechShopException):
    """Resource does not exist or is inactive."""

    error_code = "NOT_FOUND"
    http_status = 404
    message = "Resource not found"


class UnauthorizedError(TechShopException):
    """Missing, invalid, or expired authentication."""

    error_code = "UNAUTHORIZED"
    http_status = 401
    message = "Authentication required"


class ForbiddenError(TechShopException):
    """Valid token but insufficient permissions."""

    error_code = "FORBIDDEN"
    http_status = 403
    message = "Insufficient permissions"


class ConflictError(TechShopException):
    """Duplicate resource conflict."""

    error_code = "CONFLICT"
    http_status = 409
    message = "Resource conflict"


class ServiceUnavailableError(TechShopException):
    """Downstream service timeout, 5xx, or connection refused."""

    error_code = "SERVICE_UNAVAILABLE"
    http_status = 503
    message = "Service temporarily unavailable"


class AINoContextFoundError(TechShopException):
    """RAG retrieval below similarity threshold."""

    error_code = "AI_NO_CONTEXT_FOUND"
    http_status = 503
    message = "No relevant context found for the query"


# ---------------------------------------------------------------------------
# Exception Handlers
# ---------------------------------------------------------------------------


def register_exception_handlers(app: FastAPI) -> None:
    """Register all exception handlers on the FastAPI app."""

    @app.exception_handler(TechShopException)
    async def techshop_exception_handler(
        request: Request, exc: TechShopException
    ) -> JSONResponse:
        """Handle all TechShop custom exceptions."""
        logger.warning(
            "techshop_exception",
            extra={
                "request_id": getattr(request.state, "request_id", None),
                "error_code": exc.error_code,
                "message": exc.message,
            },
        )
        body = error_response(
            code=exc.error_code,
            message=exc.message,
            details=exc.details,
            request=request,
        )
        return JSONResponse(status_code=exc.http_status, content=body)

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        """Handle FastAPI/Pydantic request validation errors."""
        details = []
        for error in exc.errors():
            field = ".".join(str(loc) for loc in error["loc"] if loc != "body")
            details.append({"field": field, "reason": error["msg"]})

        body = error_response(
            code="VALIDATION_ERROR",
            message="Request validation failed",
            details=details,
            request=request,
        )
        return JSONResponse(status_code=422, content=body)

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(
        request: Request, exc: Exception
    ) -> JSONResponse:
        """Catch-all handler for unexpected exceptions."""
        logger.error(
            "unhandled_exception",
            extra={
                "request_id": getattr(request.state, "request_id", None),
                "error_type": type(exc).__name__,
                "error_message": str(exc),
            },
            exc_info=True,
        )
        body = error_response(
            code="INTERNAL_ERROR",
            message="An unexpected error occurred",
            request=request,
        )
        return JSONResponse(status_code=500, content=body)
