"""Unit tests for the Family domain command handlers, run against the
in-memory `FakeFamilyRepository`. Exercises the ported behavior of
`FamilyService` (createFamily/addParent/addChild/createRelationship/
assignLifeStage) at the application layer, without HTTP or a real database.
"""
from __future__ import annotations

import uuid
from datetime import date

import pytest

from domains.family.application.commands import (
    AddChildCommand,
    AddParentCommand,
    AssignLifeStageCommand,
    CreateFamilyCommand,
    CreateRelationshipCommand,
    FamilyCommandHandler,
    MutationMeta,
)
from domains.family.domain.errors import (
    FamilyConflictError,
    FamilyForbiddenError,
    FamilyNotFoundError,
    FamilyValidationError,
)
from domains.family.domain.value_objects import LifeStageCode, ParentRole, RelationshipType
from domains.family.infrastructure.fake_repository import DEFAULT_TEST_ACTOR, FakeFamilyRepository

ACTOR = DEFAULT_TEST_ACTOR
OTHER_ACTOR = "actor-outsider"


def _meta(key: str = "idem-1") -> MutationMeta:
    return MutationMeta(actor=ACTOR, correlation_id="corr-1", idempotency_key=key, source="test")


@pytest.fixture
def repo() -> FakeFamilyRepository:
    return FakeFamilyRepository()


@pytest.fixture
def handler(repo: FakeFamilyRepository) -> FamilyCommandHandler:
    return FamilyCommandHandler(repo)


# --- createFamily -----------------------------------------------------------


@pytest.mark.asyncio
async def test_create_family_happy_path(handler: FamilyCommandHandler, repo: FakeFamilyRepository) -> None:
    result = await handler.create_family(CreateFamilyCommand("测试家庭", None, MutationMeta(ACTOR, "corr-1", "idem-create-1")))

    assert result["replayed"] is False
    assert result["family"]["display_name"] == "测试家庭"
    family_id = result["family"]["family_id"]
    # legacy creator-permission rule: audit row is the pass condition.
    assert (family_id, ACTOR) in repo.create_family_audit


@pytest.mark.asyncio
async def test_create_family_idempotent_replay(handler: FamilyCommandHandler) -> None:
    meta = MutationMeta(ACTOR, "corr-1", "idem-create-replay")
    first = await handler.create_family(CreateFamilyCommand("测试家庭", None, meta))
    second = await handler.create_family(CreateFamilyCommand("测试家庭", None, meta))

    assert first["family"]["family_id"] == second["family"]["family_id"]
    assert second["replayed"] is True


@pytest.mark.asyncio
async def test_create_family_requires_idempotency_key(handler: FamilyCommandHandler) -> None:
    with pytest.raises(FamilyValidationError) as excinfo:
        await handler.create_family(CreateFamilyCommand("测试家庭", None, MutationMeta(ACTOR, "corr-1", "")))
    assert excinfo.value.code == "idempotency_key_required"


@pytest.mark.asyncio
async def test_create_family_requires_display_name(handler: FamilyCommandHandler) -> None:
    with pytest.raises(FamilyValidationError) as excinfo:
        await handler.create_family(CreateFamilyCommand("   ", None, _meta("idem-create-bad-name")))
    assert excinfo.value.code == "valid_display_name_required"


# --- addParent / addChild ----------------------------------------------------


@pytest.mark.asyncio
async def test_add_parent_happy_path(handler: FamilyCommandHandler, repo: FakeFamilyRepository) -> None:
    family = repo.seed_family(str(uuid.uuid4()))
    result = await handler.add_parent(
        AddParentCommand(family.family_id, ParentRole.MOTHER, "王女士", None, _meta("idem-parent-1"))
    )

    assert result["replayed"] is False
    assert result["person"]["person_type"] == "PARENT"
    assert result["person"]["parent_role"] == "MOTHER"


@pytest.mark.asyncio
async def test_add_parent_idempotent_replay(handler: FamilyCommandHandler, repo: FakeFamilyRepository) -> None:
    family = repo.seed_family(str(uuid.uuid4()))
    meta = _meta("idem-parent-replay")
    first = await handler.add_parent(AddParentCommand(family.family_id, ParentRole.FATHER, "李先生", None, meta))
    second = await handler.add_parent(AddParentCommand(family.family_id, ParentRole.FATHER, "李先生", None, meta))

    assert first["person"]["person_id"] == second["person"]["person_id"]
    assert second["replayed"] is True


