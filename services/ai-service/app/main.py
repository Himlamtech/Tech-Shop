"""
TechShop AI Service — FastAPI application entry point.

Provides AI/ML capabilities:
- RAG chatbot
- Hybrid recommendations
- Sentiment analysis
- Customer segmentation
- Product classification
"""

import logging
import time
import uuid

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.chat import router as chat_router
from app.api.health import router as health_router
from app.api.segmentation import router as segmentation_router
from app.api.sentiment import router as sentiment_router
from app.core.config import get_settings
from app.core.errors import register_exception_handlers
from app.core.logging import setup_logging
from app.infrastructure.db.database import close_db, init_db

# Initialize structured logging before anything else
setup_logging()

logger = logging.getLogger(__name__)
settings = get_settings()


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title="TechShop AI Service",
        description="AI/ML capabilities for the TechShop e-commerce platform",
        version="1.0.0",
        docs_url="/api/ai/docs" if settings.debug else None,
        redoc_url="/api/ai/redoc" if settings.debug else None,
    )

    # -------------------------------------------------------------------------
    # CORS Middleware
    # -------------------------------------------------------------------------
    origins = [
        origin.strip()
        for origin in settings.cors_allowed_origins.split(",")
        if origin.strip()
    ]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # -------------------------------------------------------------------------
    # Request ID + Structured Logging Middleware
    # -------------------------------------------------------------------------
    @app.middleware("http")
    async def request_context_middleware(request: Request, call_next):
        """
        Generate/propagate request ID and log request completion.

        Mirrors the Django RequestIDMiddleware + StructuredLoggingMiddleware.
        """
        # Extract or generate request ID
        request_id = request.headers.get("x-request-id")
        if not request_id:
            request_id = f"req_{uuid.uuid4().hex}"

        request.state.request_id = request_id

        # Extract user info from JWT (set by auth middleware below)
        start_time = time.time()

        response = await call_next(request)

        # Add request ID to response headers
        response.headers["X-Request-ID"] = request_id

        # Structured logging
        duration_ms = round((time.time() - start_time) * 1000, 2)
        user_id = getattr(request.state, "user_id", None)

        log_data = {
            "request_id": request_id,
            "user_id": str(user_id) if user_id else None,
            "method": request.method,
            "path": request.url.path,
            "status_code": response.status_code,
            "duration_ms": duration_ms,
        }

        if response.status_code >= 500:
            logger.error("request_completed", extra=log_data)
        elif response.status_code >= 400:
            logger.warning("request_completed", extra=log_data)
        else:
            logger.info("request_completed", extra=log_data)

        return response

    # -------------------------------------------------------------------------
    # JWT Authentication Middleware
    # -------------------------------------------------------------------------
    @app.middleware("http")
    async def jwt_auth_middleware(request: Request, call_next):
        """
        Extract and validate JWT from the Authorization header.

        On success, sets request.state.user_id and request.state.user_role.
        On failure, sets both to None and lets route-level dependencies
        handle enforcement.

        Public paths (healthz, readyz) skip JWT validation entirely.
        """
        # Initialize state
        request.state.user_id = None
        request.state.user_role = None

        # Skip JWT for infrastructure endpoints
        public_paths = ["/healthz", "/readyz"]
        if request.url.path in public_paths:
            return await call_next(request)

        # Attempt JWT extraction
        auth_header = request.headers.get("authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
            _extract_jwt(request, token)

        return await call_next(request)

    # -------------------------------------------------------------------------
    # Exception Handlers
    # -------------------------------------------------------------------------
    register_exception_handlers(app)

    # -------------------------------------------------------------------------
    # Lifecycle Events
    # -------------------------------------------------------------------------
    @app.on_event("startup")
    async def on_startup():
        """Initialize database and other resources on startup."""
        logger.info("ai_service_starting", extra={"app_env": settings.app_env})
        try:
            await init_db()
            logger.info("database_initialized")
        except Exception as e:
            logger.error("database_init_failed", extra={"error": str(e)})

    @app.on_event("shutdown")
    async def on_shutdown():
        """Clean up resources on shutdown."""
        logger.info("ai_service_shutting_down")
        await close_db()

    # -------------------------------------------------------------------------
    # Routes
    # -------------------------------------------------------------------------
    app.include_router(health_router)
    app.include_router(chat_router)
    app.include_router(sentiment_router)
    app.include_router(segmentation_router)

    return app


def _extract_jwt(request: Request, token: str) -> None:
    """
    Validate JWT token and set user context on request state.

    Supports RS256 (production with public key file) and HS256
    (development with SECRET_KEY) algorithms.
    """
    import jwt as pyjwt

    verification_key, algorithm = _get_verification_key_and_algorithm()
    if not verification_key or not algorithm:
        return

    try:
        payload = pyjwt.decode(
            token,
            verification_key,
            algorithms=[algorithm],
            issuer=settings.jwt_issuer,
            options={"verify_exp": True},
        )
        request.state.user_id = payload.get("user_id")
        request.state.user_role = payload.get("role")
    except pyjwt.ExpiredSignatureError:
        logger.debug("JWT token expired")
    except pyjwt.InvalidTokenError as e:
        logger.debug("JWT validation failed: %s", str(e))


_cached_key: str | None = None
_cached_algorithm: str | None = None


def _get_verification_key_and_algorithm() -> tuple[str | None, str | None]:
    """
    Determine the verification key and algorithm.

    Priority:
    1. RS256 with public key file (production)
    2. HS256 with SECRET_KEY (development fallback)

    Results are cached after first successful load.
    """
    global _cached_key, _cached_algorithm

    if _cached_key is not None:
        return _cached_key, _cached_algorithm

    # Try loading RSA public key
    key_path = settings.jwt_public_key
    if key_path:
        try:
            with open(key_path, "r") as f:
                public_key = f.read().strip()
                if public_key:
                    _cached_key = public_key
                    _cached_algorithm = settings.jwt_algorithm
                    return _cached_key, _cached_algorithm
        except (FileNotFoundError, IOError):
            logger.debug("JWT public key file not found: %s", key_path)

    # Fallback to HS256 with SECRET_KEY for development
    if settings.secret_key:
        _cached_key = settings.secret_key
        _cached_algorithm = "HS256"
        logger.info(
            "JWT validation using HS256 fallback (no public key file available)"
        )
        return _cached_key, _cached_algorithm

    # No verification key available
    logger.warning("No JWT verification key available")
    return None, None


# Create the application instance
app = create_app()
