"""Family API — Python FastAPI process, Batch 1 (Assessment domain only).

Per `architecture/FAMILY_AI_PYTHON_ONLY_MIGRATION_PLAN_V1.md` section 2,
this is one of three Python runtime processes (`family-api`); `ai_runtime`
and `workflow_worker` are separate, not yet started, processes.

Run: `uvicorn apps.family_api.main:app --reload` from `backend/`, with
`DATABASE_URL` set (see `.env.example`). Does NOT yet replace the NestJS
API — this is the PYTHON_READY verification target for the Assessment
domain, not a production deployment (see task report's "Must complete"
list: no OpenAPI export/TS SDK generation, no Docker/CI, no real auth
verification — see `apps/family_api/auth.py`).
"""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI

from domains.assessment.api import dependencies as assessment_dependencies
from domains.assessment.api.routes import router as assessment_router

from .auth import extract_family_context
from .db import dispose_engine, init_engine
from .dependencies import get_command_handler, get_growth_hypothesis_handler, get_query_handler


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_engine()
    yield
    await dispose_engine()


app = FastAPI(
    title="Family API (Python, Batch 1 — Assessment domain)",
    version="0.1.0",
    lifespan=lifespan,
)

# Wire the domain package's placeholder dependencies (which raise HTTP 500
# by design when unwired — see domains/assessment/api/dependencies.py) to
# this process's real implementations. This is the only place that decides
# which concrete adapters back the domain's ports; domain/application code
# never imports these choices directly.
app.dependency_overrides[assessment_dependencies.get_family_context] = extract_family_context
app.dependency_overrides[assessment_dependencies.get_command_handler] = get_command_handler
app.dependency_overrides[assessment_dependencies.get_query_handler] = get_query_handler
app.dependency_overrides[assessment_dependencies.get_growth_hypothesis_handler] = get_growth_hypothesis_handler

app.include_router(assessment_router, prefix="/families", tags=["assessment"])


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "process": "family_api", "batch": 1}
