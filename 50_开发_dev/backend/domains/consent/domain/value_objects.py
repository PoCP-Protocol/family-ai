"""Value objects for the Consent domain.

Ported from the `consent_purpose` / `consent_status` Postgres enums declared
in `database/migrations/0001_family_identity.sql` (this domain does not own
that schema -- see `infrastructure/sqlalchemy_repository.py`). No FastAPI /
SQLAlchemy / provider-SDK dependency here, per
`architecture/FAMILY_AI_PYTHON_ONLY_MIGRATION_PLAN_V1.md` section 3.
"""
from __future__ import annotations

from enum import Enum


class ConsentPurpose(str, Enum):
    """Full `consent_purpose` enum vocabulary (8 values) -- not just the 3
    required-for-growth ones. Ported verbatim from the Postgres enum in
    `database/migrations/0001_family_identity.sql`:

        CREATE TYPE consent_purpose AS ENUM (
          'SERVICE','ASSESSMENT','AI_PERSONALIZATION','GROWTH_TRACKING',
          'EXPERT_SERVICE','RESEARCH','MODEL_IMPROVEMENT','CONTENT_PUBLICATION'
        );

    Per `architecture/notes/batch2-domain-research-v1.md` section 2.3, five
    of these (AI_PERSONALIZATION/EXPERT_SERVICE/RESEARCH/MODEL_IMPROVEMENT/
    CONTENT_PUBLICATION) are not read or checked by any Growth-domain service
    code in the researched scope -- they exist in the schema/enum but have no
    known caller today. Keeping them here (rather than trimming to the 3
    required ones) preserves the real database vocabulary this domain reads
    and writes against.
    """

    SERVICE = "SERVICE"
    ASSESSMENT = "ASSESSMENT"
    AI_PERSONALIZATION = "AI_PERSONALIZATION"
    GROWTH_TRACKING = "GROWTH_TRACKING"
    EXPERT_SERVICE = "EXPERT_SERVICE"
    RESEARCH = "RESEARCH"
    MODEL_IMPROVEMENT = "MODEL_IMPROVEMENT"
    CONTENT_PUBLICATION = "CONTENT_PUBLICATION"


class ConsentStatus(str, Enum):
    """Ported verbatim from the Postgres `consent_status` enum. Per the
    research note section 2.1, `WITHDRAWN` is a defined-but-never-written
    value in the current NestJS implementation (there is no
    `withdrawConsent` endpoint); the only terminal state the code actually
    writes is `EXPIRED`, when a new consent supersedes an active one for the
    same (family_id, subject_person_id, purpose). This port keeps all three
    values because the schema (and any future writer, including a NestJS
    admin path not in scope here) allows them, and the domain must not
    silently reject a `WITHDRAWN` row it might one day read.
    """

    GRANTED = "GRANTED"
    WITHDRAWN = "WITHDRAWN"
    EXPIRED = "EXPIRED"


# Port of `REQUIRED_GROWTH_CONSENT_PURPOSES` in
# `apps/api/src/modules/family/consent-guard.ts` -- the fixed, hardcoded
# purpose set every Growth-domain write path (onboarding/perspective/
# growth-profile-confirm/growth-priority/journey-plan/intervention/
# growth-action/growth-review) re-checks before each Named Action. Order
# matches the TS literal so the missing-purpose error message list order is
# byte-for-byte identical across the port.
REQUIRED_GROWTH_CONSENT_PURPOSES: tuple[ConsentPurpose, ...] = (
    ConsentPurpose.SERVICE,
    ConsentPurpose.ASSESSMENT,
    ConsentPurpose.GROWTH_TRACKING,
)
