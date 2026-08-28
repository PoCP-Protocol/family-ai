"""Commands and their handlers for Outcome — ported 1:1 from
`GrowthReviewService.recordOutcomeObservation` / `.completeGrowthReview` /
`.recordNextStepDecision` (apps/api/src/modules/family/growth-review.service.ts),
per `architecture/notes/batch2-domain-research-v1.md` section 5.5. Every
idempotency-key / advisory-lock / audit / outbox step from the NestJS
implementation is preserved; this is a translation, not a redesign.

Permission note: `assert_tenant_family_scope` here — unlike the NestJS
`growth-review.service.ts`, which carries its own copy of
`assertFamilyManagePermission` that only implements the legacy `CreateFamily`
audit branch (a confirmed NestJS bug, see `domain/permission_policy.py`) —
is expected to evaluate BOTH the legacy audit branch and the
`family_memberships` tenancy branch, matching the authoritative
`family-permission.ts` semantics. That OR is implemented inside the
repository (`infrastructure/fake_repository.py` /
`infrastructure/sqlalchemy_repository.py`), not here; this handler only
calls the port once per mutation, same call shape as every other Batch
domain.
"""
from __future__ import annotations

import hashlib
import json
import re
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone

from ..domain.entities import ActionSummary, GrowthReview, NextStepDecision, OutcomeObservation
from ..domain.errors import (
    OutcomeConflictError,
    OutcomeNotFoundError,
    OutcomeValidationError,
)
from ..domain.policies import (
    assert_observation_observer,
    assert_observation_subject,
    assert_review_eligible,
    build_action_summary,
    build_review_limitations,
)
from ..domain.value_objects import (
    NEXT_STEP_DECISION_BOUNDARY,
    OBSERVATION_BOUNDARY,
    REVIEW_BOUNDARY,
    REVIEW_STATUS_COMPLETED,
    NextStepDecisionValue,
    PerspectiveType,
)
from .ports import InterventionEpisodeReadPort, OutcomeRepositoryPort

_UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$", re.IGNORECASE
)

# Policy version stamped on every write this domain makes — same pattern as
# `MUTATION_RECEIPT_BOUNDARY` in the Assessment domain, but this domain's
# three tables each carry their own `policy_version` column (see
# domain/entities.py) rather than a single shared receipt-boundary constant.
_POLICY_VERSION = "OUTCOME_V1"


def _is_uuid(value: str) -> bool:
    return bool(_UUID_RE.match(value))


def _hash_request(value: dict) -> str:
    return hashlib.sha256(json.dumps(value, sort_keys=True, default=str).encode("utf-8")).hexdigest()


@dataclass(frozen=True)
class MutationMeta:
    correlation_id: str
    idempotency_key: str
    source: str

    def require(self) -> None:
        if not self.idempotency_key or not self.idempotency_key.strip():
            raise OutcomeValidationError("idempotency_key_required")
        if len(self.idempotency_key) > 128:
            raise OutcomeValidationError("idempotency_key_too_long")


@dataclass(frozen=True)
class RecordOutcomeObservationCommand:
    family_id: str
    tenant_id: str
    actor_id: str
    onboarding_id: str
    intervention_episode_id: str
    subject_person_id: str
    observer_person_id: str
    perspective_type: PerspectiveType
    observation_text: str
    action_refs: list[str]
    reflection_refs: list[str]
    evidence_refs: list[str]
    meta: MutationMeta


@dataclass(frozen=True)
class CompleteGrowthReviewCommand:
    family_id: str
    tenant_id: str
    actor_id: str
    onboarding_id: str
    intervention_episode_id: str
    priority_id: str
    meta: MutationMeta


@dataclass(frozen=True)
class RecordNextStepDecisionCommand:
    family_id: str
    tenant_id: str
    actor_id: str
    review_id: str
    decision: NextStepDecisionValue
    rationale: str | None
    meta: MutationMeta


