"""
RAG Ingestion Pipeline.

Exports catalog products and FAQ/policy documents as embedding documents
for vector search retrieval. Supports idempotent re-ingestion.

Usage:
    python -m app.application.rag_ingestion

Pipeline steps:
1. Fetch products from Catalog Service (paginated)
2. For each product: compose text, generate embedding, store in pgvector
3. Read FAQ/policy markdown files, chunk by section
4. For each chunk: generate embedding, store in pgvector
5. Report total documents embedded on completion
"""

import asyncio
import hashlib
import logging
import os
import re
import sys
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.infrastructure.catalog_client import ServiceClient
from app.infrastructure.db.database import async_session_factory, init_db
from app.infrastructure.db.models import EmbeddingDocument, SourceType
from app.ml.rag.embeddings import generate_embedding, generate_embeddings_batch

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Text normalization
# ---------------------------------------------------------------------------


def normalize_text(text: str) -> str:
    """
    Normalize text for embedding generation.

    - Strip leading/trailing whitespace
    - Collapse multiple whitespace/newlines into single space
    - Remove non-printable characters
    """
    if not text:
        return ""
    # Remove non-printable characters
    text = re.sub(r"[^\x20-\x7E\n\t]", "", text)
    # Collapse multiple whitespace into single space
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def compute_content_hash(content: str) -> str:
    """Compute SHA-256 hash of content for change detection."""
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


# ---------------------------------------------------------------------------
# Product ingestion
# ---------------------------------------------------------------------------


def compose_product_text(product: dict) -> str:
    """
    Compose a text representation of a product for embedding.

    Format:
        {name}
        {brand}
        {category}
        {description}
        Price: {price}
        Attributes: {attributes}
    """
    name = product.get("name", "")
    brand = product.get("brand", "")
    category = product.get("category_name", product.get("category", ""))
    description = product.get("description", "")
    price = product.get("price", "")
    attributes = product.get("attributes", {})

    # Format attributes as key-value pairs
    if isinstance(attributes, dict) and attributes:
        attrs_str = ", ".join(f"{k}: {v}" for k, v in attributes.items())
    elif isinstance(attributes, str):
        attrs_str = attributes
    else:
        attrs_str = ""

    text = f"{name}\n{brand}\n{category}\n{description}\nPrice: {price}\nAttributes: {attrs_str}"
    return normalize_text(text)


async def fetch_all_products(catalog_url: str) -> list[dict]:
    """
    Fetch all products from the Catalog Service with pagination.

    Args:
        catalog_url: Base URL of the Catalog Service.

    Returns:
        List of product dictionaries.
    """
    client = ServiceClient(base_url=catalog_url, timeout_seconds=10.0)
    all_products = []
    page = 1
    page_size = 50

    while True:
        try:
            response = await client.get(
                "/api/v1/products",
                params={"page": page, "page_size": page_size},
            )

            # Handle standard envelope response
            if isinstance(response, dict):
                products = response.get("data", response.get("results", []))
                if isinstance(products, list):
                    all_products.extend(products)
                else:
                    # Response might be the list directly
                    all_products.extend([response])

                # Check if there are more pages
                meta = response.get("meta", {})
                total_pages = meta.get("total_pages", 1)
                if page >= total_pages:
                    break
            else:
                break

            page += 1

        except Exception as e:
            logger.warning("Failed to fetch products page %d: %s", page, str(e))
            break

    logger.info("Fetched %d products from Catalog Service", len(all_products))
    return all_products


