"""Real repository — SQLAlchemy Core against the existing PostgreSQL schema
(`family_assessment_sessions`, `family_assessment_responses`,
`family_assessment_tools`, `family_assessment_operations`,
`evidence_records`, `growth_intents`, `family_growth_hypothesis_decisions`,
`audit_logs`, `outbox_events`, `tenant_family_bindings`, `consents`,
`persons`, `tenant_policy_profiles`, `family_need_types`) — table names and
column shapes are unchanged from the NestJS migrations
(`database/migrations/0040_ui02_versioned_family_assessment.sql` etc.) per
the "single migration owner per schema, Alembic baseline not a rewrite"
rule in the migration plan section 5.

NOTE: this is the schema-facing adapter. It implements `AssessmentRepositoryPort`
against a live `AsyncConnection`. Full statement-by-statement parity with the
NestJS raw SQL (advisory locks, idempotency-hash replay, jsonb payloads) is
scoped for the next iteration of this task — see NEXT RECOMMENDED TASK in the
task-completion report. The in-memory `FakeAssessmentRepository` in
`fake_repository.py` is what the current test suite exercises; do not treat
this file as verified until it has its own integration tests against a real
PostgreSQL instance (per plan section 9 "Must complete").
"""
from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncConnection

from ..application.ports import AssessmentRepositoryPort


class SqlAlchemyAssessmentRepository(AssessmentRepositoryPort):
    """Skeleton — method bodies raise NotImplementedError until the
    statement-by-statement port from assessment.service.ts /
    growth-hypothesis.service.ts is completed and integration-tested.
    Intentionally not silently stubbed with fake data: a half-finished
    real-DB repository that looks complete is worse than one that fails
    loudly.
    """

    def __init__(self, connection: AsyncConnection):
        self._connection = connection

    async def assert_tenant_family_scope(self, tenant_id: str, family_id: str, actor_id: str) -> None:
        raise NotImplementedError("SqlAlchemyAssessmentRepository is a Batch-1 skeleton, not yet wired to real SQL")

    async def assert_subject_consent(self, family_id: str, subject_person_id: str, purpose: str) -> None:
        raise NotImplementedError

    async def load_active_tool(self, tool_ref: str):
        raise NotImplementedError

    async def load_tool_version(self, tool_ref: str, version_no: int):
        raise NotImplementedError

    async def load_assessable_subjects(self, family_id: str) -> list[dict]:
        raise NotImplementedError

    async def load_recent_sessions(self, tenant_id: str, family_id: str, limit: int = 10):
        raise NotImplementedError

    async def load_session(self, family_id: str, session_id: str):
        raise NotImplementedError

    async def load_session_for_update(self, family_id: str, tenant_id: str, session_id: str):
        raise NotImplementedError

    async def find_in_progress_session(self, tenant_id, family_id, subject_person_id, tool_ref, tool_version):
        raise NotImplementedError

    async def insert_session(self, tenant_id, family_id, subject_person_id, tool_ref, tool_version, started_by):
        raise NotImplementedError

    async def upsert_response(self, session_id, item_ref, response_type, response_value, actor_id) -> None:
        raise NotImplementedError

    async def mark_session_submitted(self, session_id: str) -> None:
        raise NotImplementedError

    async def insert_assessment_evidence(self, family_id: str, session_id: str, payload: dict) -> str:
        raise NotImplementedError

    async def tenant_allows_page(self, tenant_id: str, page_id: str) -> bool:
        raise NotImplementedError

    async def lock_operation(self, tenant_id: str, family_id: str, action: str, idempotency_key: str) -> None:
        raise NotImplementedError

    async def load_operation_replay(self, tenant_id, family_id, action, idempotency_key, request_hash):
        raise NotImplementedError

    async def persist_operation(self, tenant_id, family_id, session_id, actor_id, action, request_hash, receipt, correlation_id, idempotency_key) -> None:
        raise NotImplementedError

    async def write_audit_and_outbox(self, family_id, actor_id, session_id, action, event_name, receipt, correlation_id, idempotency_key, source) -> None:
        raise NotImplementedError

    async def load_hypothesis_evidence(self, family_id, tenant_id, session_id=None):
        raise NotImplementedError

    async def load_or_create_growth_intent(self, **kwargs) -> dict:
        raise NotImplementedError

    async def lock_hypothesis_decision(self, tenant_id: str, family_id: str, hypothesis_ref: str) -> None:
        raise NotImplementedError

    async def load_hypothesis_decision_replay(self, tenant_id, family_id, decision_type, idempotency_key):
        raise NotImplementedError

    async def persist_hypothesis_decision(self, **kwargs) -> None:
        raise NotImplementedError