@pytest.mark.asyncio
async def test_add_parent_family_not_found(handler: FamilyCommandHandler) -> None:
    with pytest.raises(FamilyNotFoundError) as excinfo:
        await handler.add_parent(
            AddParentCommand(str(uuid.uuid4()), ParentRole.MOTHER, "王女士", None, _meta("idem-parent-404"))
        )
    assert excinfo.value.code == "family_not_found"


@pytest.mark.asyncio
async def test_add_parent_forbidden_without_manage_permission(
    handler: FamilyCommandHandler, repo: FakeFamilyRepository
) -> None:
    family = repo.seed_family(str(uuid.uuid4()), creator_actor="someone-else")
    with pytest.raises(FamilyForbiddenError) as excinfo:
        await handler.add_parent(
            AddParentCommand(family.family_id, ParentRole.MOTHER, "王女士", None, _meta("idem-parent-403"))
        )
    assert excinfo.value.code == "actor_has_family_manage_permission"


@pytest.mark.asyncio
async def test_add_parent_allowed_via_tenancy_membership_not_legacy_audit(
    handler: FamilyCommandHandler, repo: FakeFamilyRepository
) -> None:
    """Permission passes via the *second* OR condition (tenancy
    `family_memberships`) even when the actor has no `CreateFamily` audit
    row at all -- the two conditions must be independently sufficient.
    """
    family = repo.seed_family(str(uuid.uuid4()), creator_actor="the-real-creator")
    repo.grant_family_manage_permission(family.family_id, "guardian-actor", role="GUARDIAN")

    result = await handler.add_parent(
        AddParentCommand(
            family.family_id, ParentRole.GUARDIAN, "监护人", None,
            MutationMeta("guardian-actor", "corr-1", "idem-tenancy-1"),
        )
    )
    assert result["replayed"] is False


@pytest.mark.asyncio
async def test_add_child_happy_path(handler: FamilyCommandHandler, repo: FakeFamilyRepository) -> None:
    family = repo.seed_family(str(uuid.uuid4()))
    result = await handler.add_child(AddChildCommand(family.family_id, "小明", date(2014, 5, 1), _meta("idem-child-1")))

    assert result["person"]["person_type"] == "CHILD"
    assert result["person"]["display_name"] == "小明"


# --- createRelationship ------------------------------------------------------


@pytest.mark.asyncio
async def test_create_relationship_happy_path(handler: FamilyCommandHandler, repo: FakeFamilyRepository) -> None:
    from domains.family.domain.entities import Person
    from domains.family.domain.value_objects import PersonType

    family = repo.seed_family(str(uuid.uuid4()))
    parent = Person(person_id=str(uuid.uuid4()), family_id=family.family_id, person_type=PersonType.PARENT, parent_role=ParentRole.MOTHER, display_name="王女士")
    child = Person(person_id=str(uuid.uuid4()), family_id=family.family_id, person_type=PersonType.CHILD, display_name="小明")
    repo.seed_person(parent)
    repo.seed_person(child)

    result = await handler.create_relationship(
        CreateRelationshipCommand(family.family_id, parent.person_id, child.person_id, RelationshipType.PARENT_CHILD, _meta("idem-rel-1"))
    )
    assert result["relationship"]["relationship_type"] == "PARENT_CHILD"


@pytest.mark.asyncio
async def test_create_relationship_rejects_duplicate(handler: FamilyCommandHandler, repo: FakeFamilyRepository) -> None:
    from domains.family.domain.entities import Person
    from domains.family.domain.value_objects import PersonType

    family = repo.seed_family(str(uuid.uuid4()))
    parent = Person(person_id=str(uuid.uuid4()), family_id=family.family_id, person_type=PersonType.PARENT, parent_role=ParentRole.MOTHER, display_name="王女士")
    child = Person(person_id=str(uuid.uuid4()), family_id=family.family_id, person_type=PersonType.CHILD, display_name="小明")
    repo.seed_person(parent)
    repo.seed_person(child)

    await handler.create_relationship(
        CreateRelationshipCommand(family.family_id, parent.person_id, child.person_id, RelationshipType.PARENT_CHILD, _meta("idem-rel-dup-1"))
    )
    with pytest.raises(FamilyConflictError) as excinfo:
        await handler.create_relationship(
            CreateRelationshipCommand(family.family_id, parent.person_id, child.person_id, RelationshipType.PARENT_CHILD, _meta("idem-rel-dup-2"))
        )
    assert excinfo.value.code == "relationship_already_exists"


