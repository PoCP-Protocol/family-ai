"""Commands/queries and their handlers for the GrowthPriority domain —
ported 1:1 from `GrowthPriorityService.confirmGrowthPriority` (and the
draft-recomputation read path it depends on) in
`apps/api/src/modules/family/growth-priority.service.ts`
(`architecture/notes/batch2-domain-research-v1.md` section 3.2). Every
idempotency-key / advisory-lock / safety-route / consent / draft-freshness /
audit / outbox step from the NestJS implementation is preserved; this is a
translation, not a redesign.
"""
from __future__ import annotations

import hashlib
import json
import re
import uuid
from dataclasses import dataclass

from ..domain.entities import GrowthPriority, GrowthPriorityDraft
from ..domain.errors import GrowthPriorityValidationError
from ..domain.policies import (
    assert_decision_matches_draft,
    assert_draft_is_fresh,
    assert_no_active_intervention_episode,
    assert_normal_safety_route,
)
from ..domain.value_objects import PRIORITY_BOUNDARY, GrowthPriorityDecisionType
from .ports import ConsentCheckPort, GrowthPriorityRepositoryPort

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
            raise GrowthPriorityValidationError("idempotency_key_required")
        if len(self.idempotency_key) > 128:
            raise GrowthPriorityValidationError("idempotency_key_too_long")


@dataclass(frozen=True)
class GetGrowthPriorityDraftQuery:
    family_id: str
    tenant_id: str
    actor_id: str
    onboarding_id: str


@dataclass(frozen=True)
class ConfirmGrowthPriorityCommand:
    family_id: str
    tenant_id: str
    actor_id: str
    onboarding_id: str
    draft_id: str
    decision: GrowthPriorityDecisionType
    meta: MutationMeta


class GrowthPriorityQueryHandler:
    """Port of the draft-recomputation read path `confirmGrowthPriority`
    relies on (`listConfirmedProfiles` + `buildGrowthPriorityDraft`,
    research doc section 3.2 step 5). Read-only — never mutates state, so it
    intentionally bypasses the idempotency/lock machinery `commands.py`
    uses.
    """

    def __init__(self, repository: GrowthPriorityRepositoryPort):
        self._repository = repository

    async def get_draft(self, query: GetGrowthPriorityDraftQuery) -> GrowthPriorityDraft:
        await self._repository.assert_family_exists(query.family_id)
        await self._repository.assert_tenant_family_scope(query.tenant_id, query.family_id, query.actor_id)
        await self._repository.assert_active_onboarding(query.family_id, query.onboarding_id)
        return await self._repository.build_draft(query.family_id, query.onboarding_id)


class GrowthPriorityCommandHandler:
    """Port of `GrowthPriorityService.confirmGrowthPriority`. Repository
    transaction boundaries are the caller's responsibility (FastAPI
    dependency / unit of work), mirroring
    `this.repository.withTransaction(...)` in the NestJS version — the
    handler receives an already-scoped repository, same convention as
    `domains/assessment/application/commands.py`.
    """

    def __init__(self, repository: GrowthPriorityRepositoryPort, consent: ConsentCheckPort):
        self._repository = repository
        self._consent = consent

    async def confirm(self, command: ConfirmGrowthPriorityCommand) -> dict:
        # Step 1 (research doc 3.2): ensureFamilyExists, assertFamilyManagePermission, idempotency lock.
        command.meta.require()
        if not _is_uuid(command.onboarding_id):
            raise GrowthPriorityValidationError("valid_onboarding_id_required")
        if not command.draft_id or not command.draft_id.strip():
            raise GrowthPriorityValidationError("valid_draft_id_required")

        request_hash = _hash_request(
            {
                "onboarding_id": command.onboarding_id,
                "draft_id": command.draft_id,
                "decision": command.decision,
            }
        )

        await self._repository.lock_operation(command.family_id, "CONFIRM_GROWTH_PRIORITY", command.meta.idempotency_key)
        replay = await self._repository.load_operation_replay(
            command.family_id, "CONFIRM_GROWTH_PRIORITY", command.meta.idempotency_key, request_hash
        )
        if replay is not None:
            return {**replay, "replayed": True}

        await self._repository.assert_family_exists(command.family_id)
        await self._repository.assert_tenant_family_scope(command.tenant_id, command.family_id, command.actor_id)

        # Step 2: assertActiveOnboarding.
        await self._repository.assert_active_onboarding(command.family_id, command.onboarding_id)

        # Step 3: assertNormalSafetyRoute.
        severity, disposition, perspective_dispositions = await self._repository.load_safety_route(
            command.onboarding_id
        )
        assert_normal_safety_route(disposition, severity, perspective_dispositions)

        # Step 4: assertNoActiveInterventionEpisode.
        has_active_episode = await self._repository.has_active_intervention_episode(command.onboarding_id)
        assert_no_active_intervention_episode(has_active_episode)

        # Step 5: recompute draft (listConfirmedProfiles + buildGrowthPriorityDraft).
        draft = await self._repository.build_draft(command.family_id, command.onboarding_id)

        # Step 6: draft freshness.
        assert_draft_is_fresh(draft, command.draft_id)

        # Steps 7-8: assertDecisionMatchesDraft + dimension-eligibility check.
        assert_decision_matches_draft(command.decision, draft.candidate)

        # Step 9: GrowthSubjectResolver.resolve.
        subject = await self._repository.resolve_growth_subject(command.family_id, command.onboarding_id)
        subject_person_id = subject.child_person_id

        # Step 10: assertRequiredGrowthConsents — via the local ConsentCheckPort.
        await self._consent.assert_required_growth_consents(command.family_id, subject_person_id)

        priority: GrowthPriority | None = None
        if draft.candidate is not None and command.decision != "NO_PRIORITY_YET":
            # Step 11: supersedeActivePriority + insertPriority (version chain).
            previous = await self._repository.load_active_priority(command.family_id, command.onboarding_id)
            priority = await self._repository.insert_priority(
                family_id=command.family_id,
                onboarding_id=command.onboarding_id,
                profile_id=subject_person_id,
                candidate=draft.candidate,
                confirmed_by_actor_id=command.actor_id,
                previous=previous,
            )

        receipt = {
            "action": "CONFIRM_GROWTH_PRIORITY",
            "replayed": False,
            "decision": command.decision,
            "priority": priority.model_dump(mode="json") if priority is not None else None,
            "boundary": PRIORITY_BOUNDARY,
        }

        # Step 12: audit + GrowthPriorityConfirmed event.
        await self._repository.persist_operation(
            command.family_id, "CONFIRM_GROWTH_PRIORITY", command.meta.idempotency_key, request_hash, receipt
        )
        await self._repository.write_audit_and_outbox(
            command.family_id,
            command.actor_id,
            priority.priority_id if priority is not None else command.onboarding_id,
            "CONFIRM_GROWTH_PRIORITY",
            "GrowthPriorityConfirmed",
            receipt,
        )
        return receipt
