"""Commands and their handlers for Intervention + Action — ported 1:1 from
`InterventionService.startIntervention` and
`GrowthActionService.completeGrowthAction` / `.transitionTaskExecution`
(apps/api/src/modules/family/{intervention,growth-action}.service.ts). Every
idempotency-key / advisory-lock / consent / safety-route / audit / outbox
step from the NestJS implementation is preserved; this is a translation,
not a redesign.

KNOWN DEFECT, carried over deliberately (do not fix here): there is no
`CompleteIntervention` / `CancelIntervention` command in this module because
none exists in the NestJS source. `intervention_episodes.status` can only
ever be written as ACTIVE by `start()` below — nothing in the researched
surface ever transitions it to COMPLETED or CANCELLED. See
`domain/value_objects.py` (`InterventionEpisodeStatus`) and
`architecture/notes/batch2-domain-research-v1.md` section 4.1.
"""
from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from datetime import UTC, date, datetime

from ..domain.errors import (
    InterventionConflictError,
    InterventionNotFoundError,
    InterventionValidationError,
)
from ..domain.policies import (
    assert_completable_growth_action_status,
    assert_execution_transition,
    assert_reflection_safety_route,
    build_growth_action_assignments,
)
from ..domain.value_objects import (
    COMPLETABLE_STATUSES,
    SUPPORTED_PRIORITY_DIMENSION,
    ExecutionAction,
    ExecutionStatus,
)
from .ports import InterventionRepositoryPort


@dataclass(frozen=True)
class MutationMeta:
    correlation_id: str
    idempotency_key: str
    source: str

    def require(self) -> None:
        if not self.idempotency_key or not self.idempotency_key.strip():
            raise InterventionValidationError("idempotency_key_required")
        if len(self.idempotency_key) > 128:
            raise InterventionValidationError("idempotency_key_too_long")


def _hash_request(value: dict) -> str:
    return hashlib.sha256(json.dumps(value, sort_keys=True, default=str).encode("utf-8")).hexdigest()


@dataclass(frozen=True)
class StartInterventionCommand:
    family_id: str
    tenant_id: str
    actor_id: str
    priority_id: str
    intervention_code: str
    meta: MutationMeta


@dataclass(frozen=True)
class CompleteGrowthActionCommand:
    family_id: str
    tenant_id: str
    actor_id: str
    action_id: str
    completion_status: str
    reflection: str | None
    occurred_at: datetime | None
    meta: MutationMeta


@dataclass(frozen=True)
class TransitionTaskExecutionCommand:
    family_id: str
    tenant_id: str
    actor_id: str
    action_id: str
    execution_action: ExecutionAction
    meta: MutationMeta


