"""Request body models -- port of the DTOs consumed by
`family.controller.ts`.
"""
from __future__ import annotations

from datetime import date

from pydantic import BaseModel

from ..domain.value_objects import ParentRole, RelationshipType


class CreateFamilyRequestBody(BaseModel):
    display_name: str
    primary_contact_account_id: str | None = None


class AddParentRequestBody(BaseModel):
    role: ParentRole
    display_name: str
    account_id: str | None = None


class AddChildRequestBody(BaseModel):
    display_name: str
    birth_date: date | None = None


class CreateRelationshipRequestBody(BaseModel):
    person_a_id: str
    person_b_id: str
    relationship_type: RelationshipType


class AssignLifeStageRequestBody(BaseModel):
    child_id: str
    life_stage_code: str
    effective_from: date
    source: str | None = None