class OutcomeCommandHandler:
    """Port of `GrowthReviewService` mutation methods. Repository transaction
    boundaries are the caller's responsibility (FastAPI dependency / unit of
    work), mirroring `this.repository.withTransaction(...)` in the NestJS
    version — the handler receives an already-scoped repository.
    """

    def __init__(self, repository: OutcomeRepositoryPort, episodes: InterventionEpisodeReadPort):
        self._repository = repository
        self._episodes = episodes

    async def record_outcome_observation(self, command: RecordOutcomeObservationCommand) -> dict:
        command.meta.require()
        observation_text = command.observation_text.strip()
        if not observation_text or not (1 <= len(observation_text) <= 2000):
            raise OutcomeValidationError("valid_observation_text_required")

        request_hash = _hash_request(
            {
                "intervention_episode_id": command.intervention_episode_id,
                "subject_person_id": command.subject_person_id,
                "observer_person_id": command.observer_person_id,
                "perspective_type": command.perspective_type,
                "observation_text": observation_text,
                "action_refs": command.action_refs,
                "reflection_refs": command.reflection_refs,
                "evidence_refs": command.evidence_refs,
            }
        )

        await self._repository.lock_operation(
            command.tenant_id, command.family_id, "RECORD_OUTCOME_OBSERVATION", command.meta.idempotency_key
        )
        replay = await self._repository.load_operation_replay(
            command.tenant_id,
            command.family_id,
            "RECORD_OUTCOME_OBSERVATION",
            command.meta.idempotency_key,
            request_hash,
        )
        if replay is not None:
            return {**replay, "replayed": True}

        await self._repository.assert_tenant_family_scope(command.tenant_id, command.family_id, command.actor_id)

        episode = await self._episodes.load_episode(command.family_id, command.intervention_episode_id)
        if episode is None:
            raise OutcomeNotFoundError("intervention_episode_not_found")

        subject = await self._repository.resolve_growth_subject(command.family_id, command.onboarding_id)
        child_person_id, guardian_person_ids = subject.child_person_id, subject.guardian_person_ids
        await self._repository.assert_required_growth_consents(command.family_id, child_person_id)
        await self._repository.assert_normal_safety_route(command.family_id, command.onboarding_id)

        assert_observation_subject(command.subject_person_id, child_person_id)

        observer_person_type = await self._repository.load_person_type(command.observer_person_id)
        assert_observation_observer(
            command.perspective_type,
            observer_person_type or "",
            command.observer_person_id,
            command.subject_person_id,
            guardian_person_ids,
        )

        observation = OutcomeObservation(
            observation_id=str(uuid.uuid4()),
            family_id=command.family_id,
            subject_person_id=command.subject_person_id,
            observer_person_id=command.observer_person_id,
            intervention_episode_id=command.intervention_episode_id,
            perspective_type=command.perspective_type,
            observation_text=observation_text,
            action_refs=command.action_refs,
            reflection_refs=command.reflection_refs,
            evidence_refs=command.evidence_refs,
            limitations=[],
            observed_at=datetime.now(timezone.utc),
            boundary=OBSERVATION_BOUNDARY,
            policy_version=_POLICY_VERSION,
        )
        await self._repository.insert_outcome_observation(observation)

        receipt = {
            "action": "RECORD_OUTCOME_OBSERVATION",
            "replayed": False,
            "observation": observation.model_dump(mode="json"),
        }
        await self._repository.persist_operation(
            command.tenant_id,
            command.family_id,
            observation.observation_id,
            command.actor_id,
            "RECORD_OUTCOME_OBSERVATION",
            request_hash,
            receipt,
            command.meta.correlation_id,
            command.meta.idempotency_key,
        )
        await self._repository.write_audit_and_outbox(
            command.family_id,
            command.actor_id,
            observation.observation_id,
            "RECORD_OUTCOME_OBSERVATION",
            "OutcomeObservationRecorded",
            receipt,
            command.meta.correlation_id,
            command.meta.idempotency_key,
            command.meta.source,
        )
        return receipt

    async def complete_growth_review(self, command: CompleteGrowthReviewCommand) -> dict:
        command.meta.require()
        if not _is_uuid(command.intervention_episode_id):
            raise OutcomeValidationError("valid_intervention_episode_id_required")

        request_hash = _hash_request(
            {"intervention_episode_id": command.intervention_episode_id, "priority_id": command.priority_id}
        )

        await self._repository.lock_operation(
            command.tenant_id, command.family_id, "COMPLETE_GROWTH_REVIEW", command.meta.idempotency_key
        )
        replay = await self._repository.load_operation_replay(
            command.tenant_id, command.family_id, "COMPLETE_GROWTH_REVIEW", command.meta.idempotency_key, request_hash
        )
        if replay is not None:
            return {**replay, "replayed": True}

        await self._repository.assert_tenant_family_scope(command.tenant_id, command.family_id, command.actor_id)

        episode = await self._episodes.load_episode(command.family_id, command.intervention_episode_id)
        if episode is None:
            raise OutcomeNotFoundError("intervention_episode_not_found")

        subject = await self._repository.resolve_growth_subject(command.family_id, command.onboarding_id)
        child_person_id = subject.child_person_id
        await self._repository.assert_required_growth_consents(command.family_id, child_person_id)
        await self._repository.assert_normal_safety_route(command.family_id, command.onboarding_id)

        existing_review = await self._repository.load_review_by_episode(command.intervention_episode_id)
        if existing_review is not None:
            raise OutcomeConflictError("growth_review_already_completed")

        action_statuses = await self._episodes.list_episode_action_statuses(command.intervention_episode_id)
        now = datetime.now(timezone.utc)
        assert_review_eligible(episode, action_statuses, now)

        action_summary: ActionSummary = build_action_summary(action_statuses, episode.planned_days)

        observations = await self._repository.list_observations_for_episode(command.intervention_episode_id)
        observation_perspectives = [observation.perspective_type for observation in observations]
        limitations = build_review_limitations(action_summary, observation_perspectives)

        review = GrowthReview(
            review_id=str(uuid.uuid4()),
            family_id=command.family_id,
            onboarding_id=command.onboarding_id,
            intervention_episode_id=command.intervention_episode_id,
            priority_id=command.priority_id,
            dimension_id=episode.dimension_id,
            status=REVIEW_STATUS_COMPLETED,
            action_summary=action_summary,
            observation_ids=[observation.observation_id for observation in observations],
            limitations=limitations,
            boundary=REVIEW_BOUNDARY,
            policy_version=_POLICY_VERSION,
            completed_by_actor_id=command.actor_id,
            completed_at=now,
        )
        await self._repository.insert_growth_review(review)

        receipt = {
            "action": "COMPLETE_GROWTH_REVIEW",
            "replayed": False,
            "review": review.model_dump(mode="json"),
        }
        await self._repository.persist_operation(
            command.tenant_id,
            command.family_id,
            review.review_id,
            command.actor_id,
            "COMPLETE_GROWTH_REVIEW",
            request_hash,
            receipt,
            command.meta.correlation_id,
            command.meta.idempotency_key,
        )
        await self._repository.write_audit_and_outbox(
            command.family_id,
            command.actor_id,
            review.review_id,
            "COMPLETE_GROWTH_REVIEW",
            "GrowthReviewCompleted",
            receipt,
            command.meta.correlation_id,
            command.meta.idempotency_key,
            command.meta.source,
        )
        return receipt

    async def record_next_step_decision(self, command: RecordNextStepDecisionCommand) -> dict:
        command.meta.require()
        if not _is_uuid(command.review_id):
            raise OutcomeValidationError("valid_review_id_required")
        if command.decision not in ("CONTINUE", "ADJUST", "PAUSE", "REVIEW_REQUIRED"):
            raise OutcomeValidationError("valid_next_step_decision_required")
        rationale = (command.rationale or "").strip() or None
        if rationale is not None and len(rationale) > 2000:
            raise OutcomeValidationError("next_step_decision_rationale_too_long")

        request_hash = _hash_request(
            {"review_id": command.review_id, "decision": command.decision, "rationale": rationale}
        )

        await self._repository.lock_operation(
            command.tenant_id, command.family_id, "RECORD_NEXT_STEP_DECISION", command.meta.idempotency_key
        )
        replay = await self._repository.load_operation_replay(
            command.tenant_id,
            command.family_id,
            "RECORD_NEXT_STEP_DECISION",
            command.meta.idempotency_key,
            request_hash,
        )
        if replay is not None:
            return {**replay, "replayed": True}

        await self._repository.assert_tenant_family_scope(command.tenant_id, command.family_id, command.actor_id)

        review = await self._repository.load_review(command.family_id, command.review_id)
        if review is None:
            raise OutcomeNotFoundError("growth_review_not_found")

        existing_decision = await self._repository.load_decision_by_review(command.review_id)
        if existing_decision is not None:
            raise OutcomeConflictError("next_step_decision_already_recorded")

        decision = NextStepDecision(
            decision_id=str(uuid.uuid4()),
            family_id=command.family_id,
            review_id=command.review_id,
            intervention_episode_id=review.intervention_episode_id,
            decision=command.decision,
            rationale=rationale,
            boundary=NEXT_STEP_DECISION_BOUNDARY,
            policy_version=_POLICY_VERSION,
            decided_by_actor_id=command.actor_id,
            decided_at=datetime.now(timezone.utc),
        )
        await self._repository.insert_next_step_decision(decision)

        receipt = {
            "action": "RECORD_NEXT_STEP_DECISION",
            "replayed": False,
            "decision": decision.model_dump(mode="json"),
        }
        await self._repository.persist_operation(
            command.tenant_id,
            command.family_id,
            decision.decision_id,
            command.actor_id,
            "RECORD_NEXT_STEP_DECISION",
            request_hash,
            receipt,
            command.meta.correlation_id,
            command.meta.idempotency_key,
        )
        await self._repository.write_audit_and_outbox(
            command.family_id,
            command.actor_id,
            decision.decision_id,
            "RECORD_NEXT_STEP_DECISION",
            "NextStepDecisionRecorded",
            receipt,
            command.meta.correlation_id,
            command.meta.idempotency_key,
            command.meta.source,
        )
        return receipt
