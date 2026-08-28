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
from domains.assessment.application.ports import AssessmentInterpretationPort
from domains.assessment.application.queries import AssessmentQueryHandler
from domains.assessment.infrastructure.cached_query_handler import CachedAssessmentQueryHandler
from domains.assessment.infrastructure.ai_run_ledger import SqlAlchemyAiRunLedger
from domains.assessment.infrastructure.claude_interpretation import (
    ClaudeInterpretationAdapter,
    is_live_external_ai_authorized,
)
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

# Process-lifetime anthropic client, same rationale as before this task
# (AI Run Ledger): avoid constructing a fresh `anthropic.AsyncAnthropic()`
# per request. Only used when `is_live_external_ai_authorized()` is true.
_anthropic_client: object | None = None
if is_live_external_ai_authorized():
    import anthropic

    _anthropic_client = anthropic.AsyncAnthropic()


def get_repository(connection: AsyncConnection = Depends(get_connection)) -> SqlAlchemyAssessmentRepository:
    return SqlAlchemyAssessmentRepository(connection)


def get_ai_run_ledger(connection: AsyncConnection = Depends(get_connection)) -> SqlAlchemyAiRunLedger:
    """Per-request AI Run Ledger writer — uses the same per-request
    connection as the repository for simplicity, but issues its own commit
    (see `SqlAlchemyAiRunLedger`) so a ledger write is not lost if the
    caller's own transaction later rolls back for an unrelated domain
    reason, and so a ledger write failure cannot abort the caller's
    transaction either.
    """
    return SqlAlchemyAiRunLedger(connection)


def get_interpretation_adapter(
    ai_run_ledger: SqlAlchemyAiRunLedger = Depends(get_ai_run_ledger),
) -> AssessmentInterpretationPort:
    # The adapter itself is now constructed per-request (previously a
    # process-lifetime singleton) ONLY so the ledger can be wired to the
    # current request's connection — the underlying `anthropic` client
    # (the expensive part) stays a process-lifetime singleton via
    # `_anthropic_client` above, so this is not "construct a fresh
    # AsyncAnthropic() per request". `is_live_external_ai_authorized()` is
    # still the ONLY switch between the two adapters: both
    # FAMILY_MODEL_GATEWAY_MODE=live and
    # FAMILY_MODEL_ALLOW_LIVE_EXTERNAL_AI=true must be explicitly set
    # (G1-A's binding default is neither set, i.e. mock/deterministic).
    if is_live_external_ai_authorized():
        return ClaudeInterpretationAdapter(client=_anthropic_client, ai_run_ledger=ai_run_ledger)
    return DeterministicInterpretationAdapter(ai_run_ledger=ai_run_ledger)


def get_command_handler(repository: SqlAlchemyAssessmentRepository = Depends(get_repository)) -> AssessmentCommandHandler:
    return AssessmentCommandHandler(repository)


def get_query_handler(
    repository: SqlAlchemyAssessmentRepository = Depends(get_repository),
    interpretation: AssessmentInterpretationPort = Depends(get_interpretation_adapter),
) -> CachedAssessmentQueryHandler:
    return CachedAssessmentQueryHandler(repository, interpretation, _query_cache)


def get_growth_hypothesis_handler(
    repository: SqlAlchemyAssessmentRepository = Depends(get_repository),
    interpretation: AssessmentInterpretationPort = Depends(get_interpretation_adapter),
) -> GrowthHypothesisCommandHandler:
    return GrowthHypothesisCommandHandler(repository, interpretation)
