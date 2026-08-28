# Alembic migrations — backend (Python)

## What this is

This is a **baseline**, not a rewrite.

Per `50_开发_dev/architecture/FAMILY_AI_PYTHON_ONLY_MIGRATION_PLAN_V1.md`
section 5: every schema has exactly one migration owner at a time. Today,
the **NestJS SQL migrations** under
`50_开发_dev/database/migrations/0001_family_identity.sql` through
`0044_ui02_family_assessment_ai_capability_memory.sql` (47 files, some
sequence numbers duplicated across parallel branches — e.g. `0022`/`0023`/
`0024` each appear twice) are still the owner of the entire database
schema, including the Assessment domain tables
(`family_assessment_tools`, `family_assessment_sessions`,
`family_assessment_responses`, `family_assessment_operations`, plus the
UI-03 growth hypothesis tables in `0041`). Alembic does **not** take over
ownership of any of that schema in this revision. Batch 1's Python
Assessment domain code (`domains/assessment/`) reads/writes those same
NestJS-owned tables via `SqlAlchemyAssessmentRepository` — it does not get
its own Alembic-managed copy of the schema.

The single revision in `migrations/versions/nestjs_0044_baseline.py`:

- `upgrade()` / `downgrade()` are **deliberately no-op** (`pass`). It creates
  no tables, columns, indexes, or constraints.
- Its only job is to give Alembic a version-history anchor that means
  "the schema as of NestJS migration 0044 already exists, created by the
  NestJS migration runner, not by Alembic."

## Why baseline-and-stamp, not autogenerate-from-scratch

Two ways to seed Alembic against a pre-existing, non-Alembic-owned schema
were considered:

1. **Autogenerate a revision that recreates the 47 NestJS migrations'
   DDL as Alembic operations**, then let `alembic upgrade head` run it.
   Rejected: this would make Alembic falsely claim to be the schema's
   creator/owner, duplicate ~4300 lines of hand-tuned SQL (custom enums,
   `DO $$ ... EXCEPTION WHEN duplicate_object$$` idempotency guards, partial
   indexes, FK-pair composite keys, seed `INSERT`s) into a second
   source of truth that would drift the moment either side changes, and
   violates the migration plan's explicit "not now" rule for Alembic
   ownership.
2. **A single no-op baseline revision + `alembic stamp head`** against a
   database that already has 0001–0044 applied. This is what was built.
   It records only a version marker; the NestJS SQL files remain the one
   and only source of truth for the schema they created.

(2) is the correct reading of "baseline revision" here: a baseline marks
"where Alembic's history starts," it does not re-author history that
already happened under a different tool.

## How to apply it against a real database

A database that already has all 47 NestJS migrations applied must be
**stamped**, not upgraded from empty:

```bash
export FAMILY_ALEMBIC_DATABASE_URL="postgresql://user:pass@host:port/dbname"
python3 -m alembic stamp head
```

`alembic upgrade head` against such a database is also safe (it will see
no pending revisions once stamped, or apply the no-op baseline once if run
before stamping — both are inert). What `alembic upgrade head` must
**never** do is create the Assessment/Family/etc. tables from scratch —
and it doesn't, because `upgrade()` is `pass`. This was verified directly
(see "Verification performed" below).

`FAMILY_ALEMBIC_DATABASE_URL` falls back to `PY_ASSESSMENT_TEST_DATABASE_URL`
if unset (same env var the existing
`domains/assessment/tests/test_sqlalchemy_repository_integration.py`
integration tests use), so a single exported URL covers both pytest and
Alembic. Either an `asyncpg`-style or a plain `postgresql://` URL is
accepted; `env.py` normalizes it to the sync `psycopg` (v3) driver Alembic
needs.

## Verification performed (real Postgres, not just documentation)

1. Started a disposable `postgres:16-alpine` container
   (`family-py-alembic-verify`, port 15442).
2. Applied all 47 NestJS SQL migration files from
   `50_开发_dev/database/migrations/` **in lexical filename order**
   (`0001` → `0044`, duplicate-numbered pairs like `0022_family_dev_flow_events.sql`
   /`0022_test_experience_workflows.sql` sort deterministically and both
   applied with no conflicts) via `psql -v ON_ERROR_STOP=1`. All 47 applied
   cleanly; resulting schema had 111 application tables + views.
3. Ran `alembic stamp head` against that database — succeeded, wrote a
   single row to a newly created `alembic_version` table, **and changed
   nothing else** (verified `information_schema.tables` count identical
   before/after: 112, i.e. +1 only for `alembic_version` itself).
4. Ran `alembic upgrade head` immediately after stamping — no-op as
   expected (already at head), confirmed by re-checking the table count.
5. As an independent negative-control check, started a second, **empty**
   `postgres:16-alpine` container (`family-py-alembic-verify-empty`, port
   15443) and ran `alembic upgrade head` against it directly (i.e. the path
   that would run if someone forgot to apply the NestJS migrations first).
   Result: only `alembic_version` was created — zero application tables —
   proving `upgrade()` truly does not attempt to (re)create any Assessment
   or other domain schema.
6. Both containers were `docker stop`ped and `docker rm`ed after
   verification; no containers were left running.

## Future domains (Batch 2+): how to add a *real* migration

Once a domain's schema ownership actually moves from NestJS/TypeORM to
Python (per the migration plan, this happens at that domain's own cutover,
not now, and not for Assessment in Batch 1):

1. Write real SQLAlchemy models for that domain under its
   `domains/<name>/infrastructure/` (or equivalent) module.
2. Point `migrations/env.py`'s `target_metadata` at that domain's
   `Base.metadata` (today it is `None` — intentionally, since no domain is
   Alembic-owned yet; wire in a per-domain metadata union as domains cut
   over, don't blow away this baseline's `None` default for domains still
   NestJS-owned).
3. Run `alembic revision --autogenerate -m "<domain>: <change>"` against a
   database that is at the current head (i.e. already stamped/upgraded
   through `nestjs_0044_baseline` and any later real revisions) — Alembic
   will diff against the live schema and generate real `CREATE TABLE` /
   `ALTER TABLE` operations, not a no-op.
4. Review the generated migration like normal application code (indexes,
   constraints, data backfills) — it is a real, executable migration from
   this point forward, unlike the baseline.
5. Update the migration plan's ownership table for that domain: NestJS SQL
   migrations stop being the owner of that domain's tables; Alembic becomes
   the owner going forward. Do **not** delete or rewrite the historical
   NestJS SQL files for tables that predate the cutover — they remain the
   accurate history of how the schema got to the cutover point.

## Directory layout

- `migrations/env.py` — runtime wiring (env var → DB URL, sync driver
  normalization, `target_metadata = None` for now).
- `migrations/versions/nestjs_0044_baseline.py` — the one and only
  revision as of this commit.
- `migrations/script.py.mako` — Alembic's default revision template,
  unmodified.
- `alembic.ini` — standard Alembic config; `sqlalchemy.url` is a
  placeholder only, real URL comes from the env var above.