async def ingest_products(session: AsyncSession, catalog_url: str) -> dict:
    """
    Ingest catalog products as embedding documents.

    Idempotent: skips existing documents with unchanged content,
    updates documents with changed content.

    Args:
        session: Async database session.
        catalog_url: Base URL of the Catalog Service.

    Returns:
        Dict with counts: created, updated, skipped.
    """
    products = await fetch_all_products(catalog_url)
    stats = {"created": 0, "updated": 0, "skipped": 0}

    for product in products:
        product_id = str(product.get("id", ""))
        if not product_id:
            continue

        content = compose_product_text(product)
        content_hash = compute_content_hash(content)
        title = product.get("name", "Unknown Product")

        # Check if document already exists
        result = await session.execute(
            select(EmbeddingDocument).where(
                EmbeddingDocument.source_type == SourceType.product,
                EmbeddingDocument.source_id == product_id,
            )
        )
        existing = result.scalar_one_or_none()

        if existing:
            # Check if content has changed
            existing_hash = (existing.metadata_ or {}).get("content_hash", "")
            if existing_hash == content_hash:
                stats["skipped"] += 1
                continue

            # Update existing document
            embedding = generate_embedding(content)
            existing.title = title
            existing.content = content
            existing.embedding = embedding
            existing.metadata_ = {
                "content_hash": content_hash,
                "product_id": product_id,
                "brand": product.get("brand", ""),
                "category": product.get("category_name", product.get("category", "")),
                "price": str(product.get("price", "")),
            }
            stats["updated"] += 1
            logger.debug("Updated product embedding: %s", product_id)
        else:
            # Create new document
            embedding = generate_embedding(content)
            doc = EmbeddingDocument(
                source_type=SourceType.product,
                source_id=product_id,
                title=title,
                content=content,
                embedding=embedding,
                metadata_={
                    "content_hash": content_hash,
                    "product_id": product_id,
                    "brand": product.get("brand", ""),
                    "category": product.get("category_name", product.get("category", "")),
                    "price": str(product.get("price", "")),
                },
            )
            session.add(doc)
            stats["created"] += 1
            logger.debug("Created product embedding: %s", product_id)

    await session.commit()
    return stats


# ---------------------------------------------------------------------------
# FAQ / Policy document ingestion
# ---------------------------------------------------------------------------


def chunk_markdown_by_section(content: str, filename: str) -> list[dict]:
    """
    Chunk a markdown document by top-level sections (## headers).

    Each chunk includes the document title (# header) as context
    and the section content.

    Args:
        content: Raw markdown content.
        filename: Source filename for identification.

    Returns:
        List of dicts with keys: title, content, section_id.
    """
    lines = content.split("\n")
    chunks = []

    # Extract document title (first # header)
    doc_title = filename
    for line in lines:
        if line.startswith("# ") and not line.startswith("## "):
            doc_title = line.lstrip("# ").strip()
            break

    current_section_title = ""
    current_section_lines: list[str] = []
    section_index = 0

    for line in lines:
        if line.startswith("## "):
            # Save previous section if it has content
            if current_section_lines:
                section_content = "\n".join(current_section_lines).strip()
                if section_content:
                    chunk_title = f"{doc_title} - {current_section_title}" if current_section_title else doc_title
                    chunks.append({
                        "title": chunk_title,
                        "content": normalize_text(section_content),
                        "section_id": f"{filename}#section-{section_index}",
                    })
                    section_index += 1

            current_section_title = line.lstrip("# ").strip()
            current_section_lines = [line]
        elif line.startswith("# ") and not line.startswith("## "):
            # Skip the document title line itself
            continue
        else:
            current_section_lines.append(line)

    # Don't forget the last section
    if current_section_lines:
        section_content = "\n".join(current_section_lines).strip()
        if section_content:
            chunk_title = f"{doc_title} - {current_section_title}" if current_section_title else doc_title
            chunks.append({
                "title": chunk_title,
                "content": normalize_text(section_content),
                "section_id": f"{filename}#section-{section_index}",
            })

    return chunks


def load_faq_documents(faq_path: str) -> list[dict]:
    """
    Load and chunk all FAQ/policy markdown documents.

    Args:
        faq_path: Path to the FAQ documents directory.

    Returns:
        List of chunk dicts with title, content, section_id, filename.
    """
    faq_dir = Path(faq_path)
    all_chunks = []

    if not faq_dir.exists():
        logger.warning("FAQ directory not found: %s", faq_path)
        return all_chunks

    for md_file in sorted(faq_dir.glob("*.md")):
        content = md_file.read_text(encoding="utf-8")
        filename = md_file.stem  # e.g., "warranty", "shipping"
        chunks = chunk_markdown_by_section(content, filename)

        for chunk in chunks:
            chunk["filename"] = filename

        all_chunks.extend(chunks)
        logger.info("Loaded %d chunks from %s", len(chunks), md_file.name)

    return all_chunks


