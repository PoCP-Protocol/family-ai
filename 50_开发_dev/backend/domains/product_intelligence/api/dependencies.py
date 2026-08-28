"""FastAPI dependency wiring for this domain's repository port.

Not included in any app yet — `apps/family_api` (per
`architecture/FAMILY_AI_PYTHON_ONLY_MIGRATION_PLAN_V1.md` section 2) has not
been bootstrapped by any batch as of this PR. This module is real and
importable/testable on its own (see `tests/`), but `router` in `routes.py`
is not mounted anywhere until an app exists to mount it into.
"""
from __future__ import annotations

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession

from ..application.ports import ProductIntelligenceRepositoryPort
from ..infrastructure.sqlalchemy_repository import SqlAlchemyProductIntelligenceRepository

_session_factory = None  # set by the owning app at startup; not configured in this PR


async def get_repository() -> AsyncGenerator[ProductIntelligenceRepositoryPort, None]:
    if _session_factory is None:
        raise RuntimeError("product_intelligence session factory not configured — no owning app exists yet")
    async with _session_factory() as session:  # type: AsyncSession
        yield SqlAlchemyProductIntelligenceRepository(session)