@pytest.mark.asyncio
async def test_create_relationship_direction_invalid_business_rule(
    handler: FamilyCommandHandler, repo: FakeFamilyRepository
) -> None:
    """Business-rule validation failure: PARENT_CHILD requires person_a to be
    the PARENT and person_b to be the CHILD -- reversed direction is 400.
    """
    from domains.family.domain.entities import Person
    from domains.family.domain.value_objects import PersonType

    family = repo.seed_family(str(uuid.uuid4()))
    parent = Person(person_id=str(uuid.uuid4()), family_id=family.family_id, person_type=PersonType.PARENT, parent_role=ParentRole.MOTHER, display_name="王女士")
    child = Person(person_id=str(uuid.uuid4()), family_id=family.family_id, person_type=PersonType.CHILD, display_name="小明")
    repo.seed_person(parent)
    repo.seed_person(child)

    with pytest.raises(FamilyValidationError) as excinfo:
        await handler.create_relationship(
            CreateRelationshipCommand(family.family_id, child.person_id, parent.person_id, RelationshipType.PARENT_CHILD, _meta("idem-rel-dir"))
        )
    assert excinfo.value.code == "relationship_direction_invalid"


# --- assignLifeStage ----------------------------------------------------------


@pytest.mark.asyncio
async def test_assign_life_stage_happy_path(handler: FamilyCommandHandler, repo: FakeFamilyRepository) -> None:
    from domains.family.domain.entities import Person
    from domains.family.domain.value_objects import PersonType

    family = repo.seed_family(str(uuid.uuid4()))
    child = Person(person_id=str(uuid.uuid4()), family_id=family.family_id, person_type=PersonType.CHILD, display_name="小明")
    repo.seed_person(child)

    result = await handler.assign_life_stage(
        AssignLifeStageCommand(
            family.family_id, child.person_id, LifeStageCode.EARLY_ADOLESCENCE_12_15.value, date(2026, 1, 1), _meta("idem-ls-1")
        )
    )
    assert result["assignment"]["life_stage_code"] == "EARLY_ADOLESCENCE_12_15"
    assert result["assignment"]["effective_to"] is None


@pytest.mark.asyncio
async def test_assign_life_stage_child_not_found(handler: FamilyCommandHandler, repo: FakeFamilyRepository) -> None:
    family = repo.seed_family(str(uuid.uuid4()))
    with pytest.raises(FamilyNotFoundError) as excinfo:
        await handler.assign_life_stage(
            AssignLifeStageCommand(family.family_id, str(uuid.uuid4()), LifeStageCode.EARLY_ADOLESCENCE_12_15.value, date(2026, 1, 1), _meta("idem-ls-404"))
        )
    assert excinfo.value.code == "child_not_found"


@pytest.mark.asyncio
async def test_assign_life_stage_subject_must_be_child(handler: FamilyCommandHandler, repo: FakeFamilyRepository) -> None:
    """Business rule failure: assigning a life stage to a PARSON typed as
    PARENT (not CHILD) is a 400 validation error.
    """
    from domains.family.domain.entities import Person
    from domains.family.domain.value_objects import PersonType

    family = repo.seed_family(str(uuid.uuid4()))
    parent = Person(person_id=str(uuid.uuid4()), family_id=family.family_id, person_type=PersonType.PARENT, parent_role=ParentRole.MOTHER, display_name="王女士")
    repo.seed_person(parent)

    with pytest.raises(FamilyValidationError) as excinfo:
        await handler.assign_life_stage(
            AssignLifeStageCommand(family.family_id, parent.person_id, LifeStageCode.EARLY_ADOLESCENCE_12_15.value, date(2026, 1, 1), _meta("idem-ls-badtype"))
        )
    assert excinfo.value.code == "life_stage_subject_must_be_child"


@pytest.mark.asyncio
async def test_assign_life_stage_idempotent_replay(handler: FamilyCommandHandler, repo: FakeFamilyRepository) -> None:
    from domains.family.domain.entities import Person
    from domains.family.domain.value_objects import PersonType

    family = repo.seed_family(str(uuid.uuid4()))
    child = Person(person_id=str(uuid.uuid4()), family_id=family.family_id, person_type=PersonType.CHILD, display_name="小明")
    repo.seed_person(child)
    meta = _meta("idem-ls-replay")

    first = await handler.assign_life_stage(
        AssignLifeStageCommand(family.family_id, child.person_id, LifeStageCode.EARLY_ADOLESCENCE_12_15.value, date(2026, 1, 1), meta)
    )
    second = await handler.assign_life_stage(
        AssignLifeStageCommand(family.family_id, child.person_id, LifeStageCode.EARLY_ADOLESCENCE_12_15.value, date(2026, 1, 1), meta)
    )
    assert first["assignment"]["assignment_id"] == second["assignment"]["assignment_id"]
    assert second["replayed"] is True
