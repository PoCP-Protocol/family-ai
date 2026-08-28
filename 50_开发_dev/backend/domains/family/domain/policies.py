"""Pure, DB-free business rules — ported 1:1 from the in-memory-only
validation functions in `family.service.ts`:
  assertRelationshipInvariant, assertRelationshipNotDuplicate (predicate half;
  the actual existence lookup is a repository method),
  assertLifeStageTemporalTransition, normalizeSource.
No repository/IO here — matches the NestJS split between "pure invariant
check" and "DB existence lookup" call sites.
"""
from __future__ import annotations

from datetime import date

from .entities import LifeStageAssignment, Person
from .errors import FamilyConflictError, FamilyValidationError
from .value_objects import (
    DIRECTIONAL_GUARDIAN_RELATIONSHIP_TYPES,
    FALLBACK_LIFE_STAGE_SOURCE,
    LIFE_STAGE_SOURCE_MAX_LEN,
    SYMMETRIC_RELATIONSHIP_TYPES,
    RelationshipType,
)


def assert_relationship_invariant(
    family_id: str, person_a: Person, person_b: Person, relationship_type: RelationshipType
) -> None:
    """Port of `assertRelationshipInvariant` — pure in-memory checks, no DB."""
    if person_a.person_id == person_b.person_id:
        raise FamilyValidationError("relationship_self_link_not_allowed")
    if person_a.family_id != family_id or person_b.family_id != family_id:
        raise FamilyValidationError("relationship_persons_must_belong_to_same_family")
    if relationship_type in DIRECTIONAL_GUARDIAN_RELATIONSHIP_TYPES:
        if not person_a.is_parent() or not person_b.is_child():
            raise FamilyValidationError("relationship_direction_invalid")


def assert_child_belongs_to_family(family_id: str, child: Person) -> None:
    """Port of `assertChildBelongsToFamily` -- the 404 (person lookup
    missing) is handled by the caller before this runs; this only enforces
    the two remaining in-memory invariants once a `Person` row is found:
    family_id mismatch -> 400 `child_must_belong_to_family`;
    person_type != CHILD -> 400 `life_stage_subject_must_be_child`.
    """
    if child.family_id != family_id:
        raise FamilyValidationError("child_must_belong_to_family")
    if not child.is_child():
        raise FamilyValidationError("life_stage_subject_must_be_child")


def is_symmetric_relationship(relationship_type: RelationshipType) -> bool:
    """Port of `isSymmetricRelationship`."""
    return relationship_type in SYMMETRIC_RELATIONSHIP_TYPES


def assert_relationship_not_duplicate(already_exists: bool) -> None:
    """Port of the `assertRelationshipNotDuplicate` outcome check — the
    existence lookup itself (direction-aware per `is_symmetric_relationship`)
    is a repository concern; this function only enforces the resulting
    invariant so the 409 code stays defined in one place.
    """
    if already_exists:
        raise FamilyConflictError("relationship_already_exists")


def assert_life_stage_temporal_transition(
    active_assignment: LifeStageAssignment | None, requested_life_stage_code: str, effective_from: date
) -> None:
    """Port of `assertLifeStageTemporalTransition`."""
    if active_assignment is None:
        return
    if active_assignment.life_stage_code == requested_life_stage_code:
        raise FamilyConflictError("life_stage_assignment_already_active")
    if effective_from <= active_assignment.effective_from:
        raise FamilyValidationError("life_stage_effective_from_must_be_after_active_assignment")


def normalize_life_stage_source(source: str | None) -> str:
    """Port of `normalizeSource` — trim to 64 chars, blank falls back to
    `'api'`.
    """
    trimmed = (source or "").strip()
    if not trimmed:
        return FALLBACK_LIFE_STAGE_SOURCE
    return trimmed[:LIFE_STAGE_SOURCE_MAX_LEN]
