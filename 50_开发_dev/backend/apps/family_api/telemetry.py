"""OpenTelemetry wiring for the `family_api` process.

Per the migration plan's "Must complete" list (section 9 of
`architecture/FAMILY_AI_PYTHON_ONLY_MIGRATION_PLAN_V1.md`), this process
must emit basic distributed-tracing spans: one span per HTTP request
(method/path/status_code) and one span per SQL statement executed through
the shared `AsyncEngine` (see `apps/family_api/db.py`).

Exporter selection is env-driven so the same code works in local dev and in
a real deployment with a collector:

- `OTEL_EXPORTER_OTLP_ENDPOINT` unset (default): spans are printed to stdout
  via `ConsoleSpanExporter`. Zero external dependencies — useful for local
  development and for verifying instrumentation actually fires.
- `OTEL_EXPORTER_OTLP_ENDPOINT` set to a collector URL (e.g.
  `http://localhost:4318`): spans are exported over OTLP/HTTP instead. No
  code change needed to switch — only the env var.

This module owns *only* provider/exporter setup and the two instrumentor
`.instrument()` calls. It does not decide business semantics — matches the
"push wiring choices to the process boundary" pattern already used in
`main.py` for the domain's dependency overrides.
"""
from __future__ import annotations

import os

from opentelemetry import trace
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
from opentelemetry.sdk.resources import SERVICE_NAME, Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor, ConsoleSpanExporter

_SERVICE_NAME = "family-api"


def _build_exporter():
    """Return an OTLP/HTTP exporter if `OTEL_EXPORTER_OTLP_ENDPOINT` is set,
    else a `ConsoleSpanExporter` that prints spans to stdout.

    The OTLP import is deferred to inside this branch so that the
    `opentelemetry-exporter-otlp-proto-http` package (an OTLP-only extra) is
    never required for the default console-only local-dev path.
    """
    endpoint = os.environ.get("OTEL_EXPORTER_OTLP_ENDPOINT")
    if endpoint:
        from opentelemetry.exporter.otlp.proto.http.trace_exporter import (
            OTLPSpanExporter,
        )

        return OTLPSpanExporter(endpoint=endpoint)
    return ConsoleSpanExporter()


def configure_tracing() -> TracerProvider:
    """Idempotent: safe to call multiple times (e.g. across test app
    instantiations) — re-registering the same global provider is a no-op
    per the OTel SDK, and if a provider is already configured we return it
    as-is rather than layering duplicate processors.
    """
    existing = trace.get_tracer_provider()
    if isinstance(existing, TracerProvider):
        return existing

    resource = Resource.create({SERVICE_NAME: _SERVICE_NAME})
    provider = TracerProvider(resource=resource)
    provider.add_span_processor(BatchSpanProcessor(_build_exporter()))
    trace.set_tracer_provider(provider)
    return provider


def instrument_fastapi_app(app) -> None:
    """HTTP-request-level spans: method, path (route template), status_code.
    Call once, after the FastAPI app object is constructed.
    """
    FastAPIInstrumentor.instrument_app(app)


def instrument_sqlalchemy_engine(engine) -> None:
    """DB-query-level spans (one per statement) on the shared AsyncEngine.
    `SQLAlchemyInstrumentor` hooks the engine's sync `.sync_engine` — passing
    the async engine directly is supported and documented by the
    instrumentation package.
    """
    SQLAlchemyInstrumentor().instrument(engine=engine.sync_engine)
