"""Database connection pool lifecycle — created once at app startup, disposed
at shutdown. Per migration plan section 5 ("no dual-write during migration")
this pool talks to the SAME PostgreSQL database the NestJS app uses; this
Python process is read/write-capable for the Assessment domain tables only
during the `PYTHON_READY` verification stage, not yet `PYTHON_ACTIVE`
(cutover has not happened — see CURRENT_SPRINT.md Override #3).
"""
from __future__ import annotations

import os
from contextlib import asynccontextmanager

from sqlalchemy.ext.asyncio import AsyncConnection, AsyncEngine, create_async_engine

_engine: AsyncEngine | None = None


def get_engine() -> AsyncEngine:
    if _engine is None:
        raise RuntimeError("database_engine_not_initialized — did the app lifespan run?")
    return _engine


async def init_engine(database_url: str | None = None) -> AsyncEngine:
    global _engine
    url = database_url or os.environ.get("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL not set — see .env.example")
    # NestJS's DATABASE_URL is `postgres://...`; SQLAlchemy's asyncpg dialect
    # needs the `postgresql+asyncpg://` scheme. Rewrite rather than requiring
    # a second env var, so both processes can share one .env during the
    # PYTHON_READY verification stage.
    if url.startswith("postgres://"):
        url = "postgresql+asyncpg://" + url[len("postgres://") :]
    elif url.startswith("postgresql://"):
        url = "postgresql+asyncpg://" + url[len("postgresql://") :]
    _engine = create_async_engine(url, pool_size=10, max_overflow=5, pool_pre_ping=True)
    return _engine


async def dispose_engine() -> None:
    global _engine
    if _engine is not None:
        await _engine.dispose()
        _engine = None


@asynccontextmanager
async def transactional_connection():
    """One connection + one transaction per request — mirrors NestJS's
    `this.repository.withTransaction(async (client) => {...})` unit-of-work
    boundary. Commits on success, rolls back on any exception (including
    domain errors raised inside the handler — a 400/403/404/409 response
    must not leave a half-written transaction).
    """
    engine = get_engine()
    async with engine.connect() as conn:
        async with conn.begin():
            yield conn


async def get_connection() -> AsyncConnection:
    """FastAPI dependency — see `apps/family_api/dependencies.py` for how
    this is wired into `Depends(...)`. Kept here (not there) because it is
    the one piece of DB lifecycle the `db` module owns; `dependencies.py`
    only wires business objects on top of it.
    """
    async with transactional_connection() as conn:
        yield conn