async def ingest_faq_documents(session: AsyncSession, faq_path: str) -> dict:
    """
    Ingest FAQ/policy documents as embedding documents.

    Idempotent: skips existing documents with unchanged content,
    updates documents with changed content.

    Args:
        session: Async database session.
        faq_path: Path to the FAQ documents directory.

    Returns:
        Dict with counts: created, updated, skipped.
    """
    chunks = load_faq_documents(faq_path)
    stats = {"created": 0, "updated": 0, "skipped": 0}

    for chunk in chunks:
        source_id = chunk["section_id"]
        content = chunk["content"]
        content_hash = compute_content_hash(content)
        title = chunk["title"]
        filename = chunk["filename"]

        # Check if document already exists
        result = await session.execute(
            select(EmbeddingDocument).where(
                EmbeddingDocument.source_type == SourceType.faq,
                EmbeddingDocument.source_id == source_id,
            )
        )
        existing = result.scalar_one_or_none()

        if existing:
            # Check if content has changed
            existing_hash = (existing.metadata_ or {}).get("content_hash", "")
            if existing_hash == content_hash:
                stats["skipped"] += 1
                continue

            # Update existing document
            embedding = generate_embedding(content)
            existing.title = title
            existing.content = content
            existing.embedding = embedding
            existing.metadata_ = {
                "content_hash": content_hash,
                "filename": filename,
                "document_type": "faq",
            }
            stats["updated"] += 1
            logger.debug("Updated FAQ embedding: %s", source_id)
        else:
            # Create new document
            embedding = generate_embedding(content)
            doc = EmbeddingDocument(
                source_type=SourceType.faq,
                source_id=source_id,
                title=title,
                content=content,
                embedding=embedding,
                metadata_={
                    "content_hash": content_hash,
                    "filename": filename,
                    "document_type": "faq",
                },
            )
            session.add(doc)
            stats["created"] += 1
            logger.debug("Created FAQ embedding: %s", source_id)

    await session.commit()
    return stats


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------


async def run_ingestion() -> None:
    """
    Run the full RAG ingestion pipeline.

    Steps:
    1. Initialize database (ensure tables exist)
    2. Ingest catalog products
    3. Ingest FAQ/policy documents
    4. Report totals
    """
    settings = get_settings()

    logging.basicConfig(
        level=getattr(logging, settings.log_level.upper(), logging.INFO),
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    logger.info("=" * 60)
    logger.info("RAG Ingestion Pipeline - Starting")
    logger.info("=" * 60)

    # Initialize database
    logger.info("Initializing database...")
    await init_db()

    async with async_session_factory() as session:
        # --- Product ingestion ---
        logger.info("--- Ingesting catalog products ---")
        try:
            product_stats = await ingest_products(session, settings.catalog_service_url)
            logger.info(
                "Products: created=%d, updated=%d, skipped=%d",
                product_stats["created"],
                product_stats["updated"],
                product_stats["skipped"],
            )
        except Exception as e:
            logger.error("Product ingestion failed: %s", str(e))
            product_stats = {"created": 0, "updated": 0, "skipped": 0}

        # --- FAQ document ingestion ---
        logger.info("--- Ingesting FAQ/policy documents ---")
        try:
            faq_stats = await ingest_faq_documents(session, settings.faq_knowledge_base_path)
            logger.info(
                "FAQ docs: created=%d, updated=%d, skipped=%d",
                faq_stats["created"],
                faq_stats["updated"],
                faq_stats["skipped"],
            )
        except Exception as e:
            logger.error("FAQ ingestion failed: %s", str(e))
            faq_stats = {"created": 0, "updated": 0, "skipped": 0}

    # --- Summary ---
    total_created = product_stats["created"] + faq_stats["created"]
    total_updated = product_stats["updated"] + faq_stats["updated"]
    total_skipped = product_stats["skipped"] + faq_stats["skipped"]
    total_embedded = total_created + total_updated

    logger.info("=" * 60)
    logger.info("RAG Ingestion Pipeline - Complete")
    logger.info("=" * 60)
    logger.info("Total documents embedded: %d (created=%d, updated=%d)", total_embedded, total_created, total_updated)
    logger.info("Total documents skipped (unchanged): %d", total_skipped)
    logger.info("=" * 60)


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------


def main() -> None:
    """CLI entry point for running the ingestion pipeline."""
    asyncio.run(run_ingestion())


if __name__ == "__main__":
    main()
