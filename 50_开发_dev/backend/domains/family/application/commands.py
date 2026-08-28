"""Commands and their handlers for the Family domain -- ported 1:1 from
FamilyService.createFamily / .addParent / .addChild /
.createRelationship / .assignLifeStage
(apps/api/src/modules/family/family.service.ts). Every idempotency-key /
permission / invariant / audit / outbox step from the NestJS implementation
is preserved; this is a translation, not a redesign.
"""
from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from datetime import date, datetime

from ..domain.errors import FamilyNotFoundError, FamilyValidationError
from ..domain.policies import (
    assert_child_belongs_to_family,
    assert_life_stage_temporal_transition,
    assert_relationship_invariant,
    assert_relationship_not_duplicate,
    normalize_life_stage_source,
)
from ..domain.value_objects import LifeStageCode, ParentRole, RelationshipType
from .ports import FamilyRepositoryPort

CREATE_FAMILY_ACTION = "CreateFamily"
ADD_PARENT_ACTION = "AddParent"
ADD_CHILD_ACTION = "AddChild"
CREATE_FAMILY_RELATIONSHIP_ACTION = "CreateFamilyRelationship"
ASSIGN_LIFE_STAGE_ACTION = "AssignLifeStage"

FAMILY_CREATED_EVENT = "FamilyCreated"
FAMILY_MEMBER_ADDED_EVENT = "FamilyMemberAdded"
FAMILY_RELATIONSHIP_CREATED_EVENT = "FamilyRelationshipCreated"
LIFE_STAGE_ASSIGNED_EVENT = "LifeStageAssigned"


def _hash_request(value: dict) -> str:
    return hashlib.sha256(json.dumps(value, sort_keys=True, default=str).encode("utf-8")).hexdigest()


@dataclass(frozen=True)
class MutationMeta:
    actor: str
    correlation_id: str
    idempotency_key: str
    source: str = "api"

    def require_idempotency_key(self) -> None:
        if not self.idempotency_key or not self.idempotency_key.strip():
            raise FamilyValidationError("idempotency_key_required")
        if len(self.idempotency_key) > 128:
            raise FamilyValidationError("idempotency_key_too_long")


@dataclass(frozen=True)
class CreateFamilyCommand:
    display_name: str
    primary_contact_account_id: str | None
    meta: MutationMeta


@dataclass(frozen=True)
class AddParentCommand:
    family_id: str
    role: ParentRole
    display_name: str
    account_id: str | None
    meta: MutationMeta


@dataclass(frozen=True)
class AddChildCommand:
    family_id: str
    display_name: str
    birth_date: str | None
    meta: MutationMeta


@dataclass(frozen=True)
class CreateRelationshipCommand:
    family_id: str
    person_a_id: str
    person_b_id: str
    relationship_type: RelationshipType
    meta: MutationMeta


@dataclass(frozen=True)
class AssignLifeStageCommand:
    family_id: str
    child_id: str
    life_stage_code: LifeStageCode
    effective_from: date
    meta: MutationMeta
    source: str | None = None


