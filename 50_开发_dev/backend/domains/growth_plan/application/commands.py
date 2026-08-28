"""Commands and their handlers for the GrowthPlan (JourneyPlan) domain —
ported from `journey-plan.service.ts`'s `createPlan`/`pausePlan`/
`reviewCurrentPhase` methods (per the task scope; `confirmPlan` and
`getActiveProjection` are out of scope for this batch). Every idempotency-
key / audit / outbox step from the NestJS implementation is preserved,
mirroring the same discipline as the Assessment domain's
`application/commands.py`.
"""
from __future__ import annotations

import hashlib
import json
import re
import uuid
from dataclasses import dataclass

from ..domain.errors import (
    GrowthPlanConflictError,
    GrowthPlanNotFoundError,
    GrowthPlanValidationError,
)
from ..domain.value_objects import JourneyPhaseStatus, JourneyPlanStatus, MUTATION_RECEIPT_BOUNDARY
from .ports import GrowthIntentPort, GrowthPlanRepositoryPort

_UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$", re.IGNORECASE
)


def _is_uuid(value: str) -> bool:
    return bool(_UUID_RE.match(value))


def _hash_request(value: dict) -> str:
    return hashlib.sha256(json.dumps(value, sort_keys=True).encode("utf-8")).hexdigest()


@dataclass(frozen=True)
class MutationMeta:
    correlation_id: str
    idempotency_key: str
    source: str

    def require(self) -> None:
        if not self.idempotency_key or not self.idempotency_key.strip():
            raise GrowthPlanValidationError("idempotency_key_required")
        if len(self.idempotency_key) > 128:
            raise GrowthPlanValidationError("idempotency_key_too_long")


@dataclass(frozen=True)
class CreateJourneyPlanCommand:
    family_id: str
    tenant_id: str
    actor_id: str
    onboarding_id: str
    meta: MutationMeta


@dataclass(frozen=True)
class PauseJourneyPlanCommand:
    family_id: str
    tenant_id: str
    actor_id: str
    plan_id: str
    meta: MutationMeta


@dataclass(frozen=True)
class ReviewCurrentPhaseCommand:
    family_id: str
    tenant_id: str
    actor_id: str
    plan_id: str
    decision: str
    meta: MutationMeta


