"""Real repository — asyncpg/SQLAlchemy Core against the EXISTING PostgreSQL
schema owned by NestJS SQL migrations (`database/migrations/0001_family_identity.sql`,
`0002_platform_foundation.sql`, `0018_*` family_memberships). Per migration
plan section 5 ("single migration owner per schema... Pre-existing schemas
get an Alembic baseline revision rather than being rewritten from scratch"),
this file does NOT create a new schema or new migrations — it reads/writes
the tables `family.service.ts` / `family-permission.ts` already own, using
raw parameterized SQL that mirrors those TypeScript methods statement-by-
statement. Same convention as
`backend/domains/assessment/infrastructure/sqlalchemy_repository.py`.

`idempotency_keys` here is the platform-wide table from
`0002_platform_foundation.sql` (PRIMARY KEY on `idempotency_key` alone, not
scoped per family/action like the Assessment domain's dedicated
`family_assessment_operations` table) — the lock/replay/store methods below
are written against that shape.
"""
from __future__ import annotations

import json
from datetime import date

from sqlalchemy import bindparam, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncConnection

from ..application.ports import FamilyRepositoryPort
from ..domain.entities import Family, FamilyRelationship, LifeStageAssignment, Person
from ..domain.errors import FamilyConflictError, FamilyForbiddenError, FamilyNotFoundError
from ..domain.permission_policy import CREATE_FAMILY_ACTION, FAMILY_MANAGE_PERMISSION_DENIED_CODE, FAMILY_MANAGE_ROLES
from ..domain.value_objects import ParentRole, PersonType, RelationshipType


def _map_person_row(row) -> Person:
    return Person(
        person_id=str(row.person_id),
        family_id=str(row.family_id),
        person_type=PersonType(row.person_type),
        parent_role=ParentRole(row.parent_role) if row.parent_role else None,
        display_name=row.display_name,
        birth_date=row.birth_date,
        account_id=row.account_id,
    )


def _map_relationship_row(row) -> FamilyRelationship:
    return FamilyRelationship(
        relationship_id=str(row.relationship_id),
        family_id=str(row.family_id),
        person_a_id=str(row.person_a_id),
        person_b_id=str(row.person_b_id),
        relationship_type=RelationshipType(row.relationship_type),
        created_at=row.created_at,
    )


def _map_life_stage_row(row) -> LifeStageAssignment:
    return LifeStageAssignment(
        assignment_id=str(row.assignment_id),
        family_id=str(row.family_id),
        child_id=str(row.child_id),
        life_stage_code=row.life_stage_code,
        effective_from=row.effective_from,
        effective_to=row.effective_to,
        source=row.source,
    )


