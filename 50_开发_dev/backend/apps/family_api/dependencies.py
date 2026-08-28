"""Dependency wiring — overrides the `NotImplementedError`-raising stubs in
`domains/assessment/api/dependencies.py` with real implementations backed by
a per-request DB connection. This is the ONE place that decides "how do
handlers get a real repository/cache/interpretation adapter" — domain code
never imports these choices directly (per the four-layer rule).
"""
from __future__ import annotations

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncConnection

from domains.assessment.application.commands import AssessmentCommandHandler
from domains.assessment.application.growth_hypothesis_commands import GrowthHypothesisCommandHandler
from domains.assessment.application.queries import AssessmentQueryHandler
from domains.assessment.infrastructure.cached_query_handler import CachedAssessmentQueryHandler
from domains.assessment.infrastructure.deterministic_interpretation import DeterministicInterpretationAdapter
from domains.assessment.infrastructure.fake_cache import FakeQueryCache
from domains.assessment.infrastructure.sqlalchemy_repository import SqlAlchemyAssessmentRepository

from .db import get_connection

# Process-lifetime cache instance. NOTE: this is `FakeQueryCache` (in-memory,
# single-process) — a real Redis-backed `QueryCachePort` implementation is
# still open work (see task report). Using the fake here means the cache
# does not survive process restarts and does not work across multiple
# `family_api` worker processes; acceptable for PYTHON_READY-stage local
# verification, not for a multi-worker production deployment.
_query_cache = FakeQueryCache()


def get_repository(connection: AsyncConnection = Depends(get_connection)) -> SqlAlchemyAssessmentRepository:
    return SqlAlchemyAssessmentRepository(connection)


def get_interpretation_adapter() -> DeterministicInterpretationAdapter:
    # Always the deterministic/mock adapter for now — a live AI Runtime
    # provider adapter is separate, un-implemented follow-up work (see task
    # report). This is G1-A's binding fail-closed default, not a shortcut.
    return DeterministicInterpretationAdapter()


def get_command_handler(repository: SqlAlchemyAssessmentRepository = Depends(get_repository)) -> AssessmentCommandHandler:
    return AssessmentCommandHandler(repository)


def get_query_handler(
    repository: SqlAlchemyAssessmentRepository = Depends(get_repository),
    interpretation: DeterministicInterpretationAdapter = Depends(get_interpretation_adapter),
) -> CachedAssessmentQueryHandler:
    return CachedAssessmentQueryHandler(repository, interpretation, _query_cache)


def get_growth_hypothesis_handler(
    repository: SqlAlchemyAssessmentRepository = Depends(get_repository),
    interpretation: DeterministicInterpretationAdapter = Depends(get_interpretation_adapter),
) -> GrowthHypothesisCommandHandler:
    return GrowthHypothesisCommandHandler(repository, interpretation)
