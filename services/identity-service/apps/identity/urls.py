"""URL configuration for Identity Service authentication endpoints."""

from django.urls import path

from apps.identity.views import AdminUsersView, LoginView, LogoutView, MeView, RefreshView, RegisterView

urlpatterns = [
    path("register", RegisterView.as_view(), name="auth-register"),
    path("login", LoginView.as_view(), name="auth-login"),
    path("refresh", RefreshView.as_view(), name="auth-refresh"),
    path("logout", LogoutView.as_view(), name="auth-logout"),
    path("me", MeView.as_view(), name="auth-me"),
]

# Admin endpoints are mounted at the config level under /api/v1/admin/
admin_urlpatterns = [
    path("users", AdminUsersView.as_view(), name="admin-users"),
]
