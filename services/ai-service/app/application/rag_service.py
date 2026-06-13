"""
RAG (Retrieval-Augmented Generation) pipeline orchestration.

Implements the full RAG flow:
1. Validate input message
2. Generate query embedding
3. Retrieve top-5 similar documents from pgvector
4. Check similarity threshold (>= 0.5)
5. Generate grounded answer via LLM
6. Validate recommended product IDs against Catalog Service
7. Log chat interaction
8. Return structured response

Validates: Requirements 12.1, 12.2, 12.3, 12.4, 12.5, 12.7, 12.8
"""

import logging
import uuid
from typing import Any, Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.errors import AINoContextFoundError, ValidationError
from app.infrastructure.catalog_client import CatalogClient
from app.infrastructure.db.models import ChatLog, HallucinationRisk
from app.infrastructure.embeddings.embedding_client import EmbeddingClient
from app.infrastructure.llm.llm_client import LLMClient

logger = logging.getLogger(__name__)
settings = get_settings()


class RAGService:
    """
    Orchestrates the RAG pipeline for the AI chatbot.

    Coordinates embedding generation, vector search, LLM response generation,
    product validation, and chat logging.
    """

    def __init__(self, db: AsyncSession):
        self.db = db
        self.embedding_client = EmbeddingClient()
        self.llm_client = LLMClient()
        self.catalog_client = CatalogClient()
        self.similarity_threshold = settings.rag_similarity_threshold
        self.top_k = 5

    async def process_chat_message(
        self,
        message: str,
        user_id: Optional[str] = None,
        session_id: Optional[str] = None,
        context: Optional[dict[str, Any]] = None,
        authorization: Optional[str] = None,
        request_id: Optional[str] = None,
    ) -> dict[str, Any]:
        """
        Process a chat message through the full RAG pipeline.

        Args:
            message: User's chat message (1-1000 chars).
            user_id: Authenticated user ID (None for guests).
            session_id: Session identifier for guest rate limiting.
            context: Optional context with current_product_id, cart_product_ids.
            authorization: Bearer token for downstream service calls.
            request_id: Request ID for tracing.

        Returns:
            Dict with answer, recommended_product_ids, retrieved_documents, safety metadata.

        Raises:
            ValidationError: If message is empty or exceeds 1000 chars.
            AINoContextFoundError: If no document exceeds similarity threshold.
        """
        # Step 1: Validate message
        self._validate_message(message)

        # Step 2: Generate query embedding
        query_embedding = await self.embedding_client.generate_embedding(message)

        # Step 3: Retrieve top-5 similar documents
        retrieved_docs = await self._retrieve_documents(query_embedding)

        # Step 4: Check similarity threshold
        if not retrieved_docs or retrieved_docs[0]["similarity"] < self.similarity_threshold:
            raise AINoContextFoundError(
                message="No relevant context found for the query. "
                "Please try rephrasing your question or ask about specific products."
            )

        # Step 5: Generate grounded answer via LLM
        llm_response = await self.llm_client.generate_response(
            user_message=message,
            context_documents=retrieved_docs,
        )

        # Step 6: Validate recommended product IDs against Catalog Service
        validated_product_ids = await self._validate_product_ids(
            product_ids=llm_response.product_ids,
            authorization=authorization,
            request_id=request_id,
        )

        # Step 7: Log chat interaction
        session_id = session_id or f"session_{uuid.uuid4().hex[:16]}"
        await self._log_chat(
            user_id=user_id,
            session_id=session_id,
            message=message,
            response=llm_response.answer,
            recommended_product_ids=validated_product_ids,
            grounded=llm_response.grounded,
            hallucination_risk=llm_response.hallucination_risk,
        )

        # Step 8: Build and return structured response
        return {
            "answer": llm_response.answer,
            "recommended_product_ids": validated_product_ids,
            "retrieved_documents": [
                {
                    "source_type": doc["source_type"],
                    "source_id": doc["source_id"],
                    "title": doc["title"],
                    "similarity_score": round(doc["similarity"], 4),
                }
                for doc in retrieved_docs
            ],
            "safety": {
                "grounded": llm_response.grounded,
                "hallucination_risk": llm_response.hallucination_risk,
            },
        }

    def _validate_message(self, message: str) -> None:
        """
        Validate the chat message.

        Raises ValidationError if message is empty or exceeds 1000 characters.
        """
        if not message or not message.strip():
            raise ValidationError(
                message="Message cannot be empty",
                details=[{"field": "message", "reason": "Message is required and cannot be empty or whitespace only"}],
            )

        if len(message) > 1000:
            raise ValidationError(
                message="Message exceeds maximum length",
                details=[{"field": "message", "reason": "Message must be between 1 and 1000 characters"}],
            )

    async def _retrieve_documents(
        self, query_embedding: list[float]
    ) -> list[dict[str, Any]]:
        """
        Retrieve top-5 most similar documents from pgvector.

        Uses cosine similarity (1 - cosine distance) for ranking.

        Args:
            query_embedding: The query embedding vector.

        Returns:
            List of documents with similarity scores, ordered by similarity descending.
        """
        embedding_str = "[" + ",".join(str(x) for x in query_embedding) + "]"

        query = text("""
            SELECT
                id,
                source_type,
                source_id,
                title,
                content,
                metadata,
                1 - (embedding <=> CAST(:query_embedding AS vector)) as similarity
            FROM embedding_documents
            ORDER BY embedding <=> CAST(:query_embedding AS vector)
            LIMIT :top_k
        """)

        result = await self.db.execute(
            query,
            {"query_embedding": embedding_str, "top_k": self.top_k},
        )

        rows = result.fetchall()
        documents = []
        for row in rows:
            documents.append({
                "id": str(row.id),
                "source_type": row.source_type,
                "source_id": row.source_id,
                "title": row.title,
                "content": row.content,
                "metadata": row.metadata,
                "similarity": float(row.similarity),
            })

        return documents

    async def _validate_product_ids(
        self,
        product_ids: list[str],
        authorization: Optional[str] = None,
        request_id: Optional[str] = None,
    ) -> list[str]:
        """
        Validate product IDs against the Catalog Service.

        Only returns product IDs that are active and in-stock.

        Args:
            product_ids: List of product ID strings from LLM response.
            authorization: Bearer token for Catalog Service.
            request_id: Request ID for tracing.

        Returns:
            List of validated product IDs (active + in-stock).
        """
        if not product_ids:
            return []

        try:
            result = await self.catalog_client.validate_products(
                product_ids=product_ids,
                authorization=authorization,
                request_id=request_id,
            )

            # Extract valid product IDs from the validation response
            if result and "data" in result:
                valid_items = result["data"].get("valid", [])
                if isinstance(valid_items, list):
                    return [
                        item.get("product_id", item) if isinstance(item, dict) else str(item)
                        for item in valid_items
                    ]

            return []

        except Exception as e:
            logger.warning(
                "product_validation_failed",
                extra={"error": str(e), "product_ids": product_ids},
            )
            # Return empty list if validation fails — don't block the response
            return []

    async def _log_chat(
        self,
        user_id: Optional[str],
        session_id: str,
        message: str,
        response: str,
        recommended_product_ids: list[str],
        grounded: bool,
        hallucination_risk: str,
    ) -> None:
        """
        Log the chat interaction to the ChatLog table.

        Args:
            user_id: Authenticated user ID or None for guests.
            session_id: Session identifier.
            message: User's original message.
            response: AI-generated response.
            recommended_product_ids: Validated product IDs.
            grounded: Whether the response is grounded in context.
            hallucination_risk: Risk level (low, medium, high).
        """
        try:
            # Map string to enum
            risk_enum = HallucinationRisk(hallucination_risk)

            chat_log = ChatLog(
                user_id=uuid.UUID(user_id) if user_id else None,
                session_id=session_id,
                message=message,
                response=response,
                recommended_product_ids=recommended_product_ids,
                grounded=grounded,
                hallucination_risk=risk_enum,
            )
            self.db.add(chat_log)
            await self.db.flush()

            logger.info(
                "chat_logged",
                extra={
                    "chat_log_id": str(chat_log.id),
                    "user_id": user_id,
                    "session_id": session_id,
                    "grounded": grounded,
                },
            )
        except Exception as e:
            logger.error(
                "chat_log_failed",
                extra={"error": str(e), "session_id": session_id},
            )
            # Don't fail the request if logging fails
