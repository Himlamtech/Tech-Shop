"""
Healthcheck endpoints for TechShop Django services.

Provides:
- GET /healthz: Liveness probe — returns 200 if the process is alive.
- GET /readyz: Readiness probe — returns 200 if the database is reachable,
  or 503 with diagnostic details if dependencies are unreachable.
"""

from django.db import connection
from django.http import JsonResponse


def liveness(request):
    """
    Liveness probe endpoint.

    Returns HTTP 200 with {"status": "ok"} when the process is alive.
    No dependency checks are performed.
    """
    return JsonResponse({"status": "ok"}, status=200)


def readiness(request):
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
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
    except Exception as e:
        checks.append({
            "name": "database",
            "status": "failed",
            "error": str(e),
        })

    if checks:
        return JsonResponse(
            {"status": "not_ready", "checks": checks},
            status=503,
        )

    return JsonResponse({"status": "ready"}, status=200)
