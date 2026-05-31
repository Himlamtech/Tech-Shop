"""
LLM client wrapper for the AI Service.

Supports:
- Production: OpenAI-compatible API calls (gpt-5.4-nano or configured model)
- Demo/Development: Mock response generation based on retrieved documents

The mock mode activates automatically when no API key is configured.
"""

import logging
import re
from typing import Any

from app.core.config import get_settings

logger = logging.getLogger(__name__)

settings = get_settings()


class LLMResponse:
    """Structured response from the LLM."""

    def __init__(
        self,
        answer: str,
        product_ids: list[str],
        grounded: bool,
        hallucination_risk: str,
    ):
        self.answer = answer
        self.product_ids = product_ids
        self.grounded = grounded
        self.hallucination_risk = hallucination_risk


class LLMClient:
    """
    LLM client that supports OpenAI API in production and mock responses
    in demo/development mode.
    """

    SYSTEM_PROMPT = (
        "You are a helpful product advisor for TechShop, an electronics and technology store. "
        "Answer customer questions based ONLY on the provided context documents. "
        "If the context doesn't contain enough information to answer, say so clearly. "
        "When recommending products, always reference their product IDs. "
        "Format product IDs as [PRODUCT_ID:uuid] in your response. "
        "Be concise, helpful, and accurate."
    )

    def __init__(self):
        self.api_key = settings.llm_api_key
        self.base_url = settings.llm_base_url
        self.model = settings.llm_model
        self.max_tokens = settings.llm_max_tokens
        self.temperature = settings.llm_temperature
        self._use_mock = not self.api_key

    async def generate_response(
        self,
        user_message: str,
        context_documents: list[dict[str, Any]],
    ) -> LLMResponse:
        """
        Generate a response using the LLM with retrieved context.

        Args:
            user_message: The user's chat message.
            context_documents: List of retrieved documents with content and metadata.

        Returns:
            LLMResponse with answer, product_ids, grounded flag, and hallucination_risk.
        """
        if self._use_mock:
            return self._generate_mock_response(user_message, context_documents)

        return await self._generate_openai_response(user_message, context_documents)

    async def _generate_openai_response(
        self,
        user_message: str,
        context_documents: list[dict[str, Any]],
    ) -> LLMResponse:
        """Call OpenAI API for response generation."""
        try:
            import openai

            client = openai.AsyncOpenAI(
                api_key=self.api_key,
                base_url=self.base_url,
            )

            context_text = self._build_context_text(context_documents)

            messages = [
                {"role": "system", "content": self.SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": (
                        f"Context documents:\n{context_text}\n\n"
                        f"Customer question: {user_message}"
                    ),
                },
            ]

            response = await client.chat.completions.create(
                model=self.model,
                messages=messages,
                max_tokens=self.max_tokens,
                temperature=self.temperature,
            )

            answer = response.choices[0].message.content or ""
            product_ids = self._extract_product_ids(answer)

            return LLMResponse(
                answer=answer,
                product_ids=product_ids,
                grounded=True,
                hallucination_risk="low",
            )

        except Exception as e:
            logger.error(
                "openai_api_error",
                extra={"error": str(e)},
            )
            # Fall back to mock on API error
            return self._generate_mock_response(user_message, context_documents)

    def _generate_mock_response(
        self,
        user_message: str,
        context_documents: list[dict[str, Any]],
    ) -> LLMResponse:
        """
        Generate a mock response based on retrieved documents.

        Used in demo/development mode when no API key is configured.
        """
        if not context_documents:
            return LLMResponse(
                answer="I don't have enough information to answer your question.",
                product_ids=[],
                grounded=False,
                hallucination_risk="high",
            )

        # Build answer from top documents
        top_docs = context_documents[:3]
        answer_parts = []
        product_ids = []

        answer_parts.append(
            f"Based on our catalog, here's what I found regarding your question about \"{user_message}\":\n"
        )

        for doc in top_docs:
            title = doc.get("title", "Unknown")
            content = doc.get("content", "")
            source_type = doc.get("source_type", "")
            source_id = doc.get("source_id", "")

            # Truncate content for readability
            snippet = content[:200] + "..." if len(content) > 200 else content
            answer_parts.append(f"- **{title}**: {snippet}")

            if source_type == "product" and source_id:
                product_ids.append(source_id)
                answer_parts.append(f"  [PRODUCT_ID:{source_id}]")

        answer = "\n".join(answer_parts)

        return LLMResponse(
            answer=answer,
            product_ids=product_ids,
            grounded=True,
            hallucination_risk="low" if len(context_documents) >= 3 else "medium",
        )

    def _build_context_text(self, context_documents: list[dict[str, Any]]) -> str:
        """Build context text from retrieved documents for the LLM prompt."""
        parts = []
        for i, doc in enumerate(context_documents, 1):
            title = doc.get("title", "Unknown")
            content = doc.get("content", "")
            source_type = doc.get("source_type", "")
            source_id = doc.get("source_id", "")

            parts.append(
                f"Document {i} ({source_type}):\n"
                f"Title: {title}\n"
                f"Source ID: {source_id}\n"
                f"Content: {content}\n"
            )
        return "\n---\n".join(parts)

    def _extract_product_ids(self, text: str) -> list[str]:
        """Extract product IDs from LLM response text."""
        # Match [PRODUCT_ID:uuid] pattern
        pattern = r"\[PRODUCT_ID:([a-f0-9\-]+)\]"
        matches = re.findall(pattern, text)
        return list(set(matches))
