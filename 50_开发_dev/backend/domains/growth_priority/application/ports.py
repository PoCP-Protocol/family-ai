"""Ports (interfaces) the application layer depends on — implemented by
`infrastructure/`. Domain/application code never imports SQLAlchemy/FastAPI
directly; it depends on these Protocols instead, per the four-layer rule in
`architecture/FAMILY_AI_PYTHON_ONLY_MIGRATION_PLAN_V1.md` section 3.
"""
from __future__ import annotations

from typing import Protocol

from ..domain.entities import GrowthPriority, GrowthPriorityCandidate, GrowthPriorityDraft
from ..domain.value_objects import GrowthSubject, SafetyDisposition, SafetySeverity


class GrowthPriorityRepositoryPort(Protocol):
    """Mirrors the query/mutation surface `confirmGrowthPriority` uses in
    `growth-priority.service.ts` (research doc section 3.2), minus the
    consent gate (see `ConsentCheckPort` below — Consent is a separate
    Batch 2 domain and this domain must not block on it being implemented;
    it depends only on this narrow local Protocol).
    """

    async def assert_family_exists(self, family_id: str) -> None: ...

    async def assert_family_manage_permission(self, family_id: str, actor_id: str) -> None: ...

    async def assert_active_onboarding(self, family_id: str, onboarding_id: str) -> None: ...

    async def has_active_intervention_episode(self, onboarding_id: str) -> bool: ...

    async def load_safety_route(
        self, onboarding_id: str
    ) -> tuple[SafetySeverity, SafetyDisposition, list[SafetyDisposition | None]]:
        """Returns (onboarding-start severity, onboarding-start disposition,
        [perspective dispositions]) — the exact inputs
        `domain.policies.assert_normal_safety_route` needs."""
        ...

    async def resolve_growth_subject(self, family_id: str, onboarding_id: str) -> GrowthSubject:
        """Port of `GrowthSubjectResolver.resolve` (research doc section
        7.1) — returns the resolved `GrowthSubject` (child + guardian set),
        or raises a `GrowthPriorityConflictError`/`GrowthPriorityNotFoundError`
        with one of the ported `growth_subject_*` codes. Previously returned
        a bare `child_person_id: str`, dropping the resolver's own
        guardian-set resolution/mismatch step (research doc 7.1 point 6) —
        unified to the shared `GrowthSubject` shape across
        growth_priority/intervention/outcome."""
        ...

    async def build_draft(self, family_id: str, onboarding_id: str) -> GrowthPriorityDraft:
        """Port of `buildGrowthPriorityDraft` recomputation (research doc
        section 3.2 step 5) — always recomputed fresh, never read from a
        stored row."""
        ...

    async def load_active_priority(self, family_id: str, onboarding_id: str) -> GrowthPriority | None: ...

    async def insert_priority(
        self,
        family_id: str,
        onboarding_id: str,
        profile_id: str,
        candidate: GrowthPriorityCandidate,
        confirmed_by_actor_id: str,
        previous: GrowthPriority | None,
    ) -> GrowthPriority:
        """Port of `supersedeActivePriority` + `insertPriority` (research doc
        section 3.2 step 11) — if `previous` is not None, the repository
        must mark it SUPERSEDED (with `superseded_at`) in the same
        transaction as inserting the new ACTIVE row with
        `version = previous.version + 1` and
        `previous_priority_id = previous.priority_id`."""
        ...

    # --- idempotency / audit, ported from the lockOperation/persistOperation/auditAndEmit pattern ---

    async def lock_operation(self, family_id: str, action: str, idempotency_key: str) -> None: ...

    async def load_operation_replay(
        self, family_id: str, action: str, idempotency_key: str, request_hash: str
    ) -> dict | None: ...

    async def persist_operation(
        self, family_id: str, action: str, idempotency_key: str, request_hash: str, receipt: dict
    ) -> None: ...

    async def write_audit_and_outbox(
        self, family_id: str, actor_id: str, resource_id: str, action: str, event_name: str, receipt: dict
    ) -> None: ...


class ConsentCheckPort(Protocol):
    """Local, narrow Consent-check seam for the GrowthPriority domain.

    Port of `assertRequiredGrowthConsents` (research doc section 2.4) at the
    one call site `confirmGrowthPriority` uses it (research doc section 3.2
    step 10). Deliberately defined *inside this domain* rather than imported
    from a shared Consent domain package: the Consent domain (Batch 2,
    `architecture/notes/batch2-domain-research-v1.md` section 2) has not
    been ported to Python yet, and this domain must not block on it. Once
    the real Consent domain exists, its adapter can implement this same
    Protocol without any change to `application/commands.py`.
    """

    async def assert_required_growth_consents(self, family_id: str, subject_person_id: str) -> None:
        """Raises a `GrowthPriorityForbiddenError` (fail-closed) with a
        `growth_consent_*`-prefixed code if any consent required for the
        Growth main loop (research doc section 2.4) is missing for the
        resolved child subject."""
        ...
