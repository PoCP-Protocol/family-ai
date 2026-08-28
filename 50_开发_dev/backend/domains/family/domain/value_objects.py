"""Value objects for the Family domain.

Ported from `0001_family_identity.sql` (families/persons/family_relationships/
life_stage_assignments) and `0018_*` (family_memberships), plus the enums
implied by `family.service.ts` request/response DTOs. No FastAPI /
SQLAlchemy dependency — see
`architecture/FAMILY_AI_PYTHON_ONLY_MIGRATION_PLAN_V1.md` section 3.
"""
from __future__ import annotations

from enum import Enum
from typing import Literal


class FamilyStatus(str, Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    ARCHIVED = "ARCHIVED"


class PersonType(str, Enum):
    PARENT = "PARENT"
    CHILD = "CHILD"


class ParentRole(str, Enum):
    MOTHER = "MOTHER"
    FATHER = "FATHER"
    GUARDIAN = "GUARDIAN"
    OTHER_GUARDIAN = "OTHER_GUARDIAN"


class RelationshipType(str, Enum):
    PARENT_CHILD = "PARENT_CHILD"
    SPOUSE = "SPOUSE"
    SIBLING = "SIBLING"
    GUARDIAN_CHILD = "GUARDIAN_CHILD"
    OTHER = "OTHER"


# Port of `isSymmetricRelationship` — SPOUSE/SIBLING have no inherent
# direction, so (A,B) and (B,A) are the same relationship for duplicate
# detection (uq_relationship_symmetric_pair uses LEAST/GREATEST for this).
SYMMETRIC_RELATIONSHIP_TYPES = (RelationshipType.SPOUSE, RelationshipType.SIBLING)

# Port of the directional-guardian check in assertRelationshipInvariant:
# for these two types, person_a must be PARENT and person_b must be CHILD.
DIRECTIONAL_GUARDIAN_RELATIONSHIP_TYPES = (RelationshipType.PARENT_CHILD, RelationshipType.GUARDIAN_CHILD)


class LifeStageCode(str, Enum):
    """Port of `life_stage_code` enum — currently a single value in the
    migration, kept as an enum (not a bare literal) so a second value can be
    added later without touching call sites.
    """

    EARLY_ADOLESCENCE_12_15 = "EARLY_ADOLESCENCE_12_15"


DEFAULT_LIFE_STAGE_SOURCE: Literal["MANUAL"] = "MANUAL"
FALLBACK_LIFE_STAGE_SOURCE: Literal["api"] = "api"
LIFE_STAGE_SOURCE_MAX_LEN = 64


class FamilyMembershipRole(str, Enum):
    OWNER_GUARDIAN = "OWNER_GUARDIAN"
    GUARDIAN = "GUARDIAN"
    ADULT_MEMBER = "ADULT_MEMBER"
    CHILD_SUBJECT = "CHILD_SUBJECT"


class FamilyMembershipStatus(str, Enum):
    INVITED = "INVITED"
    ACTIVE = "ACTIVE"
    REVOKED = "REVOKED"
    LEFT = "LEFT"


MutationReceiptAction = Literal[
    "CREATE_FAMILY", "ADD_PARENT", "ADD_CHILD", "CREATE_RELATIONSHIP", "ASSIGN_LIFE_STAGE"
]
