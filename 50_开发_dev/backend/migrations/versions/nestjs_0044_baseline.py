"""baseline: NestJS SQL migrations 0001-0044 (no-op stamp)

This is a *baseline* revision, not a schema-creating revision.

Context (see migrations/README.md for the full rationale):

- Per FAMILY_AI_PYTHON_ONLY_MIGRATION_PLAN_V1.md section 5, every schema has
  exactly one migration owner at a time. As of this revision, the NestJS SQL
  migrations under `50_开发_dev/database/migrations/0001..0044` are still the
  owner of the whole database schema (families, persons, assessments,
  growth orchestration, principal/runtime tables, commerce, etc). Alembic
  does not take over ownership of any of that schema here.
- This revision exists purely so that Alembic has a version history to
  attach to, starting from "the schema already created by 0001..0044".
  A database that already has 0001..0044 applied is expected to be stamped
  at this revision (`alembic stamp nestjs_0044_baseline`), NOT upgraded
  through it from empty — upgrade() is a deliberate no-op so that running
  `alembic upgrade head` against such a database is also safe and inert.
- Future Batch 2+ domains that get migrated from NestJS/TypeORM to Python
  should NOT add their CREATE TABLE statements here. Once a domain's schema
  ownership actually moves to Python, its migration should be a normal,
  real Alembic revision stacked on top of this baseline (see
  migrations/README.md "Future domains" section).

Revision ID: nestjs_0044_baseline
Revises:
Create Date: 2026-08-28
"""
from __future__ import annotations

from typing import Sequence, Union

# revision identifiers, used by Alembic.
revision: str = "nestjs_0044_baseline"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """No-op by design.

    The schema for revision "nestjs_0044_baseline" is defined by
    50_开发_dev/database/migrations/0001_family_identity.sql through
    0044_ui02_family_assessment_ai_capability_memory.sql, applied by the
    existing NestJS migration runner — not by Alembic. Running
    `alembic upgrade head` against a fresh/empty database will NOT create
    that schema; it must already exist (via the NestJS migrations) before
    this baseline is stamped/applied.
    """
    pass


def downgrade() -> None:
    """No-op by design — see upgrade()."""
    pass
