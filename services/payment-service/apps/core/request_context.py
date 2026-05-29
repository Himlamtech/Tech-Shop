"""
Thread-local storage for request context (request_id, user_id, user_role).

This allows access to request metadata from anywhere in the call stack
without passing the request object explicitly.
"""

import threading

_local = threading.local()


def set_request_context(request_id=None, user_id=None, user_role=None):
    """Store request context in thread-local storage."""
    _local.request_id = request_id
    _local.user_id = user_id
    _local.user_role = user_role


def get_current_request_id():
    """Get the current request ID from thread-local storage."""
    return getattr(_local, "request_id", None)


def get_current_user_id():
    """Get the current user ID from thread-local storage."""
    return getattr(_local, "user_id", None)


def get_current_user_role():
    """Get the current user role from thread-local storage."""
    return getattr(_local, "user_role", None)


def clear_request_context():
    """Clear all request context from thread-local storage."""
    _local.request_id = None
    _local.user_id = None
    _local.user_role = None
