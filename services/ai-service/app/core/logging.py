"""
Structured JSON logging configuration for the AI Service.

Emits single-line JSON log entries with fields:
timestamp, level, service, request_id, user_id, method, path, status_code, duration_ms.
"""

import logging
import sys
from datetime import datetime, timezone
from typing import Any

from app.core.config import get_settings


class JSONFormatter(logging.Formatter):
    """Format log records as single-line JSON objects."""

    def format(self, record: logging.LogRecord) -> str:
        import json

        log_entry: dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "service": get_settings().service_name,
            "logger": record.name,
            "message": record.getMessage(),
        }

        # Add extra fields from structured logging
        for key in (
            "request_id",
            "user_id",
            "method",
            "path",
            "status_code",
            "duration_ms",
            "target_service",
        ):
            value = getattr(record, key, None)
            if value is not None:
                log_entry[key] = value

        # Add exception info if present
        if record.exc_info and record.exc_info[0] is not None:
            log_entry["exception"] = self.formatException(record.exc_info)

        return json.dumps(log_entry, default=str)


def setup_logging() -> None:
    """Configure structured JSON logging for the application."""
    settings = get_settings()

    # Root logger configuration
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, settings.log_level.upper(), logging.INFO))

    # Remove existing handlers
    root_logger.handlers.clear()

    # Console handler with JSON formatter
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JSONFormatter())
    root_logger.addHandler(handler)

    # Reduce noise from third-party libraries
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
