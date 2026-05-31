"""
AI Service database migration script.

Creates all tables for the AI service with pgvector extension enabled.
This script can be run standalone or integrated with Alembic.

Usage:
    python -m app.infrastructure.db.migrations

Tables created:
    - embedding_documents (with vector column sized from EMBEDDING_DIMENSION)
    - chat_logs
    - user_interactions
    - recommendation_logs
    - customer_segments
    - segmentation_runs
    - product_classifications

Prerequisites:
    - PostgreSQL database with pgvector extension available
    - DATABASE_URL environment variable set
"""

import os
import sys

from sqlalchemy import create_engine, text
from sqlalchemy.exc import ProgrammingError

# Import models to register them with Base.metadata
import app.infrastructure.db.models  # noqa: F401
from app.infrastructure.db.database import Base


def get_database_url() -> str:
    """Get database URL from environment variable."""
    database_url = os.environ.get("DATABASE_URL", "")
    if not database_url:
        raise RuntimeError(
            "DATABASE_URL environment variable is not set. "
            "Example: postgres://techshop:techshop@ai-postgres:5432/ai_db"
        )
    # SQLAlchemy 2.0 requires postgresql:// instead of postgres://
    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql://", 1)
    return database_url


def enable_pgvector_extension(engine) -> None:
    """
    Enable the pgvector extension in the database.

    This must be done before creating tables that use the vector type.
    Requires superuser or the extension to be pre-installed.
    """
    with engine.connect() as conn:
        try:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
            conn.commit()
            print("[OK] pgvector extension enabled")
        except ProgrammingError as e:
            print(f"[WARNING] Could not enable pgvector extension: {e}")
            print(
                "  Make sure pgvector is installed in your PostgreSQL instance."
            )
            conn.rollback()
            raise


def create_all_tables(engine) -> None:
    """
    Create all AI service tables using SQLAlchemy metadata.

    Tables are created only if they don't already exist (checkfirst=True).
    """
    Base.metadata.create_all(engine, checkfirst=True)
    print("[OK] All AI service tables created successfully")


def drop_all_tables(engine) -> None:
    """
    Drop all AI service tables.

    WARNING: This will permanently delete all data. Use with caution.
    """
    Base.metadata.drop_all(engine)
    print("[OK] All AI service tables dropped")


def run_migrations(drop_existing: bool = False) -> None:
    """
    Run the full migration process:
    1. Enable pgvector extension
    2. Optionally drop existing tables
    3. Create all tables

    Args:
        drop_existing: If True, drops all tables before recreating them.
    """
    database_url = get_database_url()
    engine = create_engine(database_url, echo=False)

    print(f"[INFO] Connecting to database...")
    print(f"[INFO] Running AI service migrations...")

    # Step 1: Enable pgvector extension
    enable_pgvector_extension(engine)

    # Step 2: Optionally drop existing tables
    if drop_existing:
        print("[INFO] Dropping existing tables...")
        drop_all_tables(engine)

    # Step 3: Create all tables
    create_all_tables(engine)

    # Print summary
    print("\n[INFO] Migration summary:")
    print("  Tables:")
    for table_name in sorted(Base.metadata.tables.keys()):
        print(f"    - {table_name}")

    engine.dispose()
    print("\n[DONE] Migration completed successfully")


def print_sql() -> None:
    """
    Print the SQL statements that would be executed without running them.

    Useful for reviewing the migration before applying it.
    """
    from sqlalchemy import create_engine
    from sqlalchemy.schema import CreateTable

    # Use a dummy URL for SQL generation
    engine = create_engine("postgresql://", strategy="mock", executor=_dump_sql)

    print("-- Enable pgvector extension")
    print("CREATE EXTENSION IF NOT EXISTS vector;")
    print()

    print("-- Create tables")
    for table in Base.metadata.sorted_tables:
        print(CreateTable(table).compile(dialect=engine.dialect))
        print(";")
        print()


def _dump_sql(sql, *args, **kwargs):
    """Mock executor for SQL printing."""
    print(sql.compile(dialect=kwargs.get("dialect")))


def generate_raw_sql() -> str:
    """
    Generate raw SQL for all tables as a string.

    Returns the complete SQL migration script including
    pgvector extension and all CREATE TABLE statements.
    """
    from sqlalchemy import create_engine
    from sqlalchemy.schema import CreateTable

    # Create a PostgreSQL dialect for proper SQL generation
    from sqlalchemy.dialects import postgresql

    lines = []
    lines.append("-- AI Service Database Migration")
    lines.append("-- Generated from SQLAlchemy models")
    lines.append("")
    lines.append("-- Enable pgvector extension")
    lines.append("CREATE EXTENSION IF NOT EXISTS vector;")
    lines.append("")

    for table in Base.metadata.sorted_tables:
        create_stmt = CreateTable(table).compile(
            dialect=postgresql.dialect()
        )
        lines.append(f"-- Table: {table.name}")
        lines.append(str(create_stmt).strip() + ";")
        lines.append("")

    return "\n".join(lines)


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--sql":
        # Print SQL without executing
        sql = generate_raw_sql()
        print(sql)
    elif len(sys.argv) > 1 and sys.argv[1] == "--drop":
        # Drop and recreate all tables
        run_migrations(drop_existing=True)
    else:
        # Normal migration: create tables if not exist
        run_migrations(drop_existing=False)