class FamilyCommandHandler:
    """Port of the five FamilyService mutation methods. Repository
    transaction boundaries are the caller's responsibility (FastAPI
    dependency / unit of work), mirroring the NestJS version -- the handler
    receives an already-scoped repository.
    """

    def __init__(self, repository: FamilyRepositoryPort):
        self._repository = repository

    async def create_family(self, command: CreateFamilyCommand) -> dict:
        command.meta.require_idempotency_key()
        if not (command.display_name or "").strip():
            raise FamilyValidationError("valid_display_name_required")
        request_hash = _hash_request(
            {
                "display_name": command.display_name,
                "primary_contact_account_id": command.primary_contact_account_id,
            }
        )

        replay = await self._repository.load_idempotency_replay(
            None, CREATE_FAMILY_ACTION, command.meta.idempotency_key, request_hash
        )
        if replay is not None:
            return {**replay, "replayed": True}
        await self._repository.lock_idempotency_key(None, CREATE_FAMILY_ACTION, command.meta.idempotency_key)

        family = await self._repository.insert_family(command.display_name)
        response = {"action": CREATE_FAMILY_ACTION, "replayed": False, "family": family.model_dump(mode="json")}

        await self._repository.write_audit_and_outbox(
            family.family_id,
            command.meta.actor,
            family.family_id,
            "Family",
            CREATE_FAMILY_ACTION,
            FAMILY_CREATED_EVENT,
            response,
            command.meta.correlation_id,
        )
        await self._repository.store_idempotency_response(
            None, CREATE_FAMILY_ACTION, command.meta.idempotency_key, request_hash, response
        )
        return response

    async def add_parent(self, command: AddParentCommand) -> dict:
        command.meta.require_idempotency_key()
        request_hash = _hash_request(
            {
                "family_id": command.family_id,
                "role": command.role,
                "display_name": command.display_name,
                "account_id": command.account_id,
            }
        )

        replay = await self._repository.load_idempotency_replay(
            command.family_id, ADD_PARENT_ACTION, command.meta.idempotency_key, request_hash
        )
        if replay is not None:
            return {**replay, "replayed": True}
        await self._repository.lock_idempotency_key(command.family_id, ADD_PARENT_ACTION, command.meta.idempotency_key)

        await self._repository.ensure_family_exists(command.family_id)
        await self._repository.assert_family_manage_permission(command.family_id, command.meta.actor)

        parent = await self._repository.insert_parent_person(
            command.family_id, command.role, command.display_name, command.account_id
        )
        response = {"action": ADD_PARENT_ACTION, "replayed": False, "person": parent.model_dump(mode="json")}

        await self._repository.write_audit_and_outbox(
            command.family_id,
            command.meta.actor,
            parent.person_id,
            "Person",
            ADD_PARENT_ACTION,
            FAMILY_MEMBER_ADDED_EVENT,
            {**response, "member_kind": "PARENT"},
            command.meta.correlation_id,
        )
        await self._repository.store_idempotency_response(
            command.family_id, ADD_PARENT_ACTION, command.meta.idempotency_key, request_hash, response
        )
        return response

    async def add_child(self, command: AddChildCommand) -> dict:
        command.meta.require_idempotency_key()
        request_hash = _hash_request(
            {
                "family_id": command.family_id,
                "display_name": command.display_name,
                "birth_date": command.birth_date,
            }
        )

        replay = await self._repository.load_idempotency_replay(
            command.family_id, ADD_CHILD_ACTION, command.meta.idempotency_key, request_hash
        )
        if replay is not None:
            return {**replay, "replayed": True}
        await self._repository.lock_idempotency_key(command.family_id, ADD_CHILD_ACTION, command.meta.idempotency_key)

        await self._repository.ensure_family_exists(command.family_id)
        await self._repository.assert_family_manage_permission(command.family_id, command.meta.actor)

        child = await self._repository.insert_child_person(command.family_id, command.display_name, command.birth_date)
        response = {"action": ADD_CHILD_ACTION, "replayed": False, "person": child.model_dump(mode="json")}

        await self._repository.write_audit_and_outbox(
            command.family_id,
            command.meta.actor,
            child.person_id,
            "Person",
            ADD_CHILD_ACTION,
            FAMILY_MEMBER_ADDED_EVENT,
            {**response, "member_kind": "CHILD"},
            command.meta.correlation_id,
        )
        await self._repository.store_idempotency_response(
            command.family_id, ADD_CHILD_ACTION, command.meta.idempotency_key, request_hash, response
        )
        return response

    async def create_relationship(self, command: CreateRelationshipCommand) -> dict:
        command.meta.require_idempotency_key()
        request_hash = _hash_request(
            {
                "family_id": command.family_id,
                "person_a_id": command.person_a_id,
                "person_b_id": command.person_b_id,
                "relationship_type": command.relationship_type,
            }
        )

        replay = await self._repository.load_idempotency_replay(
            command.family_id, CREATE_FAMILY_RELATIONSHIP_ACTION, command.meta.idempotency_key, request_hash
        )
        if replay is not None:
            return {**replay, "replayed": True}
        await self._repository.lock_idempotency_key(
            command.family_id, CREATE_FAMILY_RELATIONSHIP_ACTION, command.meta.idempotency_key
        )

        await self._repository.ensure_family_exists(command.family_id)
        await self._repository.assert_family_manage_permission(command.family_id, command.meta.actor)

        person_a, person_b = await self._repository.load_relationship_persons(
            command.family_id, command.person_a_id, command.person_b_id
        )
        if person_a is None or person_b is None:
            raise FamilyNotFoundError("person_not_found")

        assert_relationship_invariant(command.family_id, person_a, person_b, command.relationship_type)

        already_exists = await self._repository.relationship_exists(
            command.family_id,
            command.person_a_id,
            command.person_b_id,
            command.relationship_type,
        )
        assert_relationship_not_duplicate(already_exists)

        relationship = await self._repository.insert_family_relationship(
            command.family_id, command.person_a_id, command.person_b_id, command.relationship_type
        )
        response = {
            "action": CREATE_FAMILY_RELATIONSHIP_ACTION,
            "replayed": False,
            "relationship": relationship.model_dump(mode="json"),
        }

        await self._repository.write_audit_and_outbox(
            command.family_id,
            command.meta.actor,
            relationship.relationship_id,
            "FamilyRelationship",
            CREATE_FAMILY_RELATIONSHIP_ACTION,
            FAMILY_RELATIONSHIP_CREATED_EVENT,
            response,
            command.meta.correlation_id,
        )
        await self._repository.store_idempotency_response(
            command.family_id, CREATE_FAMILY_RELATIONSHIP_ACTION, command.meta.idempotency_key, request_hash, response
        )
        return response

    async def assign_life_stage(self, command: AssignLifeStageCommand) -> dict:
        command.meta.require_idempotency_key()
        request_hash = _hash_request(
            {
                "family_id": command.family_id,
                "child_id": command.child_id,
                "life_stage_code": command.life_stage_code,
                "effective_from": command.effective_from.isoformat(),
            }
        )

        replay = await self._repository.load_idempotency_replay(
            command.family_id, ASSIGN_LIFE_STAGE_ACTION, command.meta.idempotency_key, request_hash
        )
        if replay is not None:
            return {**replay, "replayed": True}
        await self._repository.lock_idempotency_key(
            command.family_id, ASSIGN_LIFE_STAGE_ACTION, command.meta.idempotency_key
        )

        await self._repository.ensure_family_exists(command.family_id)
        await self._repository.assert_family_manage_permission(command.family_id, command.meta.actor)

        child = await self._repository.load_person(command.family_id, command.child_id)
        if child is None:
            raise FamilyNotFoundError("child_not_found")
        assert_child_belongs_to_family(command.family_id, child)

        active_assignment = await self._repository.load_active_life_stage_assignment(
            command.family_id, command.child_id
        )
        assert_life_stage_temporal_transition(active_assignment, command.life_stage_code, command.effective_from)

        if active_assignment is not None:
            await self._repository.close_active_life_stage_assignment(
                active_assignment.assignment_id, command.effective_from
            )

        source = normalize_life_stage_source(command.source)
        assignment = await self._repository.insert_life_stage_assignment(
            command.family_id, command.child_id, command.life_stage_code, command.effective_from, source
        )
        response = {
            "action": ASSIGN_LIFE_STAGE_ACTION,
            "replayed": False,
            "assignment": assignment.model_dump(mode="json"),
        }

        await self._repository.write_audit_and_outbox(
            command.family_id,
            command.meta.actor,
            assignment.assignment_id,
            "LifeStageAssignment",
            ASSIGN_LIFE_STAGE_ACTION,
            LIFE_STAGE_ASSIGNED_EVENT,
            response,
            command.meta.correlation_id,
        )
        await self._repository.store_idempotency_response(
            command.family_id, ASSIGN_LIFE_STAGE_ACTION, command.meta.idempotency_key, request_hash, response
        )
        return response
