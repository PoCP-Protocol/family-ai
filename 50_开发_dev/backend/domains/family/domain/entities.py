"""Family domain entities.

Ported from the row shapes read/written by `family.service.ts`
(createFamily/addParent/addChild/createRelationship/assignLifeStage) against
`0001_family_identity.sql` (families/persons/family_relationships/
life_stage_assignments).
"""
from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel

from .value_objects import FamilyStatus, ParentRole, PersonType, RelationshipType


class Person(BaseModel):
    person_id: str
    family_id: str
    person_type: PersonType
    parent_role: ParentRole | None = None
    display_name: str
    birth_date: date | None = None
    account_id: str | None = None

    def is_parent(self) -> bool:
        return self.person_type == PersonType.PARENT

    def is_child(self) -> bool:
        return self.person_type == PersonType.CHILD


class Family(BaseModel):
    family_id: str
    display_name: str
    status: FamilyStatus = FamilyStatus.ACTIVE
    primary_contact_person_id: str | None = None
    version: int = 1


class FamilyRelationship(BaseModel):
    relationship_id: str
    family_id: str
    person_a_id: str
    person_b_id: str
    relationship_type: RelationshipType
    created_at: datetime


class LifeStageAssignment(BaseModel):
    assignment_id: str
    family_id: str
    child_id: str
    life_stage_code: str
    effective_from: date
    effective_to: date | None = None
    source: str = "MANUAL"

    def is_active(self) -> bool:
        return self.effective_to is None
