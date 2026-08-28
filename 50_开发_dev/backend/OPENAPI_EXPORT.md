# OpenAPI export + TypeScript type generation (Batch 1 — Assessment domain)

Status: implemented and verified end-to-end for the Assessment domain only.
Part of `architecture/FAMILY_AI_PYTHON_ONLY_MIGRATION_PLAN_V1.md` section 9's
Batch 1 "Must complete" item: *"OpenAPI contract + auto-generated TypeScript
frontend SDK"*.

## 1. Export the OpenAPI schema (Python side)

```bash
cd 50_开发_dev/backend
python3 -m apps.family_api.export_openapi
# writes 50_开发_dev/backend/openapi/family-assessment-openapi.json
```

`export_openapi.py` calls FastAPI's own `app.openapi()` against the real
`app` object mounted in `apps/family_api/main.py` — no server needs to be
running, no DB connection is opened (a fake `DATABASE_URL` default is
supplied only so import doesn't fail in a shell with no `.env` loaded;
`app.openapi()` never touches the DB).

Output is OpenAPI **3.1.0**, 7 paths (6 Assessment domain endpoints +
`/health`), 23 component schemas.

## 2. Generate TypeScript types (Node side)

Verified to actually run in this environment (pnpm/npm/node present, network
reachable):

```bash
cd 50_开发_dev
npx --yes openapi-typescript backend/openapi/family-assessment-openapi.json \
  -o packages/contracts/generated/family-assessment-openapi.d.ts
```

This produced a real 799-line `.d.ts` file committed at
`packages/contracts/generated/family-assessment-openapi.d.ts`, containing a
`paths` interface (one entry per route + method) and an `operations`
interface with typed request/response bodies per operation, using the
response models declared in `domains/assessment/api/responses.py`.

### Why `openapi-typescript`, not a full client generator

Chose **`openapi-typescript`** (types-only, zero runtime) over
`openapi-generator-cli` / `orval`-style full HTTP client generators, because:

- `packages/contracts/src/*.ts` is already a hand-written, dependency-free
  **types-only** package (plain `export interface` / `export type`, no
  runtime code, no HTTP client). `openapi-typescript`'s output is the same
  shape — a natural drop-in next to the existing files, not a second,
  differently-styled layer.
- The repo's actual HTTP call sites (wherever `apps/mobile` or `apps/web`
  fetch these endpoints) are not part of this task's scope to rewire, and a
  generated *client* (fetch wrapper, error handling, auth header injection)
  would just be dead code until something calls it. Types alone are useful
  immediately: they can be imported and diffed against the hand-written
  contracts today.
- No new runtime dependency for the deployed app — `openapi-typescript` runs
  as a dev-time codegen step (`npx`, not a `dependency`), consistent with
  `typescript`/`turbo` already being `devDependencies` only in the root
  `package.json`.

If/when the mobile or web app needs an actual typed fetch client (not just
types), reconsider `openapi-fetch` (the sibling runtime package from the
same `openapi-typescript` project) — it's a thin wrapper over these same
generated types, not a separate generator.

## 3. Coverage

Only the **Assessment domain, Batch 1** — the 6 routes mounted in
`apps/family_api/main.py` under `/families/...`:

- `GET  /families/{family_id}/ui/02/assessment`
- `POST /families/{family_id}/assessments/sessions`
- `POST /families/{family_id}/assessments/sessions/{session_id}/responses`
- `POST /families/{family_id}/assessments/sessions/{session_id}/submit`
- `GET  /families/{family_id}/ui/03/growth-hypothesis`
- `POST /families/{family_id}/growth-hypotheses/decisions`

Plus `/health`. `ai_runtime` and `workflow_worker` (migration plan section 2)
are not started processes yet and have no routes to export.

## 4. Relationship to the hand-written `packages/contracts/src/*.ts` types

`ui02-assessment.ts` and `ui03-growth-hypothesis.ts` already describe these
exact 6 endpoints' request/response shapes by hand. The new generated file
(`packages/contracts/generated/family-assessment-openapi.d.ts`) is **derived
from the same source of truth the hand-written files were ported from** —
the Pydantic response models in `domains/assessment/api/responses.py`,
which were themselves written to mirror the hand-written `.ts` files
field-for-field (see that module's docstring).

**Recommendation: keep both, side by side, as a consistency check — do not
delete the hand-written files or switch imports to the generated ones yet.**
Reasons:

1. **The generated types are documentation-only right now, not
   contractually enforced.** The 6 routes do *not* use
   `response_model=...` (see `responses.py`'s docstring for why — pydantic's
   `response_model` silently drops any dict field not declared on the model,
   which is real behavior change risk for genuinely dynamic response shapes
   like `scorecard`, which differs between the deterministic and live-Claude
   interpretation adapters). Because nothing enforces that the Python
   handlers' actual dict output matches `responses.py`, the generated `.ts`
   is only as trustworthy as `responses.py` is kept in sync by hand — the
   same risk the hand-written `packages/contracts` files already carry, not
   a new one, but also not yet a strictly *better* source of truth.
2. **A one-way migration now would remove the independent check.** Having
   two independently-authored descriptions of the same wire shape (hand-written
   TS, and Python `responses.py` → generated TS) is useful *precisely because*
   a mismatch between them is a signal something drifted — either the
   hand-written contract is stale, or `responses.py` missed a field. Collapsing
   to one immediately loses that signal.
3. **Once request/response validation is added on the Python side**
   (i.e. a follow-up task that either (a) refactors the application-layer
   handlers to return real typed objects instead of dicts so
   `response_model` becomes safe to wire, or (b) adds a test that asserts
   sample responses validate against `responses.py`), the generated types
   become a *verified* contract and the hand-written ones become the
   redundant side — at that point, migrate call sites to the generated
   types and either delete or auto-generate the hand-written files instead.

**Until then**: treat `packages/contracts/generated/*.d.ts` as a
Batch-1-scoped preview of what full OpenAPI-driven contracts would look
like, re-run step 1+2 whenever `domains/assessment/api/{requests,responses}.py`
change, and manually diff against `packages/contracts/src/ui0{2,3}-*.ts` if
you suspect drift.
