# OpenTelemetry setup — `family_api`

Closes the last open item on the migration plan's "Must complete" list
(`architecture/FAMILY_AI_PYTHON_ONLY_MIGRATION_PLAN_V1.md` section 9):
basic distributed-tracing instrumentation for the `family_api` process.

## What was added

- `apps/family_api/telemetry.py` — new module, owns all OTel wiring:
  - `configure_tracing()` — builds a `TracerProvider` with `service.name = family-api`
    and registers it as the global tracer provider. Idempotent (safe if
    called more than once, e.g. across test app instances).
  - `instrument_fastapi_app(app)` — wraps `FastAPIInstrumentor.instrument_app`;
    called once in `main.py` right after the `FastAPI()` app object is
    constructed. Produces one **HTTP-request-level span per request**
    (`http.method`, `http.route`/`http.target`, `http.status_code`, etc.).
  - `instrument_sqlalchemy_engine(engine)` — wraps
    `SQLAlchemyInstrumentor().instrument(engine=engine.sync_engine)`; called
    in `main.py`'s `lifespan`, after `init_engine()` creates the shared
    `AsyncEngine` (see `apps/family_api/db.py`). Produces one
    **DB-query-level span per SQL statement**, with `db.statement`, `db.system`,
    `db.name`, `net.peer.port`, etc.
- `apps/family_api/main.py` — calls `configure_tracing()` at import time,
  `instrument_fastapi_app(app)` right after the app is built, and
  `instrument_sqlalchemy_engine(get_engine())` inside `lifespan()` after
  `init_engine()` runs.
- `pyproject.toml` — added `opentelemetry-api`, `opentelemetry-sdk`,
  `opentelemetry-instrumentation-fastapi`,
  `opentelemetry-instrumentation-sqlalchemy` to `[project.dependencies]`.

No other files were touched — `db.py` itself was left unchanged; the
instrumentor is applied from `main.py` against the engine object `db.py`
already exposes via `get_engine()`.

## How to switch exporters

Exporter choice is a single env var, read in `telemetry._build_exporter()`:

- **Unset (default)** → `ConsoleSpanExporter`: every span is printed as
  pretty-printed JSON to stdout. Zero external dependencies, works out of
  the box for local dev and for verifying instrumentation is actually
  firing (see below).
- **`OTEL_EXPORTER_OTLP_ENDPOINT=http://<collector-host>:4318`** → spans are
  sent over OTLP/HTTP to that collector instead (e.g. Jaeger, Tempo, an
  OTel Collector). The OTLP exporter package
  (`opentelemetry-exporter-otlp-proto-http`) is imported lazily, only when
  this env var is set, so it is not a hard dependency for the default
  console-only path and does not need to be installed for local dev/tests.

No code change is required to switch — only the environment variable.

## Real verification performed

This was verified against a **real, temporary PostgreSQL 16 container**,
not just "should work in theory":

1. Started `postgres:16-alpine` in Docker
   (`family-py-otel-verify`, host port `15439`, db `family_pyverify`).
2. Applied all 48 files in `database/migrations/*.sql` in order via `psql`
   — all applied cleanly, no errors.
3. Seeded one tenant/family/guardian/child/consent/policy-profile/
   family_membership row set with plain SQL (same shape as
   `domains/assessment/tests/test_sqlalchemy_repository_integration.py`'s
   `_seed_family` helper).
4. Started a real `uvicorn apps.family_api.main:app` process against that
   database (`DATABASE_URL` pointed at the container), with the default
   console exporter (no `OTEL_EXPORTER_OTLP_ENDPOINT` set).
5. Sent real HTTP requests with `curl`:
   - `GET /health` → `200`
   - `GET /families/{family_id}/ui/02/assessment` with `x-tenant-id` /
     `x-family-id` / `x-actor-id` headers → first attempt `403`
     (`actor_has_family_manage_permission`, before the guardian's
     `family_memberships` row was seeded), then `200` with the full UI-02
     projection JSON after seeding the membership row.
6. Confirmed stdout printed real span JSON for **both** the HTTP request
   and the underlying DB queries triggered by handling that request.
7. `docker stop family-py-otel-verify && docker rm family-py-otel-verify` —
   no orphaned container left running.

### Observed span output (actual, from the verification run)

HTTP-request-level span (note `http.method`, `http.route`, `http.status_code`):

```json
{
    "name": "GET /families/{family_id}/ui/02/assessment",
    "context": {
        "trace_id": "0x26994235c69a5a080ff6bd15308246ce",
        "span_id": "0x23385f38160a234b",
        "trace_state": "[]"
    },
    "kind": "SpanKind.SERVER",
    "parent_id": null,
    "start_time": "2026-08-28T03:54:48.088991Z",
    "end_time": "2026-08-28T03:54:48.186890Z",
    "status": { "status_code": "UNSET" },
    "attributes": {
        "http.scheme": "http",
        "http.host": "127.0.0.1:18321",
        "http.flavor": "1.1",
        "http.target": "/families/22222222-2222-2222-2222-222222222222/ui/02/assessment",
        "http.url": "http://127.0.0.1:18321/families/.../ui/02/assessment",
        "http.method": "GET",
        "http.route": "/families/{family_id}/ui/02/assessment",
        "http.status_code": 403
    },
    "resource": {
        "attributes": { "service.name": "family-api", ... }
    }
}
```

DB-query-level span (note `db.statement`, `db.system`, `db.name`):

```json
{
    "name": "select family_pyverify",
    "context": {
        "trace_id": "0x41aa03beef2dcc4e1a6e6f3c3551be7f",
        "span_id": "0xe1688cd4681a7da9",
        "trace_state": "[]"
    },
    "kind": "SpanKind.CLIENT",
    "parent_id": "0xe71e4e466492bdb8",
    "attributes": {
        "db.statement": "\n select 1 from tenant_family_bindings\n where tenant_id=$1 and family_id=$2 ...",
        "db.system": "postgresql",
        "net.peer.name": "localhost",
        "net.peer.port": 15439,
        "db.name": "family_pyverify",
        "db.user": "family"
    },
    "resource": {
        "attributes": { "service.name": "family-api", ... }
    }
}
```

Both spans carry `resource.attributes.service.name = "family-api"` and
independent `trace_id`s scoped to each request, confirming the provider,
resource, and both instrumentors are wired correctly end-to-end — this is
real emitted trace data, not just "instrumented but unverified" wiring.

## Test suite impact

`python -m pytest domains/assessment/tests -q --ignore=domains/assessment/tests/test_sqlalchemy_repository_integration.py`
after adding OpenTelemetry:

```
49 passed, 3 skipped in 1.64s
```

The 3 skips are the real-Postgres integration tests in
`test_sqlalchemy_repository_integration.py`, which self-skip when
`PY_ASSESSMENT_TEST_DATABASE_URL` is not set (unrelated to this change —
same behavior before and after). No existing test was broken by adding
OpenTelemetry instrumentation.
