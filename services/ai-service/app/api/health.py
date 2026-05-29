"""
Healthcheck endpoints for the AI Service.

Provides:
- GET /healthz: Liveness probe — returns 200 if the process is alive.
- GET /readyz: Readiness probe — returns 200 if the database is reachable,
  or 503 with diagnostic details if dependencies are unreachable.
"""

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.infrastructure.db.database import async_session_factory

router = APIRouter(tags=["health"])


@router.get("/healthz")
async def liveness() -> JSONResponse:
    """
    Liveness probe endpoint.

    Returns HTTP 200 with {"status": "ok"} when the process is alive.
    No dependency checks are performed.
    """
    return JSONResponse(content={"status": "ok"}, status_code=200)


@router.get("/readyz")
async def readiness() -> JSONResponse:
    """
    Readiness probe endpoint.

    Checks database connectivity by executing a simple query.
    Returns HTTP 200 with {"status": "ready"} when all checks pass.
    Returns HTTP 503 with {"status": "not_ready", "checks": [...]} when
    any dependency is unreachable.
    """
    checks = []

    # Check database connectivity
    try:
        async with async_session_factory() as session:
            await session.execute(text("SELECT 1"))
    except Exception as e:
        checks.append({
            "name": "database",
            "status": "failed",
            "error": str(e),
        })

    if checks:
        return JSONResponse(
            content={"status": "not_ready", "checks": checks},
            status_code=503,
        )

    return JSONResponse(content={"status": "ready"}, status_code=200)