class InterventionCommandHandler:
    """Port of `InterventionService.startIntervention`. Repository
    transaction boundaries are the caller's responsibility, mirroring
    `this.repository.withTransaction(...)` in the NestJS version — the
    handler receives an already-scoped repository.
    """

    def __init__(self, repository: InterventionRepositoryPort):
        self._repository = repository

    async def start(self, command: StartInterventionCommand) -> dict:
        command.meta.require()

        # Step 2 of intervention.service.ts#startIntervention: intervention_code
        # is a literal-string comparison, not an enum membership check —
        # currently only one value is ever accepted.
        if command.intervention_code != "LISTEN_BEFORE_RESPOND":
            raise InterventionConflictError("intervention_code_not_supported")

        request_hash = _hash_request(
            {
                "family_id": command.family_id,
                "priority_id": command.priority_id,
                "intervention_code": command.intervention_code,
                "actor_id": command.actor_id,
            }
        )

        await self._repository.lock_operation(
            command.family_id, "START_INTERVENTION", command.meta.idempotency_key
        )
        replay = await self._repository.load_operation_replay(
            command.family_id, "START_INTERVENTION", command.meta.idempotency_key, request_hash
        )
        if replay is not None:
            return {**replay, "replayed": True}

        await self._repository.ensure_family_exists(command.family_id)
        await self._repository.assert_tenant_family_scope(command.tenant_id, command.family_id, command.actor_id)

        priority = await self._repository.load_active_priority_for_start(command.family_id, command.priority_id)
        if priority is None or priority.get("dimension_id") != SUPPORTED_PRIORITY_DIMENSION:
            # Ported verbatim: an existing priority on an unsupported
            # dimension (P03/R04/R05) is indistinguishable from a missing
            # priority — both raise the same 404, matching the NestJS
            # `getActivePriorityForStart` single query+filter shape.
            raise InterventionNotFoundError("active_growth_priority_not_found")

        onboarding_id = priority["onboarding_id"]
        subject = await self._repository.resolve_growth_subject(command.family_id, onboarding_id)
        await self._repository.assert_required_growth_consents(command.family_id, subject.child_person_id)
        await self._repository.assert_normal_safety_route(command.family_id, onboarding_id)
        await self._repository.assert_no_active_intervention_episode(command.family_id, onboarding_id)

        started_at = datetime.now(UTC)
        episode = await self._repository.insert_intervention_episode(
            command.family_id, onboarding_id, command.priority_id, command.actor_id, started_at
        )

        assignments = build_growth_action_assignments(started_at.date())
        actions = await self._repository.insert_growth_actions_for_episode(command.family_id, episode, assignments)

        receipt = {
            "action": "START_INTERVENTION",
            "replayed": False,
            "episode": episode.model_dump(mode="json"),
            "actions": [action.model_dump(mode="json") for action in actions],
        }
        await self._repository.persist_operation(
            command.family_id,
            command.actor_id,
            "START_INTERVENTION",
            request_hash,
            receipt,
            command.meta.correlation_id,
            command.meta.idempotency_key,
        )
        await self._repository.write_audit_and_outbox(
            command.family_id,
            command.actor_id,
            "START_INTERVENTION",
            "InterventionStarted",
            receipt,
            command.meta.correlation_id,
            command.meta.idempotency_key,
            command.meta.source,
        )
        return receipt


