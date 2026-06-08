"""
ServiceClient wrapper for inter-service HTTP communication.

Provides:
- Configurable timeout (default 3s)
- Automatic propagation of Authorization and X-Request-ID headers
- Structured logging of all outgoing requests
- Error classification: 5xx/timeout/connection → ServiceUnavailableError,
  4xx → propagates downstream error code/message
"""

import logging
import time

import requests

from apps.core.exceptions import ServiceUnavailableError, TechShopException
from apps.core.request_context import get_current_request_id

logger = logging.getLogger(__name__)


class ServiceClient:
    """
    HTTP client wrapper for inter-service communication.

    Usage:
        from django.conf import settings
        from apps.core.http_client import ServiceClient

        catalog_client = ServiceClient(settings.CATALOG_SERVICE_URL)
        products = catalog_client.get("/api/v1/products", params={"page": 1})
    """

    def __init__(self, base_url: str, timeout_seconds: float = 3.0):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout_seconds

    def get(self, path: str, *, headers: dict | None = None, params: dict | None = None) -> dict:
        """Send a GET request to the target service."""
        return self._request("GET", path, headers=headers, params=params)

    def post(self, path: str, *, headers: dict | None = None, json: dict | None = None) -> dict:
        """Send a POST request to the target service."""
        return self._request("POST", path, headers=headers, json=json)

    def patch(self, path: str, *, headers: dict | None = None, json: dict | None = None) -> dict:
        """Send a PATCH request to the target service."""
        return self._request("PATCH", path, headers=headers, json=json)

    def delete(self, path: str, *, headers: dict | None = None, json: dict | None = None) -> dict:
        """Send a DELETE request to the target service."""
        return self._request("DELETE", path, headers=headers, json=json)

    def _request(
        self,
        method: str,
        path: str,
        *,
        headers: dict | None = None,
        params: dict | None = None,
        json: dict | None = None,
    ) -> dict:
        """
        Execute an HTTP request with timeout, header propagation, and logging.

        Args:
            method: HTTP method (GET, POST, PATCH, DELETE).
            path: URL path relative to base_url.
            headers: Additional headers to include.
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
            response = requests.request(
                method=method,
                url=url,
                headers=request_headers,
                params=params,
                json=json,
                timeout=self.timeout,
            )
            status_code = response.status_code
            duration_ms = round((time.time() - start_time) * 1000, 2)

            self._log_request(method, path, status_code, duration_ms)

            if status_code >= 500:
                raise ServiceUnavailableError(
                    message=f"Service returned {status_code}: {self.base_url}{path}"
                )

            if status_code >= 400:
                self._handle_client_error(response)

            return response.json()

        except requests.Timeout:
            duration_ms = round((time.time() - start_time) * 1000, 2)
            self._log_request(method, path, "TIMEOUT", duration_ms)
            raise ServiceUnavailableError(
                message=f"Request timed out after {self.timeout}s: {self.base_url}{path}"
            )

        except requests.ConnectionError:
            duration_ms = round((time.time() - start_time) * 1000, 2)
            self._log_request(method, path, "CONNECTION_ERROR", duration_ms)
            raise ServiceUnavailableError(
                message=f"Connection refused: {self.base_url}{path}"
            )

    def _build_headers(self, extra_headers: dict | None = None) -> dict:
        """Build request headers with propagated context headers."""
        headers = {}

        # Propagate request ID
        request_id = get_current_request_id()
        if request_id:
            headers["X-Request-ID"] = request_id

        # Extra headers (including Authorization from caller)
        if extra_headers:
            headers.update(extra_headers)

        return headers

    def _handle_client_error(self, response):
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

                exc = TechShopException(message=message, details=details)
                exc.error_code = code
                exc.http_status = response.status_code
                raise exc
        except (ValueError, KeyError):
            pass

        # Fallback for non-standard error responses
        exc = TechShopException(
            message=f"Downstream service returned {response.status_code}"
        )
        exc.http_status = response.status_code
        raise exc

    def _log_request(self, method, path, status_code, duration_ms):
        """Log the outgoing service call with structured data."""
        log_data = {
            "target_service": self.base_url,
            "method": method,
            "path": path,
            "status_code": status_code,
            "duration_ms": duration_ms,
            "request_id": get_current_request_id(),
        }

        if isinstance(status_code, int) and status_code >= 400:
            logger.warning("service_call_completed", extra=log_data)
        else:
            logger.info("service_call_completed", extra=log_data)
