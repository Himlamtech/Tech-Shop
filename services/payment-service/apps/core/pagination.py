"""
Standard page-based pagination for TechShop services.

Returns responses in the standard envelope format with pagination metadata:
{
    "success": true,
    "data": [...],
    "meta": {
        "request_id": "req_...",
        "pagination": {
            "page": 1,
            "page_size": 20,
            "total": 194,
            "total_pages": 10
        }
    }
}
"""

import math

from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

from apps.core.request_context import get_current_request_id


class StandardPagination(PageNumberPagination):
    """
    Page-based pagination with standard meta format.

    Query parameters:
    - page: Page number (default 1)
    - page_size: Items per page (default 20, max 100)
    """

    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100
    page_query_param = "page"

    def get_paginated_response(self, data):
        """Return paginated response in standard envelope format."""
        total = self.page.paginator.count
        page_size = self.get_page_size(self.request)
        total_pages = math.ceil(total / page_size) if page_size > 0 else 0

        return Response(
            {
                "success": True,
                "data": data,
                "meta": {
                    "request_id": get_current_request_id(),
                    "pagination": {
                        "page": self.page.number,
                        "page_size": page_size,
                        "total": total,
                        "total_pages": total_pages,
                    },
                },
            }
        )

    def get_paginated_response_schema(self, schema):
        """OpenAPI schema for paginated responses."""
        return {
            "type": "object",
            "properties": {
                "success": {"type": "boolean", "example": True},
                "data": schema,
                "meta": {
                    "type": "object",
                    "properties": {
                        "request_id": {"type": "string", "example": "req_abc123"},
                        "pagination": {
                            "type": "object",
                            "properties": {
                                "page": {"type": "integer", "example": 1},
                                "page_size": {"type": "integer", "example": 20},
                                "total": {"type": "integer", "example": 194},
                                "total_pages": {"type": "integer", "example": 10},
                            },
                        },
                    },
                },
            },
        }
