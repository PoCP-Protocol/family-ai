"""Test fixtures. Uses an in-memory SQLite async engine against the same
SQLAlchemy models as production — closer to "real" than the Fake-dict
repository, but not a real-Postgres guarantee (Override #6 item 4, same
known/accepted gap as Batch 2 per Override #4 item 4).
"""
from __future__ import annotations

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from ..infrastructure.sqlalchemy_models import Base
from ..infrastructure.sqlalchemy_repository import SqlAlchemyProductIntelligenceRepository


@pytest_asyncio.fixture
async def sqlalchemy_repo():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        yield SqlAlchemyProductIntelligenceRepository(session)
    await engine.dispose()


@pytest.fixture
def fake_repo():
    from ..infrastructure.fake_repository import FakeProductIntelligenceRepository
    return FakeProductIntelligenceRepository()


@pytest.fixture
def human_context():
    from ..application.context import ActorContext
    return ActorContext(actor_id="human-reviewer-1", actor_type="HUMAN", tenant_scope="tenant-a")


@pytest.fixture
def ai_context():
    from ..application.context import ActorContext
    return ActorContext(actor_id="ai-use-case:market.insight.generate", actor_type="AI", tenant_scope="tenant-a")


@pytest.fixture
def other_tenant_human_context():
    from ..application.context import ActorContext
    return ActorContext(actor_id="human-reviewer-2", actor_type="HUMAN", tenant_scope="tenant-b")
