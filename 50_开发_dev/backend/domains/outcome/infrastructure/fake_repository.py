"""In-memory fake repository — the test double the current test suite runs
against (per `architecture/FAMILY_AI_PYTHON_ONLY_MIGRATION_PLAN_V1.md`
section 9 "FakeProvider" requirement). Mirrors the same invariants the real
repository must hold: idempotency-key replay, advisory-lock semantics
(approximated with a plain dict), tenant/family scope + manage-permission
checks, and the same error codes.

Permission check: `assert_tenant_family_scope` implements BOTH pass
conditions of `assertFamilyManagePermission` (family-permission.ts) — the
legacy `CreateFamily` audit branch AND the `family_memberships` tenancy
branch — matching the authoritative semantics rather than the confirmed
NestJS `growth-review.service.ts` bug (legacy-only). See
`domain/permission_policy.py` for the documented rationale, and
`domains/assessment/infrastructure/fake_repository.py` for the identical
pattern this domain mirrors.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from ..domain.entities import GrowthReview, NextStepDecision, OutcomeObservation, TimelineEntry
from ..domain.errors import OutcomeConflictError, OutcomeForbiddenError
from ..domain.permission_policy import FAMILY_MANAGE_ROLES

DEFAULT_TEST_ACTOR = "actor-1"


@dataclass
class FakeOutcomeRepository:
    """Not thread-safe / not process-safe — intentional, this is a unit-test
    double, not a substitute for the real Postgres-backed repository.
    """

    families: set[str] = field(default_factory=set)
    tenant_family_bindings: set[tuple[str, str]] = field(default_factory=set)
    # (family_id, actor_id) -> a successful legacy `CreateFamily` audit exists.
    # Port of the `assertFamilyManagePermission` pass condition #1.
    create_family_audit: set[tuple[str, str]] = field(default_factory=set)
    # (family_id, person_id) -> role, for ACTIVE family_memberships rows.
    # Port of the `assertFamilyManagePermission` pass condition #2.
    family_memberships: dict[tuple[str, str], str] = field(default_factory=dict)
    consents: set[tuple[str, str, str]] = field(default_factory=set)  # (family_id, subject_person_id, purpose)
    safety_routes: dict[tuple[str, str], str] = field(default_factory=dict)  # (family_id, onboarding_id) -> route
    growth_subjects: dict[tuple[str, str], tuple[str, set[str]]] = field(default_factory=dict)
    person_types: dict[str, str] = field(default_factory=dict)  # person_id -> PARENT/CHILD

    observations: dict[str, OutcomeObservation] = field(default_factory=dict)
    reviews: dict[str, GrowthReview] = field(default_factory=dict)
    decisions: dict[str, NextStepDecision] = field(default_factory=dict)

    operations: dict[tuple[str, str, str, str], dict] = field(default_factory=dict)
    audit_log: list[dict] = field(default_factory=list)
    outbox: list[dict] = field(default_factory=list)

    def seed_family(self, tenant_id: str, family_id: str) -> None:
        self.families.add(family_id)
        self.tenant_family_bindings.add((tenant_id, family_id))
        # Every existing test drives commands/queries as actor `"actor-1"`
        # without separately seeding a membership — grant it OWNER_GUARDIAN
        # here (mirrors a family always having its creator as an
        # OWNER_GUARDIAN member) so `assert_tenant_family_scope` doesn't
        # regress every pre-existing test. Tests exercising the "no manage
        # permission" path use `grant_family_manage_permission` / a bare
        # actor id instead.
        self.grant_family_manage_permission(family_id, DEFAULT_TEST_ACTOR, role="OWNER_GUARDIAN")

    def grant_family_manage_permission(self, family_id: str, person_id: str, role: str = "OWNER_GUARDIAN") -> None:
        """Port of an ACTIVE `family_memberships` row with a manage-eligible
        role — pass condition #2 (tenancy) in `assertFamilyManagePermission`.
        """
        self.family_memberships[(family_id, person_id)] = role

    def seed_create_family_audit(self, family_id: str, actor_id: str) -> None:
        """Port of a SUCCESS `CreateFamily` `audit_logs` row — pass
        condition #1 (legacy creator) in `assertFamilyManagePermission`.
        """
        self.create_family_audit.add((family_id, actor_id))

    def seed_consent(self, family_id: str, subject_person_id: str, purpose: str) -> None:
        self.consents.add((family_id, subject_person_id, purpose))

    def seed_normal_safety_route(self, family_id: str, onboarding_id: str) -> None:
        self.safety_routes[(family_id, onboarding_id)] = "NORMAL"

    def seed_growth_subject(
        self, family_id: str, onboarding_id: str, child_person_id: str, guardian_person_ids: set[str]
    ) -> None:
        self.growth_subjects[(family_id, onboarding_id)] = (child_person_id, guardian_person_ids)

    def seed_person_type(self, person_id: str, person_type: str) -> None:
        self.person_types[person_id] = person_type

    async def assert_tenant_family_scope(self, tenant_id: str, family_id: str, actor_id: str) -> None:
        if (tenant_id, family_id) not in self.tenant_family_bindings:
            raise OutcomeForbiddenError("tenant_family_scope_denied")

        # Port of `assertFamilyManagePermission` — BOTH pass conditions,
        # OR'd. See module docstring for why this domain intentionally
        # implements both, unlike the NestJS source it is ported from.
        if (family_id, actor_id) in self.create_family_audit:
            return
        if self.family_memberships.get((family_id, actor_id)) in FAMILY_MANAGE_ROLES:
            return
        raise OutcomeForbiddenError("actor_has_family_manage_permission")

    async def assert_required_growth_consents(self, family_id: str, subject_person_id: str) -> None:
        required = ("SERVICE", "ASSESSMENT", "GROWTH_TRACKING")
        for purpose in required:
            if (family_id, subject_person_id, purpose) not in self.consents:
                raise OutcomeForbiddenError("missing_required_consent")

    async def assert_normal_safety_route(self, family_id: str, onboarding_id: str) -> None:
        if self.safety_routes.get((family_id, onboarding_id)) != "NORMAL":
            raise OutcomeForbiddenError("normal_safety_route_required")

    async def resolve_growth_subject(self, family_id: str, onboarding_id: str) -> tuple[str, set[str]]:
        resolved = self.growth_subjects.get((family_id, onboarding_id))
        if resolved is None:
            raise OutcomeConflictError("growth_subject_unresolved")
        return resolved

    async def load_person_type(self, person_id: str) -> str | None:
        return self.person_types.get(person_id)

    async def lock_operation(self, tenant_id: str, family_id: str, action: str, idempotency_key: str) -> None:
        return None  # advisory-lock semantics only meaningful against real Postgres

    async def load_operation_replay(
        self, tenant_id: str, family_id: str, action: str, idempotency_key: str, request_hash: str
    ) -> dict | None:
        key = (tenant_id, family_id, action, idempotency_key)
        record = self.operations.get(key)
        if record is None:
            return None
        if record["request_hash"] != request_hash:
            raise OutcomeConflictError("idempotency_key_payload_mismatch")
        return record["response_body"]

    async def persist_operation(
        self,
        tenant_id: str,
        family_id: str,
        resource_id: str,
        actor_id: str,
        action: str,
        request_hash: str,
        receipt: dict,
        correlation_id: str,
        idempotency_key: str,
    ) -> None:
        self.operations[(tenant_id, family_id, action, idempotency_key)] = {
            "request_hash": request_hash,
            "response_body": receipt,
        }

    async def write_audit_and_outbox(
        self,
        family_id: str,
        actor_id: str,
        resource_id: str,
        action: str,
        event_name: str,
        receipt: dict,
        correlation_id: str,
        idempotency_key: str,
        source: str,
    ) -> None:
        self.audit_log.append(
            {
                "family_id": family_id,
                "actor_id": actor_id,
                "action": action,
                "resource_id": resource_id,
                "correlation_id": correlation_id,
            }
        )
        self.outbox.append(
            {
                "aggregate_id": resource_id,
                "event_name": event_name,
                "correlation_id": correlation_id,
                "payload": receipt,
            }
        )

    async def insert_outcome_observation(self, observation: OutcomeObservation) -> None:
        self.observations[observation.observation_id] = observation

    async def list_observations_for_episode(self, intervention_episode_id: str) -> list[OutcomeObservation]:
        matches = [
            observation
            for observation in self.observations.values()
            if observation.intervention_episode_id == intervention_episode_id
        ]
        matches.sort(key=lambda observation: observation.observed_at)
        return matches

    async def load_review_by_episode(self, intervention_episode_id: str) -> GrowthReview | None:
        for review in self.reviews.values():
            if review.intervention_episode_id == intervention_episode_id:
                return review
        return None

    async def insert_growth_review(self, review: GrowthReview) -> None:
        self.reviews[review.review_id] = review

    async def load_review(self, family_id: str, review_id: str) -> GrowthReview | None:
        review = self.reviews.get(review_id)
        if review is None or review.family_id != family_id:
            return None
        return review

    async def load_decision_by_review(self, review_id: str) -> NextStepDecision | None:
        for decision in self.decisions.values():
            if decision.review_id == review_id:
                return decision
        return None

    async def insert_next_step_decision(self, decision: NextStepDecision) -> None:
        self.decisions[decision.decision_id] = decision

    async def load_timeline(self, family_id: str, onboarding_id: str) -> list[TimelineEntry]:
        """Port of `getTimeline`'s 5-way union. The fake only projects the
        3 event types this domain itself writes (OUTCOME_OBSERVATION_RECORDED
        / GROWTH_REVIEW_COMPLETED / NEXT_STEP_DECISION_RECORDED) — the other
        2 (INTERVENTION_STARTED / GROWTH_ACTION_COMPLETED) are owned by the
        Intervention/Action domain's tables and are out of this fake's scope
        (real repository joins across all 5; this test double is Outcome's
        own contribution to that union).
        """
        entries: list[TimelineEntry] = []
        for observation in self.observations.values():
            if observation.family_id != family_id:
                continue
            entries.append(
                TimelineEntry(
                    event_type="OUTCOME_OBSERVATION_RECORDED",
                    occurred_at=observation.observed_at,
                    payload={
                        "observation_id": observation.observation_id,
                        "perspective_type": observation.perspective_type,
                    },
                )
            )
        for review in self.reviews.values():
            if review.family_id != family_id or review.onboarding_id != onboarding_id:
                continue
            entries.append(
                TimelineEntry(
                    event_type="GROWTH_REVIEW_COMPLETED",
                    occurred_at=review.completed_at,
                    payload={"review_id": review.review_id, "dimension_id": review.dimension_id},
                )
            )
        for decision in self.decisions.values():
            if decision.family_id != family_id:
                continue
            review = self.reviews.get(decision.review_id)
            if review is not None and review.onboarding_id != onboarding_id:
                continue
            entries.append(
                TimelineEntry(
                    event_type="NEXT_STEP_DECISION_RECORDED",
                    occurred_at=decision.decided_at,
                    payload={"decision_id": decision.decision_id, "decision": decision.decision},
                )
            )
        entries.sort(key=lambda entry: (entry.occurred_at, entry.event_type))
        return entries
