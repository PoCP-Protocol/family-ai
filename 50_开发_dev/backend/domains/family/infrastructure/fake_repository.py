"""In-memory fake repository -- the test double the current test suite runs
against (per `architecture/FAMILY_AI_PYTHON_ONLY_MIGRATION_PLAN_V1.md`
section 9 "FakeProvider" requirement). Mirrors the same invariants the real
repository must hold: idempotency-key replay, `assertFamilyManagePermission`
(legacy `CreateFamily` audit OR ACTIVE `OWNER_GUARDIAN`/`GUARDIAN`
`family_memberships`), and the same error codes as `family.service.ts` /
`family-permission.ts`.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import UTC, date, datetime

from ..domain.entities import Family, FamilyRelationship, LifeStageAssignment, Person
from ..domain.errors import FamilyForbiddenError, FamilyNotFoundError
from ..domain.permission_policy import FAMILY_MANAGE_PERMISSION_DENIED_CODE, FAMILY_MANAGE_ROLES
from ..domain.policies import is_symmetric_relationship
from ..domain.value_objects import ParentRole, PersonType, RelationshipType

DEFAULT_TEST_ACTOR = "actor-1"


@dataclass
class FakeFamilyRepository:
    """Not thread-safe / not process-safe -- intentional, this is a unit-test
    double, not a substitute for the real Postgres-backed repository.
    """

    families: dict[str, Family] = field(default_factory=dict)
    persons: dict[str, Person] = field(default_factory=dict)
    relationships: list[FamilyRelationship] = field(default_factory=list)
    life_stage_assignments: dict[str, LifeStageAssignment] = field(default_factory=dict)
    # (family_id, actor_id) -> a successful legacy `CreateFamily` audit exists.
    create_family_audit: set[tuple[str, str]] = field(default_factory=set)
    # (family_id, person_id) -> role, for ACTIVE family_memberships rows.
    family_memberships: dict[tuple[str, str], str] = field(default_factory=dict)
    idempotency_store: dict[tuple[str | None, str, str], dict] = field(default_factory=dict)
    audit_log: list[dict] = field(default_factory=list)
    outbox: list[dict] = field(default_factory=list)

    def seed_family(self, family_id: str, display_name: str = "Seed Family", creator_actor: str = DEFAULT_TEST_ACTOR) -> Family:
        family = Family(family_id=family_id, display_name=display_name)
        self.families[family_id] = family
        self.grant_family_manage_permission(family_id, creator_actor, role="OWNER_GUARDIAN")
        return family

    def grant_family_manage_permission(self, family_id: str, person_id: str, role: str = "OWNER_GUARDIAN") -> None:
        """Port of an ACTIVE `family_memberships` row with a manage-eligible
        role -- pass condition #2 in `assertFamilyManagePermission`.
        """
        self.family_memberships[(family_id, person_id)] = role

    def seed_create_family_audit(self, family_id: str, actor_id: str) -> None:
        """Port of a SUCCESS `CreateFamily` `audit_logs` row -- pass
        condition #1 (legacy creator) in `assertFamilyManagePermission`.
        """
        self.create_family_audit.add((family_id, actor_id))

    def seed_person(self, person: Person) -> None:
        self.persons[person.person_id] = person

    async def ensure_family_exists(self, family_id: str) -> None:
        if family_id not in self.families:
            raise FamilyNotFoundError("family_not_found")

    async def assert_family_manage_permission(self, family_id: str, actor_id: str) -> None:
        if (family_id, actor_id) in self.create_family_audit:
            return
        if self.family_memberships.get((family_id, actor_id)) in FAMILY_MANAGE_ROLES:
            return
        raise FamilyForbiddenError(FAMILY_MANAGE_PERMISSION_DENIED_CODE)

    async def load_person(self, family_id: str, person_id: str) -> Person | None:
        person = self.persons.get(person_id)
        if person is None or person.family_id != family_id:
            return None
        return person

    async def load_relationship_persons(
        self, family_id: str, person_a_id: str, person_b_id: str
    ) -> tuple[Person | None, Person | None]:
        return self.persons.get(person_a_id), self.persons.get(person_b_id)

    async def relationship_exists(
        self, family_id: str, person_a_id: str, person_b_id: str, relationship_type: RelationshipType
    ) -> bool:
        symmetric = is_symmetric_relationship(relationship_type)
        for rel in self.relationships:
            if rel.family_id != family_id or rel.relationship_type != relationship_type:
                continue
            if rel.person_a_id == person_a_id and rel.person_b_id == person_b_id:
                return True
            if symmetric and rel.person_a_id == person_b_id and rel.person_b_id == person_a_id:
                return True
        return False

    async def load_active_life_stage_assignment(self, family_id: str, child_id: str) -> LifeStageAssignment | None:
        for assignment in self.life_stage_assignments.values():
            if assignment.family_id == family_id and assignment.child_id == child_id and assignment.is_active():
                return assignment
        return None

    async def insert_family(self, display_name: str) -> Family:
        family_id = str(uuid.uuid4())
        family = Family(family_id=family_id, display_name=display_name)
        self.families[family_id] = family
        return family

    async def insert_parent_person(
        self, family_id: str, role: ParentRole, display_name: str, account_id: str | None
    ) -> Person:
        person_id = str(uuid.uuid4())
        person = Person(
            person_id=person_id,
            family_id=family_id,
            person_type=PersonType.PARENT,
            parent_role=role,
            display_name=display_name,
            account_id=account_id,
        )
        self.persons[person_id] = person
        return person

    async def insert_child_person(self, family_id: str, display_name: str, birth_date: date | None) -> Person:
        person_id = str(uuid.uuid4())
        person = Person(
            person_id=person_id,
            family_id=family_id,
            person_type=PersonType.CHILD,
            display_name=display_name,
            birth_date=birth_date,
        )
        self.persons[person_id] = person
        return person

    async def insert_family_relationship(
        self, family_id: str, person_a_id: str, person_b_id: str, relationship_type: RelationshipType
    ) -> FamilyRelationship:
        relationship = FamilyRelationship(
            relationship_id=str(uuid.uuid4()),
            family_id=family_id,
            person_a_id=person_a_id,
            person_b_id=person_b_id,
            relationship_type=relationship_type,
            created_at=datetime.now(UTC),
        )
        self.relationships.append(relationship)
        return relationship

    async def close_active_life_stage_assignment(self, assignment_id: str, effective_to: date) -> None:
        assignment = self.life_stage_assignments[assignment_id]
        assignment.effective_to = effective_to

    async def insert_life_stage_assignment(
        self, family_id: str, child_id: str, life_stage_code: str, effective_from: date, source: str
    ) -> LifeStageAssignment:
        assignment_id = str(uuid.uuid4())
        assignment = LifeStageAssignment(
            assignment_id=assignment_id,
            family_id=family_id,
            child_id=child_id,
            life_stage_code=life_stage_code,
            effective_from=effective_from,
            effective_to=None,
            source=source,
        )
        self.life_stage_assignments[assignment_id] = assignment
        return assignment

    async def lock_idempotency_key(self, family_id: str | None, action: str, idempotency_key: str) -> None:
        return None  # advisory-lock semantics only meaningful against real Postgres

    async def load_idempotency_replay(
        self, family_id: str | None, action: str, idempotency_key: str, request_hash: str
    ) -> dict | None:
        key = (family_id, action, idempotency_key)
        record = self.idempotency_store.get(key)
        if record is None:
            return None
        return record["response_body"]

    async def store_idempotency_response(
        self, family_id: str | None, action: str, idempotency_key: str, request_hash: str, response_body: dict
    ) -> None:
        self.idempotency_store[(family_id, action, idempotency_key)] = {
            "request_hash": request_hash,
            "response_body": response_body,
        }

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
    ) -> None:
        self.audit_log.append(
            {
                "family_id": family_id,
                "actor_id": actor_id,
                "resource_id": resource_id,
                "resource_type": resource_type,
                "action": action,
                "result": "SUCCESS",
                "correlation_id": correlation_id,
            }
        )
        self.outbox.append(
            {
                "aggregate_id": resource_id,
                "event_name": event_name,
                "correlation_id": correlation_id,
                "payload": payload,
            }
        )
        if action == "CreateFamily":
            # Mirrors the legacy creator-permission rule: the audit row
            # written above IS the pass condition, so record it here too.
            self.create_family_audit.add((family_id, actor_id))
