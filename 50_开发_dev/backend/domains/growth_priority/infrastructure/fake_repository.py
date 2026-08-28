"""In-memory fake repository — the test double the current test suite runs
against (per `architecture/FAMILY_AI_PYTHON_ONLY_MIGRATION_PLAN_V1.md`
section 9 "FakeProvider" requirement). Mirrors the same invariants the real
repository must hold: idempotency-key replay, advisory-lock semantics
(approximated with a plain dict — no real cross-request concurrency
guarantee), family-manage-permission checks, the safety-route gate inputs,
the growth-subject resolver, draft-freshness, and the ACTIVE/SUPERSEDED
version-chain invariant on `growth_priorities` (same error codes as the
NestJS `growth-priority.service.ts`, per research doc section 3).
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime

from ..domain.entities import GrowthPriority, GrowthPriorityCandidate, GrowthPriorityDraft
from ..domain.errors import (
    GrowthPriorityConflictError,
    GrowthPriorityForbiddenError,
    GrowthPriorityNotFoundError,
)
from ..domain.state_machine import supersede
from ..domain.value_objects import GrowthPriorityStatus, SafetyDisposition, SafetySeverity

DEFAULT_TEST_ACTOR = "actor-1"
FAMILY_MANAGE_ROLES = ("OWNER_GUARDIAN", "GUARDIAN")


@dataclass
class FakeGrowthPriorityRepository:
    """Not thread-safe / not process-safe — intentional, this is a unit-test
    double, not a substitute for a real Postgres-backed repository.
    """

    families: set[str] = field(default_factory=set)
    family_memberships: dict[tuple[str, str], str] = field(default_factory=dict)
    onboardings: dict[tuple[str, str], dict] = field(default_factory=dict)  # (family_id, onboarding_id) -> row
    intervention_episodes: dict[str, list[dict]] = field(default_factory=dict)  # onboarding_id -> episodes
    perspective_dispositions: dict[str, list[SafetyDisposition | None]] = field(default_factory=dict)
    resolved_subjects: dict[tuple[str, str], str] = field(default_factory=dict)  # (family_id, onboarding_id) -> child
    candidates: dict[tuple[str, str], GrowthPriorityCandidate | None] = field(default_factory=dict)
    priorities: dict[str, GrowthPriority] = field(default_factory=dict)  # priority_id -> row
    operations: dict[tuple[str, str, str], dict] = field(default_factory=dict)  # (family,action,key) -> {request_hash, response_body}
    audit_log: list[dict] = field(default_factory=list)
    outbox: list[dict] = field(default_factory=list)
    _draft_version: dict[tuple[str, str], int] = field(default_factory=dict)

    # --- seeding helpers -------------------------------------------------

    def seed_family(self, family_id: str) -> None:
        self.families.add(family_id)
        self.grant_family_manage_permission(family_id, DEFAULT_TEST_ACTOR, role="OWNER_GUARDIAN")

    def grant_family_manage_permission(self, family_id: str, actor_id: str, role: str = "OWNER_GUARDIAN") -> None:
        self.family_memberships[(family_id, actor_id)] = role

    def seed_active_onboarding(self, family_id: str, onboarding_id: str) -> None:
        self.onboardings[(family_id, onboarding_id)] = {
            "journey_type": "PARENT_CHILD_COMMUNICATION_CONFLICT",
            "phase": "ONBOARDING",
            "status": "ACTIVE",
        }
        # Default: safety route is normal, no perspective abnormalities.
        self.perspective_dispositions[onboarding_id] = []

    def seed_safety_route(
        self,
        onboarding_id: str,
        severity: SafetySeverity = SafetySeverity.LOW,
        disposition: SafetyDisposition = SafetyDisposition.NORMAL,
        perspective_dispositions: list[SafetyDisposition | None] | None = None,
    ) -> None:
        self._safety_route = getattr(self, "_safety_route", {})
        self._safety_route[onboarding_id] = (severity, disposition)
        if perspective_dispositions is not None:
            self.perspective_dispositions[onboarding_id] = perspective_dispositions

    def seed_resolved_subject(self, family_id: str, onboarding_id: str, subject_person_id: str) -> None:
        self.resolved_subjects[(family_id, onboarding_id)] = subject_person_id

    def seed_candidate(
        self, family_id: str, onboarding_id: str, dimension_id: str, reason_codes: list[str] | None = None
    ) -> None:
        self.candidates[(family_id, onboarding_id)] = GrowthPriorityCandidate(
            dimension_id=dimension_id,  # type: ignore[arg-type]
            reason_codes=reason_codes or [],
            evidence_refs=[],
        )

    def seed_no_candidate(self, family_id: str, onboarding_id: str) -> None:
        self.candidates[(family_id, onboarding_id)] = None

    def seed_active_intervention_episode(self, onboarding_id: str) -> None:
        self.intervention_episodes.setdefault(onboarding_id, []).append({"status": "ACTIVE"})

    def bump_draft(self, family_id: str, onboarding_id: str) -> None:
        """Simulates evidence changing under the parent's feet between
        reading a draft and confirming it — bumps the freshness token so a
        previously-fetched `draft_id` becomes stale (research doc 3.2 step
        6)."""
        key = (family_id, onboarding_id)
        self._draft_version[key] = self._draft_version.get(key, 0) + 1

    # --- GrowthPriorityRepositoryPort ------------------------------------

    async def assert_family_exists(self, family_id: str) -> None:
        if family_id not in self.families:
            raise GrowthPriorityNotFoundError("family_not_found")

    async def assert_family_manage_permission(self, family_id: str, actor_id: str) -> None:
        if self.family_memberships.get((family_id, actor_id)) not in FAMILY_MANAGE_ROLES:
            raise GrowthPriorityForbiddenError("actor_has_family_manage_permission")

    async def assert_active_onboarding(self, family_id: str, onboarding_id: str) -> None:
        row = self.onboardings.get((family_id, onboarding_id))
        if row is None or row["status"] != "ACTIVE" or row["phase"] != "ONBOARDING":
            raise GrowthPriorityNotFoundError("active_growth_onboarding_not_found")

    async def has_active_intervention_episode(self, onboarding_id: str) -> bool:
        return any(episode["status"] == "ACTIVE" for episode in self.intervention_episodes.get(onboarding_id, []))

    async def load_safety_route(
        self, onboarding_id: str
    ) -> tuple[SafetySeverity, SafetyDisposition, list[SafetyDisposition | None]]:
        severity, disposition = getattr(self, "_safety_route", {}).get(
            onboarding_id, (SafetySeverity.LOW, SafetyDisposition.NORMAL)
        )
        return severity, disposition, list(self.perspective_dispositions.get(onboarding_id, []))

    async def resolve_growth_subject(self, family_id: str, onboarding_id: str) -> str:
        subject = self.resolved_subjects.get((family_id, onboarding_id))
        if subject is None:
            raise GrowthPriorityConflictError("growth_subject_unresolved")
        return subject

    async def build_draft(self, family_id: str, onboarding_id: str) -> GrowthPriorityDraft:
        version = self._draft_version.get((family_id, onboarding_id), 0)
        return GrowthPriorityDraft(
            draft_id=f"draft:{family_id}:{onboarding_id}:{version}",
            onboarding_id=onboarding_id,
            family_id=family_id,
            policy_version="v1",
            candidate=self.candidates.get((family_id, onboarding_id)),
        )

    async def load_active_priority(self, family_id: str, onboarding_id: str) -> GrowthPriority | None:
        for priority in self.priorities.values():
            if (
                priority.family_id == family_id
                and priority.onboarding_id == onboarding_id
                and priority.status == GrowthPriorityStatus.ACTIVE
            ):
                return priority
        return None

    async def insert_priority(
        self,
        family_id: str,
        onboarding_id: str,
        profile_id: str,
        candidate: GrowthPriorityCandidate,
        confirmed_by_actor_id: str,
        previous: GrowthPriority | None,
    ) -> GrowthPriority:
        now = datetime.now(UTC)
        if previous is not None:
            # Port of supersedeActivePriority — mutate the existing row
            # in-place to SUPERSEDED, never delete it (version chain).
            previous.status = supersede(previous.status)
            previous.superseded_at = now

        priority = GrowthPriority(
            priority_id=str(uuid.uuid4()),
            family_id=family_id,
            profile_id=profile_id,
            dimension_id=candidate.dimension_id,
            rank=1,
            confirmed_by_actor_id=confirmed_by_actor_id,
            confirmed_at=now,
            onboarding_id=onboarding_id,
            status=GrowthPriorityStatus.ACTIVE,
            version=(previous.version + 1) if previous is not None else 1,
            reason_codes=candidate.reason_codes,
            evidence_refs=candidate.evidence_refs,
            previous_priority_id=previous.priority_id if previous is not None else None,
        )
        self.priorities[priority.priority_id] = priority
        return priority

    async def lock_operation(self, family_id: str, action: str, idempotency_key: str) -> None:
        return None  # advisory-lock semantics only meaningful against real Postgres

    async def load_operation_replay(
        self, family_id: str, action: str, idempotency_key: str, request_hash: str
    ) -> dict | None:
        key = (family_id, action, idempotency_key)
        record = self.operations.get(key)
        if record is None:
            return None
        if record["request_hash"] != request_hash:
            raise GrowthPriorityConflictError("idempotency_key_payload_mismatch")
        return record["response_body"]

    async def persist_operation(
        self, family_id: str, action: str, idempotency_key: str, request_hash: str, receipt: dict
    ) -> None:
        self.operations[(family_id, action, idempotency_key)] = {
            "request_hash": request_hash,
            "response_body": receipt,
        }

    async def write_audit_and_outbox(
        self, family_id: str, actor_id: str, resource_id: str, action: str, event_name: str, receipt: dict
    ) -> None:
        self.audit_log.append(
            {"family_id": family_id, "actor_id": actor_id, "action": action, "resource_id": resource_id}
        )
        self.outbox.append({"aggregate_id": resource_id, "event_name": event_name, "payload": receipt})