class SqlAlchemyFamilyRepository(FamilyRepositoryPort):
    """One instance per request/transaction — the caller (FastAPI
    dependency) is responsible for opening/committing/rolling back
    `connection`, this class only issues statements against it.
    """

    def __init__(self, connection: AsyncConnection):
        self._connection = connection

    # --- existence / permission ---

    async def ensure_family_exists(self, family_id: str) -> None:
        result = await self._connection.execute(
            text("select 1 from families where family_id=:family_id for share"),
            {"family_id": family_id},
        )
        if result.first() is None:
            raise FamilyNotFoundError("family_not_found")

    async def assert_family_manage_permission(self, family_id: str, actor_id: str) -> None:
        # Pass condition 1 (legacy): actor is the audited SUCCESS actor of
        # this family's CreateFamily action.
        audit = await self._connection.execute(
            text(
                "select 1 from audit_logs where family_id=:family_id and actor_id=:actor_id "
                "and action_name=:action and result='SUCCESS' limit 1"
            ),
            {"family_id": family_id, "actor_id": actor_id, "action": CREATE_FAMILY_ACTION},
        )
        if audit.first() is not None:
            return

        # Pass condition 2 (tenancy): actor holds an ACTIVE OWNER_GUARDIAN/
        # GUARDIAN family_membership for this family.
        membership = await self._connection.execute(
            text(
                "select 1 from family_memberships where family_id=:family_id and person_id::text=:actor_id "
                "and status='ACTIVE' and role in :roles limit 1"
            ).bindparams(bindparam("roles", expanding=True)),
            {"family_id": family_id, "actor_id": actor_id, "roles": list(FAMILY_MANAGE_ROLES)},
        )
        if membership.first() is not None:
            return

        raise FamilyForbiddenError(FAMILY_MANAGE_PERMISSION_DENIED_CODE)

    # --- lookups ---

    async def load_person(self, family_id: str, person_id: str) -> Person | None:
        result = await self._connection.execute(
            text(
                "select person_id,family_id,person_type,parent_role,display_name,birth_date,account_id "
                "from persons where person_id=:person_id and family_id=:family_id"
            ),
            {"person_id": person_id, "family_id": family_id},
        )
        row = result.first()
        return _map_person_row(row) if row else None

    async def load_relationship_persons(
        self, family_id: str, person_a_id: str, person_b_id: str
    ) -> tuple[Person | None, Person | None]:
        result = await self._connection.execute(
            text(
                "select person_id,family_id,person_type,parent_role,display_name,birth_date,account_id "
                "from persons where person_id in (:person_a_id,:person_b_id)"
            ),
            {"person_a_id": person_a_id, "person_b_id": person_b_id},
        )
        by_id = {str(row.person_id): _map_person_row(row) for row in result}
        return by_id.get(person_a_id), by_id.get(person_b_id)

    async def relationship_exists(
        self, family_id: str, person_a_id: str, person_b_id: str, relationship_type: RelationshipType
    ) -> bool:
        # Port of assertRelationshipNotDuplicate: symmetric types (SPOUSE/
        # SIBLING) check both directions, directional types only (A,B).
        from ..domain.value_objects import SYMMETRIC_RELATIONSHIP_TYPES

        if relationship_type in SYMMETRIC_RELATIONSHIP_TYPES:
            result = await self._connection.execute(
                text(
                    "select 1 from family_relationships where family_id=:family_id and relationship_type=:rel_type "
                    "and ((person_a_id=:a and person_b_id=:b) or (person_a_id=:b and person_b_id=:a)) limit 1"
                ),
                {"family_id": family_id, "rel_type": relationship_type.value, "a": person_a_id, "b": person_b_id},
            )
        else:
            result = await self._connection.execute(
                text(
                    "select 1 from family_relationships where family_id=:family_id and relationship_type=:rel_type "
                    "and person_a_id=:a and person_b_id=:b limit 1"
                ),
                {"family_id": family_id, "rel_type": relationship_type.value, "a": person_a_id, "b": person_b_id},
            )
        return result.first() is not None

    async def load_active_life_stage_assignment(self, family_id: str, child_id: str) -> LifeStageAssignment | None:
        result = await self._connection.execute(
            text(
                "select assignment_id,family_id,child_id,life_stage_code,effective_from,effective_to,source "
                "from life_stage_assignments where family_id=:family_id and child_id=:child_id "
                "and effective_to is null for update"
            ),
            {"family_id": family_id, "child_id": child_id},
        )
        row = result.first()
        return _map_life_stage_row(row) if row else None

    # --- mutations ---

    async def insert_family(self, display_name: str) -> Family:
        result = await self._connection.execute(
            text(
                "insert into families(display_name) values (:display_name) "
                "returning family_id,display_name,status,primary_contact_person_id,version"
            ),
            {"display_name": display_name},
        )
        row = result.first()
        return Family(
            family_id=str(row.family_id),
            display_name=row.display_name,
            status=row.status,
            primary_contact_person_id=str(row.primary_contact_person_id) if row.primary_contact_person_id else None,
            version=row.version,
        )

    async def insert_parent_person(
        self, family_id: str, role: ParentRole, display_name: str, account_id: str | None
    ) -> Person:
        result = await self._connection.execute(
            text(
                "insert into persons(family_id,person_type,parent_role,display_name,account_id) "
                "values (:family_id,'PARENT',:role,:display_name,:account_id) "
                "returning person_id,family_id,person_type,parent_role,display_name,birth_date,account_id"
            ),
            {"family_id": family_id, "role": role.value, "display_name": display_name, "account_id": account_id},
        )
        return _map_person_row(result.first())

    async def insert_child_person(self, family_id: str, display_name: str, birth_date: date | None) -> Person:
        result = await self._connection.execute(
            text(
                "insert into persons(family_id,person_type,display_name,birth_date) "
                "values (:family_id,'CHILD',:display_name,:birth_date) "
                "returning person_id,family_id,person_type,parent_role,display_name,birth_date,account_id"
            ),
            {"family_id": family_id, "display_name": display_name, "birth_date": birth_date},
        )
        return _map_person_row(result.first())

    async def insert_family_relationship(
        self, family_id: str, person_a_id: str, person_b_id: str, relationship_type: RelationshipType
    ) -> FamilyRelationship:
        try:
            result = await self._connection.execute(
                text(
                    "insert into family_relationships(family_id,person_a_id,person_b_id,relationship_type) "
                    "values (:family_id,:a,:b,:rel_type) "
                    "returning relationship_id,family_id,person_a_id,person_b_id,relationship_type,created_at"
                ),
                {"family_id": family_id, "a": person_a_id, "b": person_b_id, "rel_type": relationship_type.value},
            )
        except IntegrityError as exc:
            # Double protection: application-layer duplicate check (see
            # relationship_exists) plus this DB unique-index catch (23505),
            # ported 1:1 from insertFamilyRelationship's catch block.
            if "23505" in str(getattr(exc.orig, "sqlstate", "")) or "unique" in str(exc).lower():
                raise FamilyConflictError("relationship_already_exists") from exc
            raise
        return _map_relationship_row(result.first())

    async def close_active_life_stage_assignment(self, assignment_id: str, effective_to: date) -> None:
        await self._connection.execute(
            text("update life_stage_assignments set effective_to=:effective_to where assignment_id=:assignment_id"),
            {"assignment_id": assignment_id, "effective_to": effective_to},
        )

    async def insert_life_stage_assignment(
        self, family_id: str, child_id: str, life_stage_code, effective_from: date, source: str
    ) -> LifeStageAssignment:
        code_value = life_stage_code.value if hasattr(life_stage_code, "value") else life_stage_code
        try:
            result = await self._connection.execute(
                text(
                    "insert into life_stage_assignments(family_id,child_id,life_stage_code,effective_from,source) "
                    "values (:family_id,:child_id,:code,:effective_from,:source) "
                    "returning assignment_id,family_id,child_id,life_stage_code,effective_from,effective_to,source"
                ),
                {
                    "family_id": family_id,
                    "child_id": child_id,
                    "code": code_value,
                    "effective_from": effective_from,
                    "source": source,
                },
            )
        except IntegrityError as exc:
            # uq_active_life_stage(child_id) WHERE effective_to IS NULL.
            if "23505" in str(getattr(exc.orig, "sqlstate", "")) or "unique" in str(exc).lower():
                raise FamilyConflictError("life_stage_assignment_already_active") from exc
            raise
        return _map_life_stage_row(result.first())

    # --- idempotency / audit / outbox ---

    async def lock_idempotency_key(self, family_id: str | None, action: str, idempotency_key: str) -> None:
        # Platform-wide idempotency_keys table (0002_platform_foundation.sql)
        # has a bare PRIMARY KEY on idempotency_key — no per-family/action
        # composite key like the Assessment domain's dedicated table, so the
        # lock key folds family_id/action into the advisory-lock hash to
        # avoid cross-domain idempotency_key collisions racing each other,
        # while the row itself stays keyed by idempotency_key alone (mirrors
        # the NestJS `lockIdempotencyKey`'s `insert ... on conflict do
        # nothing` + `select ... for update` pattern via a Postgres
        # transaction-scoped advisory lock keyed the same way).
        await self._connection.execute(
            text("select pg_advisory_xact_lock(hashtextextended(:lock_key,0))"),
            {"lock_key": f"{family_id}:{action}:{idempotency_key}"},
        )

    async def load_idempotency_replay(
        self, family_id: str | None, action: str, idempotency_key: str, request_hash: str
    ) -> dict | None:
        result = await self._connection.execute(
            text(
                "select request_hash,response_body from idempotency_keys "
                "where idempotency_key=:key and action_name=:action for update"
            ),
            {"key": idempotency_key, "action": action},
        )
        row = result.first()
        if row is None:
            return None
        if row.request_hash != request_hash:
            raise FamilyConflictError("idempotency_key_payload_mismatch")
        if row.response_body is None:
            return None
        body = row.response_body
        return json.loads(body) if isinstance(body, str) else body

    async def store_idempotency_response(
        self, family_id: str | None, action: str, idempotency_key: str, request_hash: str, response_body: dict
    ) -> None:
        await self._connection.execute(
            text(
                """
                insert into idempotency_keys(idempotency_key,action_name,request_hash,response_body)
                values (:key,:action,:request_hash,cast(:response_body as jsonb))
                on conflict (idempotency_key) do update
                  set response_body=excluded.response_body, request_hash=excluded.request_hash
                """
            ),
            {
                "key": idempotency_key,
                "action": action,
                "request_hash": request_hash,
                "response_body": json.dumps(response_body),
            },
        )

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
        await self._connection.execute(
            text(
                """
                insert into audit_logs(family_id,actor_type,actor_id,action_name,resource_type,resource_id,correlation_id,result,metadata)
                values (:family_id,'PERSON',:actor_id,:action,:resource_type,:resource_id,:correlation_id,'SUCCESS',cast(:metadata as jsonb))
                """
            ),
            {
                "family_id": family_id,
                "actor_id": actor_id,
                "action": action,
                "resource_type": resource_type,
                "resource_id": resource_id,
                "correlation_id": correlation_id,
                "metadata": json.dumps(payload),
            },
        )
        await self._connection.execute(
            text(
                """
                insert into outbox_events(aggregate_type,aggregate_id,event_name,event_version,event_id,correlation_id,payload,occurred_at)
                values (:resource_type,:resource_id,:event_name,1,gen_random_uuid(),:correlation_id,cast(:payload as jsonb),now())
                """
            ),
            {
                "resource_type": resource_type,
                "resource_id": resource_id,
                "event_name": event_name,
                "correlation_id": correlation_id,
                "payload": json.dumps(payload),
            },
        )
