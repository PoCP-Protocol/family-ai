"""Real repository -- asyncpg/SQLAlchemy Core against the EXISTING PostgreSQL
`consents` table owned by NestJS SQL migrations
(`database/migrations/0001_family_identity.sql`,
`0005_consent_active_uniqueness.sql`). Per migration plan section 5 ("single
migration owner per schema... Pre-existing schemas get an Alembic baseline
revision rather than being rewritten from scratch"), this file does NOT
create a new table -- it reads the existing `consents` table with a query
that mirrors `assertRequiredGrowthConsents`
(`apps/api/src/modules/family/consent-guard.ts`) statement-for-statement.
Alembic ownership of this schema only begins at cutover
(`NEST_ACTIVE -> PYTHON_READY -> CUTOVER`), not before -- this repository is
the "PYTHON_READY" stage: correct against the existing schema, not yet the
sole writer. Same convention as
`backend/domains/assessment/infrastructure/sqlalchemy_repository.py`.
"""
from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection

from ..application.ports import ConsentRepositoryPort
from ..domain.value_objects import ConsentPurpose


class SqlAlchemyConsentRepository(ConsentRepositoryPort):
    """One instance per request/transaction -- mirrors the NestJS
    `for share` row-lock read inside the caller's own transaction. The
    caller (FastAPI dependency, or another domain's application-layer
    handler once cross-domain wiring happens) owns opening/committing the
    `connection`; this class only issues the one statement against it.
    """

    def __init__(self, connection: AsyncConnection):
        self._connection = connection

    async def load_granted_purposes(
        self, family_id: str, subject_person_id: str, candidate_purposes: tuple[ConsentPurpose, ...]
    ) -> set[ConsentPurpose]:
        # Byte-for-byte port of the SQL in consent-guard.ts's
        # assertRequiredGrowthConsents, `for share` included (a shared lock
        # is sufficient here -- this is a read-before-write guard, not the
        # write itself, so it must not block concurrent readers of the same
        # rows, only writers who would change status away from GRANTED).
        result = await self._connection.execute(
            text(
                """
                select purpose
                from consents
                where family_id = :family_id
                  and subject_person_id = :subject_person_id
                  and purpose = any(:purposes::consent_purpose[])
                  and status = 'GRANTED'
                for share
                """
            ),
            {
                "family_id": family_id,
                "subject_person_id": subject_person_id,
                "purposes": [purpose.value for purpose in candidate_purposes],
            },
        )
        return {ConsentPurpose(row.purpose) for row in result}
