"""
Base RBAC permission classes for TechShop services.

These permission classes check the user's role (extracted from JWT by middleware)
against the required role for the endpoint.

Usage in views:
    from apps.core.permissions import IsAdmin, IsStaff, IsCustomer, IsOwner

    class ProductCreateView(APIView):
        permission_classes = [IsAdmin]
"""

from rest_framework.permissions import BasePermission

from apps.core.exceptions import ForbiddenError, UnauthorizedError


class IsAuthenticated(BasePermission):
    """Requires a valid JWT token (any role)."""

    def has_permission(self, request, view):
        if not getattr(request, "user_id", None):
            raise UnauthorizedError()
        return True


class IsAdmin(BasePermission):
    """Requires the admin role."""

    def has_permission(self, request, view):
        if not getattr(request, "user_id", None):
            raise UnauthorizedError()
        if getattr(request, "user_role", None) != "admin":
            raise ForbiddenError("Admin access required")
        return True


class IsStaff(BasePermission):
    """Requires admin or staff role."""

    def has_permission(self, request, view):
        if not getattr(request, "user_id", None):
            raise UnauthorizedError()
        if getattr(request, "user_role", None) not in ("admin", "staff"):
            raise ForbiddenError("Staff access required")
        return True


class IsCustomer(BasePermission):
    """Requires the customer role."""

    def has_permission(self, request, view):
        if not getattr(request, "user_id", None):
            raise UnauthorizedError()
        if getattr(request, "user_role", None) != "customer":
            raise ForbiddenError("Customer access required")
        return True


class IsOwner(BasePermission):
    """
    Requires that the requesting user owns the resource.

    The view must implement `get_resource_owner_id(obj)` method
    or the object must have a `user_id` attribute.

    Admin and staff roles bypass ownership checks.
    """

    def has_object_permission(self, request, view, obj):
        if not getattr(request, "user_id", None):
            raise UnauthorizedError()

        # Admin and staff can access any resource
        user_role = getattr(request, "user_role", None)
        if user_role in ("admin", "staff"):
            return True

        # Check ownership
        owner_id = None
        if hasattr(view, "get_resource_owner_id"):
            owner_id = view.get_resource_owner_id(obj)
        elif hasattr(obj, "user_id"):
            owner_id = str(obj.user_id)

        if str(request.user_id) != str(owner_id):
            raise ForbiddenError("You do not have permission to access this resource")

        return True