class GrowthActionCommandHandler:
    """Port of `GrowthActionService.completeGrowthAction` /
    `.transitionTaskExecution`.
    """

    def __init__(self, repository: InterventionRepositoryPort):
        self._repository = repository

    async def complete(self, command: CompleteGrowthActionCommand) -> dict:
        # Step 1 of completeGrowthAction: this check runs *before* the
        # idempotency lock in the NestJS source (assertCompletableGrowthActionStatus
        # is called first, ahead of ensureFamilyExists/lockOperation) — ported
        # in the same order here, not reordered for "cleanliness".
        assert_completable_growth_action_status(command.completion_status)
        command.meta.require()

        request_hash = _hash_request(
            {
                "action_id": command.action_id,
                "completion_status": command.completion_status,
                "reflection": command.reflection,
                "occurred_at": command.occurred_at,
            }
        )

        await self._repository.lock_operation(
            command.family_id, "COMPLETE_GROWTH_ACTION", command.meta.idempotency_key
        )
        replay = await self._repository.load_operation_replay(
            command.family_id, "COMPLETE_GROWTH_ACTION", command.meta.idempotency_key, request_hash
        )
        if replay is not None:
            return {**replay, "replayed": True}

        await self._repository.ensure_family_exists(command.family_id)
        await self._repository.assert_tenant_family_scope(command.tenant_id, command.family_id, command.actor_id)

        action = await self._repository.load_completable_action_for_update(command.family_id, command.action_id)

        if action.onboarding_id:
            subject = await self._repository.resolve_growth_subject(command.family_id, action.onboarding_id)
            await self._repository.assert_required_growth_consents(command.family_id, subject.child_person_id)
            await self._repository.assert_normal_safety_route(command.family_id, action.onboarding_id)

        # Step 5 of completeGrowthAction (`architecture/notes/batch2-domain-research-v1.md`
        # section 5.3 point 5 / section 7.3): regex-scan the reflection text
        # for sensitive safety signals and raise 403
        # `reflection_requires_safety_support` if it trips any of them.
        # Pure function, no repository I/O — ported from
        # `assertReflectionSafetyRoute` (reflection-safety.policy.ts), same
        # call position (after the safety-route/consent checks above, before
        # the completion is persisted) as the NestJS source.
        assert_reflection_safety_route(command.reflection)

        updated = await self._repository.update_growth_action_completion(
            command.action_id, command.completion_status, command.reflection
        )

        if updated.journey_plan_id:
            await self._repository.refresh_journey_plan_execution(updated.journey_plan_id)

        receipt = {
            "action": "COMPLETE_GROWTH_ACTION",
            "replayed": False,
            "growth_action": updated.model_dump(mode="json"),
        }
        await self._repository.persist_operation(
            command.family_id,
            command.actor_id,
            "COMPLETE_GROWTH_ACTION",
            request_hash,
            receipt,
            command.meta.correlation_id,
            command.meta.idempotency_key,
        )
        await self._repository.write_audit_and_outbox(
            command.family_id,
            command.actor_id,
            "COMPLETE_GROWTH_ACTION",
            "GrowthActionCompleted",
            receipt,
            command.meta.correlation_id,
            command.meta.idempotency_key,
            command.meta.source,
        )
        return receipt

    async def transition_execution(self, command: TransitionTaskExecutionCommand) -> dict:
        command.meta.require()
        request_hash = _hash_request(
            {"action_id": command.action_id, "execution_action": command.execution_action}
        )

        await self._repository.lock_operation(
            command.family_id, "TRANSITION_TASK_EXECUTION", command.meta.idempotency_key
        )
        replay = await self._repository.load_operation_replay(
            command.family_id, "TRANSITION_TASK_EXECUTION", command.meta.idempotency_key, request_hash
        )
        if replay is not None:
            return {**replay, "replayed": True}

        await self._repository.ensure_family_exists(command.family_id)
        await self._repository.assert_tenant_family_scope(command.tenant_id, command.family_id, command.actor_id)

        action = await self._repository.load_action(command.family_id, command.action_id)
        if action is None:
            raise InterventionNotFoundError("growth_action_not_found")

        if action.onboarding_id:
            subject = await self._repository.resolve_growth_subject(command.family_id, action.onboarding_id)
            await self._repository.assert_required_growth_consents(command.family_id, subject.child_person_id)
            await self._repository.assert_normal_safety_route(command.family_id, action.onboarding_id)

        next_status = assert_execution_transition(action.execution_status, command.execution_action)

        timestamp = datetime.now(UTC)
        updated = await self._repository.update_growth_action_execution_status(
            command.action_id, next_status, timestamp
        )

        # CANCEL is the one execution_status change that also writes
        # `status` — ported verbatim from the single branch in
        # `assertExecutionTransition`'s caller that special-cases CANCEL.
        if command.execution_action == "CANCEL":
            updated = await self._repository.update_growth_action_completion(
                command.action_id, "NOT_COMPLETED", None
            )

        receipt = {
            "action": "TRANSITION_TASK_EXECUTION",
            "replayed": False,
            "growth_action": updated.model_dump(mode="json"),
        }
        await self._repository.persist_operation(
            command.family_id,
            command.actor_id,
            "TRANSITION_TASK_EXECUTION",
            request_hash,
            receipt,
            command.meta.correlation_id,
            command.meta.idempotency_key,
        )
        await self._repository.write_audit_and_outbox(
            command.family_id,
            command.actor_id,
            "TRANSITION_TASK_EXECUTION",
            "GrowthActionExecutionTransitioned",
            receipt,
            command.meta.correlation_id,
            command.meta.idempotency_key,
            command.meta.source,
        )
        return receipt
