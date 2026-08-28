"""Ports (interfaces) the application layer depends on -- implemented by
`infrastructure/`. Domain code never imports SQLAlchemy/FastAPI directly;
it depends on these Protocols instead, per the four-layer rule in
`architecture/FAMILY_AI_PYTHON_ONLY_MIGRATION_PLAN_V1.md` section 3.

Every method here corresponds 1:1 to a query/mutation block in
`family.service.ts` (createFamily/addParent/addChild/createRelationship/
assignLifeStage) and `family-permission.ts`.
"""
from __future__ import annotations

from datetime import date
from typing import Protocol

from ..domain.entities import Family, FamilyRelationship, LifeStageAssignment, Person
from ..domain.value_objects import LifeStageCode, ParentRole, RelationshipType


class FamilyRepositoryPort(Protocol):
    # --- existence / permission (family-permission.ts assertFamilyManagePermission) ---

    async def ensure_family_exists(self, family_id: str) -> None: ...

    async def assert_family_manage_permission(self, family_id: str, actor_id: str) -> None: ...

    # --- lookups ---

    async def load_person(self, family_id: str, person_id: str) -> Person | None: ...

    async def load_relationship_persons(
        self, family_id: str, person_a_id: str, person_b_id: str
    ) -> tuple[Person | None, Person | None]: ...

    async def relationship_exists(
        self, family_id: str, person_a_id: str, person_b_id: str, relationship_type: RelationshipType
    ) -> bool: ...

    async def load_active_life_stage_assignment(self, family_id: str, child_id: str) -> LifeStageAssignment | None: ...

    # --- mutations ---

    async def insert_family(self, display_name: str) -> Family: ...

    async def insert_parent_person(
        self, family_id: str, role: ParentRole, display_name: str, account_id: str | None
    ) -> Person: ...

    async def insert_child_person(self, family_id: str, display_name: str, birth_date: str | None) -> Person: ...

    async def insert_family_relationship(
        self, family_id: str, person_a_id: str, person_b_id: str, relationship_type: RelationshipType
    ) -> FamilyRelationship: ...

    async def close_active_life_stage_assignment(self, assignment_id: str, effective_to: date) -> None: ...

    async def insert_life_stage_assignment(
        self, family_id: str, child_id: str, life_stage_code: LifeStageCode, effective_from: date, source: str
    ) -> LifeStageAssignment: ...

    # --- idempotency / audit / outbox, ported from lockIdempotencyKey/
    # storeIdempotencyResponse/audit_logs + outbox_events writes ---

    async def lock_idempotency_key(self, family_id: str | None, action: str, idempotency_key: str) -> None: ...

    async def load_idempotency_replay(
        self, family_id: str | None, action: str, idempotency_key: str, request_hash: str
    ) -> dict | None: ...

    async def store_idempotency_response(
        self, family_id: str | None, action: str, idempotency_key: str, request_hash: str, response_body: dict
    ) -> None: ...

    async def write_audit_and_outbox(
        self,
        family_id: str,
        actor_id: str,
        resource_id: str,
        resource_type: str,
        action: str,
        event_name: str,
        payload: dict,
        correlation_id: str,
    ) -> None: ...
