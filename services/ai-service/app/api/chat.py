"""
RAG Chatbot API endpoint.

POST /api/v1/chat — Accept a user message and return an AI-generated
response grounded in the product catalog and knowledge base.

Features:
- Message validation (1-1000 chars)
- Guest access with session-based rate limiting (10 queries/session)
- 5-second response timeout
- Structured response with safety metadata

Validates: Requirements 12.1, 12.2, 12.3, 12.4, 12.5, 12.7, 12.8
"""

import asyncio
import logging
import uuid
from typing import Any, Optional

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.rag_service import RAGService
from app.core.errors import ValidationError
from app.core.responses import error_response, success_response
from app.infrastructure.db.database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["chat"])

# In-memory session query counter for guest rate limiting
_session_query_counts: dict[str, int] = {}
GUEST_QUERY_LIMIT = 10
RESPONSE_TIMEOUT_SECONDS = 5.0


# ---------------------------------------------------------------------------
# Request / Response Schemas
# ---------------------------------------------------------------------------


class ChatContext(BaseModel):
    """Optional context for the chat request."""

    current_product_id: Optional[str] = None
    cart_product_ids: Optional[list[str]] = None


class ChatRequest(BaseModel):
    """Chat request payload."""

    message: str = Field(..., min_length=1, max_length=1000, description="User message (1-1000 characters)")
    user_id: Optional[str] = Field(None, description="Optional user ID for authenticated users")
    context: Optional[ChatContext] = Field(None, description="Optional context (current product, cart items)")


class RetrievedDocument(BaseModel):
    """A retrieved document with similarity score."""

    source_type: str
    source_id: str
    title: str
    similarity_score: float


class SafetyMetadata(BaseModel):
    """Safety metadata for the chat response."""

    grounded: bool
    hallucination_risk: str


class ChatResponseData(BaseModel):
    """Chat response data payload."""

    answer: str
    recommended_product_ids: list[str]
    retrieved_documents: list[RetrievedDocument]
    safety: SafetyMetadata


# ---------------------------------------------------------------------------
# Route Handler
# ---------------------------------------------------------------------------


@router.post("/chat")
async def chat(
    request: Request,
    body: ChatRequest,
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    """
    Process a chat message through the RAG pipeline.

    Accepts a user message, retrieves relevant documents from the vector store,
    generates a grounded answer using an LLM, validates product recommendations,
    and returns a structured response.

    - Authenticated users: unlimited queries
    - Guest users: limited to 10 queries per session
    - Response timeout: 5 seconds
    """
    # Extract request context
    request_id = getattr(request.state, "request_id", None)
    auth_user_id = getattr(request.state, "user_id", None)
    authorization = request.headers.get("authorization")

    # Determine effective user_id (from JWT or request body)
    effective_user_id = str(auth_user_id) if auth_user_id else body.user_id

    # Generate session ID for guest rate limiting
    session_id = _get_or_create_session_id(request, effective_user_id)

    # Enforce guest rate limit (10 queries per session)
    if not effective_user_id:
        if not _check_guest_rate_limit(session_id):
            return JSONResponse(
                status_code=429,
                content=error_response(
                    code="RATE_LIMIT_EXCEEDED",
                    message="Guest users are limited to 10 queries per session. "
                    "Please register for unlimited access.",
                    request=request,
                ),
            )

    # Validate message (additional check beyond Pydantic)
    if not body.message.strip():
        raise ValidationError(
            message="Message cannot be empty",
            details=[{"field": "message", "reason": "Message is required and cannot be empty or whitespace only"}],
        )

    # Process through RAG pipeline with timeout
    rag_service = RAGService(db)

    context_dict = None
    if body.context:
        context_dict = {
            "current_product_id": body.context.current_product_id,
            "cart_product_ids": body.context.cart_product_ids,
        }

    try:
        result = await asyncio.wait_for(
            rag_service.process_chat_message(
                message=body.message,
                user_id=effective_user_id,
                session_id=session_id,
                context=context_dict,
                authorization=authorization,
                request_id=request_id,
            ),
            timeout=RESPONSE_TIMEOUT_SECONDS,
        )
    except asyncio.TimeoutError:
        logger.error(
            "chat_timeout",
            extra={
                "request_id": request_id,
                "user_id": effective_user_id,
                "session_id": session_id,
            },
        )
        return JSONResponse(
            status_code=503,
            content=error_response(
                code="SERVICE_UNAVAILABLE",
                message="Chat response timed out. Please try again.",
                request=request,
            ),
        )

    # Increment guest query counter on success
    if not effective_user_id:
        _increment_guest_counter(session_id)

    return JSONResponse(
        status_code=200,
        content=success_response(data=result, request=request),
    )


# ---------------------------------------------------------------------------
# Helper Functions
# ---------------------------------------------------------------------------


def _get_or_create_session_id(request: Request, user_id: Optional[str]) -> str:
    """
    Get or create a session ID for the request.

    For authenticated users, uses user_id as session identifier.
    For guests, generates a session ID based on client IP + user-agent.
    """
    if user_id:
        return f"user_{user_id}"

    # For guests, create a deterministic session ID from client info
    client_ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")
    session_key = f"{client_ip}:{user_agent}"

    # Create a stable hash-based session ID
    session_hash = uuid.uuid5(uuid.NAMESPACE_DNS, session_key).hex[:16]
    return f"guest_{session_hash}"


def _check_guest_rate_limit(session_id: str) -> bool:
    """
    Check if a guest session has exceeded the query limit.

    Returns True if the request is allowed, False if rate limited.
    """
    count = _session_query_counts.get(session_id, 0)
    return count < GUEST_QUERY_LIMIT


def _increment_guest_counter(session_id: str) -> None:
    """Increment the query counter for a guest session."""
    _session_query_counts[session_id] = _session_query_counts.get(session_id, 0) + 1
