"""
Unit tests for RAG chatbot service.

Tests: valid query, empty message, too-long message, similarity threshold
(no context), product validation, guest rate limiting (session_id tracking).
"""

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio

from app.application.rag_service import RAGService
from app.core.errors import AINoContextFoundError, ValidationError


@pytest_asyncio.fixture
async def mock_db():
    """Create a mock async database session."""
    db = AsyncMock()
    db.add = MagicMock()
    db.flush = AsyncMock()
    return db


@pytest_asyncio.fixture
async def rag_service(mock_db):
    """Create a RAGService instance with mocked dependencies."""
    service = RAGService(db=mock_db)
    return service


@pytest.mark.asyncio
async def test_valid_query_returns_answer(rag_service, mock_db):
    """A valid query should return an answer with recommended products."""
    mock_embedding = [0.1] * 384

    mock_docs = [
        {
            "id": str(uuid.uuid4()),
            "source_type": "product",
            "source_id": "prod-1",
            "title": "Laptop X",
            "content": "A great laptop for developers.",
            "metadata": {},
            "similarity": 0.85,
        }
    ]

    mock_llm_response = MagicMock()
    mock_llm_response.answer = "The Laptop X is great for developers."
    mock_llm_response.product_ids = ["prod-1"]
    mock_llm_response.grounded = True
    mock_llm_response.hallucination_risk = "low"

    with patch.object(
        rag_service.embedding_client, "generate_embedding", new_callable=AsyncMock
    ) as mock_embed, patch.object(
        rag_service, "_retrieve_documents", new_callable=AsyncMock
    ) as mock_retrieve, patch.object(
        rag_service.llm_client, "generate_response", new_callable=AsyncMock
    ) as mock_llm, patch.object(
        rag_service, "_validate_product_ids", new_callable=AsyncMock
    ) as mock_validate:
        mock_embed.return_value = mock_embedding
        mock_retrieve.return_value = mock_docs
        mock_llm.return_value = mock_llm_response
        mock_validate.return_value = ["prod-1"]

        result = await rag_service.process_chat_message(
            message="Tell me about laptops",
            user_id=str(uuid.uuid4()),
            session_id="session-123",
        )

    assert "answer" in result
    assert result["answer"] == "The Laptop X is great for developers."
    assert "recommended_product_ids" in result
    assert "prod-1" in result["recommended_product_ids"]


@pytest.mark.asyncio
async def test_empty_message_raises_validation_error(rag_service):
    """An empty message should raise a ValidationError."""
    with pytest.raises(ValidationError) as exc_info:
        await rag_service.process_chat_message(message="", user_id=None)

    assert "empty" in exc_info.value.message.lower()


@pytest.mark.asyncio
async def test_whitespace_only_message_raises_validation_error(rag_service):
    """A whitespace-only message should raise a ValidationError."""
    with pytest.raises(ValidationError):
        await rag_service.process_chat_message(message="   \t\n  ", user_id=None)


@pytest.mark.asyncio
async def test_too_long_message_raises_validation_error(rag_service):
    """A message exceeding 1000 characters should raise a ValidationError."""
    long_message = "x" * 1001

    with pytest.raises(ValidationError) as exc_info:
        await rag_service.process_chat_message(message=long_message, user_id=None)

    assert "1000" in exc_info.value.details[0]["reason"]


@pytest.mark.asyncio
async def test_no_context_found_raises_error(rag_service):
    """When no document exceeds similarity threshold, AINoContextFoundError is raised."""
    mock_embedding = [0.1] * 384

    # Documents below the 0.5 similarity threshold
    mock_docs = [
        {
            "id": str(uuid.uuid4()),
            "source_type": "faq",
            "source_id": "faq-1",
            "title": "Unrelated FAQ",
            "content": "Something unrelated.",
            "metadata": {},
            "similarity": 0.3,
        }
    ]

    with patch.object(
        rag_service.embedding_client, "generate_embedding", new_callable=AsyncMock
    ) as mock_embed, patch.object(
        rag_service, "_retrieve_documents", new_callable=AsyncMock
    ) as mock_retrieve:
        mock_embed.return_value = mock_embedding
        mock_retrieve.return_value = mock_docs

        with pytest.raises(AINoContextFoundError):
            await rag_service.process_chat_message(
                message="What is quantum physics?",
                user_id=None,
            )


@pytest.mark.asyncio
async def test_product_validation_filters_invalid_ids(rag_service, mock_db):
    """Product IDs from LLM that fail catalog validation should be filtered out."""
    mock_embedding = [0.1] * 384
    mock_docs = [
        {
            "id": str(uuid.uuid4()),
            "source_type": "product",
            "source_id": "prod-1",
            "title": "Phone Y",
            "content": "A smartphone.",
            "metadata": {},
            "similarity": 0.9,
        }
    ]

    mock_llm_response = MagicMock()
    mock_llm_response.answer = "Check out Phone Y and Phone Z."
    mock_llm_response.product_ids = ["prod-1", "prod-invalid"]
    mock_llm_response.grounded = True
    mock_llm_response.hallucination_risk = "low"

    with patch.object(
        rag_service.embedding_client, "generate_embedding", new_callable=AsyncMock
    ) as mock_embed, patch.object(
        rag_service, "_retrieve_documents", new_callable=AsyncMock
    ) as mock_retrieve, patch.object(
        rag_service.llm_client, "generate_response", new_callable=AsyncMock
    ) as mock_llm, patch.object(
        rag_service, "_validate_product_ids", new_callable=AsyncMock
    ) as mock_validate:
        mock_embed.return_value = mock_embedding
        mock_retrieve.return_value = mock_docs
        mock_llm.return_value = mock_llm_response
        # Only prod-1 passes validation
        mock_validate.return_value = ["prod-1"]

        result = await rag_service.process_chat_message(
            message="Tell me about phones",
            user_id=str(uuid.uuid4()),
            session_id="session-456",
        )

    assert result["recommended_product_ids"] == ["prod-1"]


@pytest.mark.asyncio
async def test_guest_session_id_is_tracked(rag_service, mock_db):
    """Guest users (no user_id) should have their session_id logged."""
    mock_embedding = [0.1] * 384
    mock_docs = [
        {
            "id": str(uuid.uuid4()),
            "source_type": "faq",
            "source_id": "faq-1",
            "title": "Return Policy",
            "content": "You can return within 30 days.",
            "metadata": {},
            "similarity": 0.8,
        }
    ]

    mock_llm_response = MagicMock()
    mock_llm_response.answer = "You can return within 30 days."
    mock_llm_response.product_ids = []
    mock_llm_response.grounded = True
    mock_llm_response.hallucination_risk = "low"

    with patch.object(
        rag_service.embedding_client, "generate_embedding", new_callable=AsyncMock
    ) as mock_embed, patch.object(
        rag_service, "_retrieve_documents", new_callable=AsyncMock
    ) as mock_retrieve, patch.object(
        rag_service.llm_client, "generate_response", new_callable=AsyncMock
    ) as mock_llm, patch.object(
        rag_service, "_validate_product_ids", new_callable=AsyncMock
    ) as mock_validate:
        mock_embed.return_value = mock_embedding
        mock_retrieve.return_value = mock_docs
        mock_llm.return_value = mock_llm_response
        mock_validate.return_value = []

        result = await rag_service.process_chat_message(
            message="What is the return policy?",
            user_id=None,
            session_id="guest-session-abc",
        )

    assert result["answer"] == "You can return within 30 days."
    # Verify that db.add was called (chat log with session_id)
    mock_db.add.assert_called()