class GrowthPlanCommandHandler:
    """Port of `JourneyPlanService` mutation methods scoped to this batch.
    Repository transaction boundaries are the caller's responsibility
    (FastAPI dependency / unit of work), mirroring
    `this.repository.withTransaction(...)` in the NestJS version.
    """

    def __init__(self, repository: GrowthPlanRepositoryPort, growth_intent: GrowthIntentPort):
        self._repository = repository
        self._growth_intent = growth_intent

    async def create_plan(self, command: CreateJourneyPlanCommand) -> dict:
        command.meta.require()
        if not _is_uuid(command.onboarding_id):
            raise GrowthPlanValidationError("valid_onboarding_id_required")
        request_hash = _hash_request({"onboarding_id": command.onboarding_id})

        await self._repository.lock_operation(
            command.tenant_id, command.family_id, "CREATE_JOURNEY_PLAN", command.meta.idempotency_key
        )
        replay = await self._repository.load_operation_replay(
            command.tenant_id, command.family_id, "CREATE_JOURNEY_PLAN", command.meta.idempotency_key, request_hash
        )
        if replay is not None:
            return {**replay, "replayed": True}

        await self._repository.assert_tenant_family_scope(command.tenant_id, command.family_id, command.actor_id)

        # Port of `assertActiveOnboardingAndPriority` (research note 3.4
        # createPlan step 2) — raises 404 active_growth_priority_not_found
        # when no ACTIVE priority is tied to an ACTIVE ONBOARDING-phase
        # onboarding. Routed through GrowthIntentPort (not the repository)
        # so this domain does not couple to the GrowthIntent/GrowthPriority
        # domain's own persistence — see ports.py docstring.
        active_priority = await self._growth_intent.load_active_priority(command.family_id, command.onboarding_id)
        if active_priority is None:
            raise GrowthPlanNotFoundError("active_growth_priority_not_found")
        priority_id, priority_dimension = active_priority

        # Port of `getCurrentPlanForUpdate` (step 6) — idempotent reuse of an
        # existing DRAFT/ACTIVE/PAUSED plan rather than a conflict.
        existing = await self._repository.get_current_plan_for_family_onboarding(
            command.family_id, command.onboarding_id
        )
        created = existing is None
        plan = existing or await self._repository.insert_plan_with_phases(
            command.family_id, command.onboarding_id, priority_id, priority_dimension, command.actor_id
        )

        receipt = {
            "action": "CREATE_JOURNEY_PLAN",
            "replayed": False,
            "created": created,
            "plan": plan.model_dump(mode="json"),
            "boundary": MUTATION_RECEIPT_BOUNDARY,
        }
        await self._repository.persist_operation(
            command.tenant_id,
            command.family_id,
            plan.plan_id,
            command.actor_id,
            "CREATE_JOURNEY_PLAN",
            request_hash,
            receipt,
            command.meta.correlation_id,
            command.meta.idempotency_key,
        )
        await self._repository.write_audit_and_outbox(
            command.family_id,
            command.actor_id,
            plan.plan_id,
            "CREATE_JOURNEY_PLAN",
            "JourneyPlanCreated",
            receipt,
            command.meta.correlation_id,
            command.meta.idempotency_key,
            command.meta.source,
        )
        return receipt

    async def pause_plan(self, command: PauseJourneyPlanCommand) -> dict:
        command.meta.require()
        if not _is_uuid(command.plan_id):
            raise GrowthPlanValidationError("valid_journey_plan_id_required")
        request_hash = _hash_request({"plan_id": command.plan_id})

        await self._repository.lock_operation(
            command.tenant_id, command.family_id, "PAUSE_JOURNEY_PLAN", command.meta.idempotency_key
        )
        replay = await self._repository.load_operation_replay(
            command.tenant_id, command.family_id, "PAUSE_JOURNEY_PLAN", command.meta.idempotency_key, request_hash
        )
        if replay is not None:
            return {**replay, "replayed": True}

        await self._repository.assert_tenant_family_scope(command.tenant_id, command.family_id, command.actor_id)
        plan = await self._repository.load_plan_for_update(command.family_id, command.plan_id)
        if plan.status != JourneyPlanStatus.ACTIVE:
            # Port of pausePlan's single guard (research note 3.4): plan
            # must be ACTIVE, else 409 journey_plan_not_active.
            raise GrowthPlanConflictError("journey_plan_not_active")

        plan = await self._repository.pause_plan(command.plan_id)

        receipt = {
            "action": "PAUSE_JOURNEY_PLAN",
            "replayed": False,
            "plan": plan.model_dump(mode="json"),
            "boundary": MUTATION_RECEIPT_BOUNDARY,
        }
        await self._repository.persist_operation(
            command.tenant_id,
            command.family_id,
            command.plan_id,
            command.actor_id,
            "PAUSE_JOURNEY_PLAN",
            request_hash,
            receipt,
            command.meta.correlation_id,
            command.meta.idempotency_key,
        )
        await self._repository.write_audit_and_outbox(
            command.family_id,
            command.actor_id,
            command.plan_id,
            "PAUSE_JOURNEY_PLAN",
            "JourneyPlanPaused",
            receipt,
            command.meta.correlation_id,
            command.meta.idempotency_key,
            command.meta.source,
        )
        return receipt

    async def review_current_phase(self, command: ReviewCurrentPhaseCommand) -> dict:
        command.meta.require()
        if not _is_uuid(command.plan_id):
            raise GrowthPlanValidationError("valid_journey_plan_id_required")
        # Port note (research note 3.4): the real implementation performs no
        # enum whitelist on `decision` — the SQL branch only distinguishes
        # CONTINUE from everything else. We intentionally do not raise on an
        # unrecognized decision string here either, to preserve that
        # documented behavior 1:1; only blank/missing decision is rejected
        # as a basic request-shape validation, not a business rule.
        if not command.decision or not command.decision.strip():
            raise GrowthPlanValidationError("valid_review_decision_required")

        request_hash = _hash_request({"plan_id": command.plan_id, "decision": command.decision})

        await self._repository.lock_operation(
            command.tenant_id, command.family_id, "REVIEW_JOURNEY_PLAN_PHASE", command.meta.idempotency_key
        )
        replay = await self._repository.load_operation_replay(
            command.tenant_id,
            command.family_id,
            "REVIEW_JOURNEY_PLAN_PHASE",
            command.meta.idempotency_key,
            request_hash,
        )
        if replay is not None:
            return {**replay, "replayed": True}

        await self._repository.assert_tenant_family_scope(command.tenant_id, command.family_id, command.actor_id)
        plan = await self._repository.load_plan_for_update(command.family_id, command.plan_id)
        if plan.status != JourneyPlanStatus.ACTIVE:
            # Port of reviewCurrentPhase step 1: 409 journey_plan_not_active.
            raise GrowthPlanConflictError("journey_plan_not_active")

        current_phase = plan.phase_by_name(plan.current_phase)
        if current_phase.status != JourneyPhaseStatus.REVIEW_DUE:
            # Port of reviewCurrentPhase step 2: 409 journey_phase_review_not_due.
            raise GrowthPlanConflictError("journey_phase_review_not_due")

        plan = await self._repository.apply_review_decision(command.plan_id, command.decision)

        receipt = {
            "action": "REVIEW_JOURNEY_PLAN_PHASE",
            "replayed": False,
            "decision": command.decision,
            "plan": plan.model_dump(mode="json"),
            "boundary": MUTATION_RECEIPT_BOUNDARY,
        }
        await self._repository.persist_operation(
            command.tenant_id,
            command.family_id,
            command.plan_id,
            command.actor_id,
            "REVIEW_JOURNEY_PLAN_PHASE",
            request_hash,
            receipt,
            command.meta.correlation_id,
            command.meta.idempotency_key,
        )
        await self._repository.write_audit_and_outbox(
            command.family_id,
            command.actor_id,
            command.plan_id,
            "REVIEW_JOURNEY_PLAN_PHASE",
            "JourneyPlanPhaseReviewed",
            receipt,
            command.meta.correlation_id,
            command.meta.idempotency_key,
            command.meta.source,
        )
        return receipt
