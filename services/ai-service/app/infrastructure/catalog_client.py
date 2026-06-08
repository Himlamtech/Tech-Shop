"""
HTTP client for the Catalog Service.

Uses the ServiceClient pattern with:
- Configurable timeout (default 5s for validation calls)
- Automatic propagation of Authorization and X-Request-ID headers
- Structured logging of all outgoing requests
- Error classification: 5xx/timeout/connection → ServiceUnavailableError,
  4xx → propagates downstream error code/message
"""

import logging
import time
from typing import Any

import httpx

from app.core.config import get_settings
from app.core.errors import ServiceUnavailableError, TechShopException

logger = logging.getLogger(__name__)


class ServiceClient:
    """
    Async HTTP client wrapper for inter-service communication.

    Mirrors the Django ServiceClient pattern but uses httpx for async support.

    Usage:
        client = ServiceClient(settings.catalog_service_url)
        products = await client.get("/api/v1/products", headers=headers)
    """

    def __init__(self, base_url: str, timeout_seconds: float = 5.0):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout_seconds

    async def get(
        self,
        path: str,
        *,
        headers: dict | None = None,
        params: dict | None = None,
    ) -> dict:
        """Send an async GET request to the target service."""
        return await self._request("GET", path, headers=headers, params=params)

    async def post(
        self,
        path: str,
        *,
        headers: dict | None = None,
        json: dict | None = None,
    ) -> dict:
        """Send an async POST request to the target service."""
        return await self._request("POST", path, headers=headers, json=json)

    async def patch(
        self,
        path: str,
        *,
        headers: dict | None = None,
        json: dict | None = None,
    ) -> dict:
        """Send an async PATCH request to the target service."""
        return await self._request("PATCH", path, headers=headers, json=json)

    async def _request(
        self,
        method: str,
        path: str,
        *,
        headers: dict | None = None,
        params: dict | None = None,
        json: dict | None = None,
    ) -> dict:
        """
        Execute an async HTTP request with timeout, header propagation, and logging.

        Args:
            method: HTTP method (GET, POST, PATCH).
            path: URL path relative to base_url.
            headers: Headers including Authorization and X-Request-ID.
            params: Query parameters.
            json: JSON body payload.

        Returns:
            Parsed JSON response as dict.

        Raises:
            ServiceUnavailableError: On timeout, connection error, or 5xx response.
            TechShopException: On 4xx response (propagates downstream error).
        """
        url = f"{self.base_url}{path}"
        request_headers = self._build_headers(headers)

        start_time = time.time()
        status_code = None

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.request(
                    method=method,
                    url=url,
                    headers=request_headers,
                    params=params,
                    json=json,
                )

            status_code = response.status_code
            duration_ms = round((time.time() - start_time) * 1000, 2)

            self._log_request(method, path, status_code, duration_ms, headers)

            if status_code >= 500:
                raise ServiceUnavailableError(
                    message=f"Service returned {status_code}: {self.base_url}{path}"
                )

            if status_code >= 400:
                self._handle_client_error(response)

            return response.json()

        except httpx.TimeoutException:
            duration_ms = round((time.time() - start_time) * 1000, 2)
            self._log_request(method, path, "TIMEOUT", duration_ms, headers)
            raise ServiceUnavailableError(
                message=f"Request timed out after {self.timeout}s: {self.base_url}{path}"
            )

        except httpx.ConnectError:
            duration_ms = round((time.time() - start_time) * 1000, 2)
            self._log_request(method, path, "CONNECTION_ERROR", duration_ms, headers)
            raise ServiceUnavailableError(
                message=f"Connection refused: {self.base_url}{path}"
            )

    def _build_headers(self, extra_headers: dict | None = None) -> dict:
        """Build request headers with propagated context headers."""
        headers: dict[str, str] = {}

        # Extra headers (including Authorization and X-Request-ID from caller)
        if extra_headers:
            headers.update(extra_headers)

        return headers

    def _handle_client_error(self, response: httpx.Response) -> None:
        """
        Handle 4xx responses by propagating the downstream error.

        Attempts to parse the standard error envelope from the downstream service.
        If parsing fails, raises a generic TechShopException with the status code.
        """
        try:
            data = response.json()
            if "error" in data:
                error = data["error"]
                code = error.get("code", "INTERNAL_ERROR")
                message = error.get("message", "Downstream service error")
                details = error.get("details")

                raise TechShopException(
                    message=message,
                    details=details,
                    error_code=code,
                    http_status=response.status_code,
                )
        except (ValueError, KeyError):
            pass

        raise TechShopException(
            message=f"Downstream service returned {response.status_code}",
            http_status=response.status_code,
        )

    def _log_request(
        self,
        method: str,
        path: str,
        status_code: Any,
        duration_ms: float,
        headers: dict | None = None,
    ) -> None:
        """Log the outgoing service call with structured data."""
        request_id = headers.get("X-Request-ID") if headers else None

        log_data = {
            "target_service": self.base_url,
            "method": method,
            "path": path,
            "status_code": status_code,
            "duration_ms": duration_ms,
            "request_id": request_id,
        }

        if isinstance(status_code, int) and status_code >= 400:
            logger.warning("service_call_completed", extra=log_data)
        else:
            logger.info("service_call_completed", extra=log_data)


class CatalogClient:
    """
    High-level client for the Catalog Service.

    Provides typed methods for common catalog operations used by the AI Service.
    """

    def __init__(self) -> None:
        settings = get_settings()
        self._client = ServiceClient(
            base_url=settings.catalog_service_url,
            timeout_seconds=5.0,
        )

    async def validate_products(
        self,
        product_ids: list[str],
        *,
        authorization: str | None = None,
        request_id: str | None = None,
    ) -> dict:
        """
        Validate a list of product IDs against the Catalog Service.

        Args:
            product_ids: List of product UUIDs to validate.
            authorization: Bearer token for authentication.
            request_id: Request ID for tracing.

        Returns:
            Validation result from the Catalog Service.
        """
        headers: dict[str, str] = {}
        if authorization:
            headers["Authorization"] = authorization
        if request_id:
            headers["X-Request-ID"] = request_id

        return await self._client.post(
            "/api/v1/products/validate-bulk/",
            headers=headers,
            json={"product_ids": product_ids},
        )

    async def get_product(
        self,
        product_id: str,
        *,
        authorization: str | None = None,
        request_id: str | None = None,
    ) -> dict:
        """
        Fetch a single product by ID.

        Args:
            product_id: Product UUID.
            authorization: Bearer token for authentication.
            request_id: Request ID for tracing.

        Returns:
            Product data from the Catalog Service.
        """
        headers: dict[str, str] = {}
        if authorization:
            headers["Authorization"] = authorization
        if request_id:
            headers["X-Request-ID"] = request_id

        return await self._client.get(
            f"/api/v1/products/{product_id}/",
            headers=headers,
        )

    async def get_products(
        self,
        *,
        params: dict | None = None,
        authorization: str | None = None,
        request_id: str | None = None,
    ) -> dict:
        """
        Fetch products with optional filters.

        Args:
            params: Query parameters (page, page_size, category, etc.).
            authorization: Bearer token for authentication.
            request_id: Request ID for tracing.

        Returns:
            Paginated product list from the Catalog Service.
        """
        headers: dict[str, str] = {}
        if authorization:
            headers["Authorization"] = authorization
        if request_id:
            headers["X-Request-ID"] = request_id

        return await self._client.get(
            "/api/v1/products/",
            headers=headers,
            params=params,
        )
