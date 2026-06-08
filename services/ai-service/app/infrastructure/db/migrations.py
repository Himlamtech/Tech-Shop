"""AI Service database migration script.

Creates all AI service tables with pgvector enabled using the same async SQLAlchemy
driver configuration as the runtime application.
"""

import asyncio
import sys

from sqlalchemy import text

# Register models on Base.metadata
import app.infrastructure.db.models  # noqa: F401
from app.infrastructure.db.database import Base, engine


async def enable_pgvector_extension() -> None:
    """Enable the pgvector extension before creating vector-backed tables."""
    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
    print("[OK] pgvector extension enabled")


async def create_all_tables() -> None:
    """Create all AI service tables if they do not already exist."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("[OK] All AI service tables created successfully")


async def drop_all_tables() -> None:
    """Drop all AI service tables."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    print("[OK] All AI service tables dropped")


async def run_migrations(drop_existing: bool = False) -> None:
    """Run AI service schema setup against the configured async database."""
    print("[INFO] Connecting to database...")
    print("[INFO] Running AI service migrations...")

    await enable_pgvector_extension()

    if drop_existing:
        print("[INFO] Dropping existing tables...")
        await drop_all_tables()

    await create_all_tables()

    print("\n[INFO] Migration summary:")
    print("  Tables:")
    for table_name in sorted(Base.metadata.tables.keys()):
        print(f"    - {table_name}")

    await engine.dispose()
    print("\n[DONE] Migration completed successfully")


if __name__ == "__main__":
    drop_existing = len(sys.argv) > 1 and sys.argv[1] == "--drop"
    asyncio.run(run_migrations(drop_existing=drop_existing))
