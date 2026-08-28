# Family AI Python backend — apps/family_api container image.
#
# Batch 1 scope (FAMILY-AI-PYTHON-ONLY-VERTICAL-P0-001): this packages the
# `family_api` FastAPI process only (Assessment domain). It does NOT replace
# the NestJS API deployment — see apps/family_api/main.py module docstring.
# `ai_runtime` and `workflow_worker` are separate apps in this workspace,
# not yet started/containerized.
#
# Build (from 50_开发_dev/backend/):
#   docker build -t family-api:dev .
# Run (needs a reachable Postgres already migrated via
# 50_开发_dev/database/migrations/0001..0044 — see migrations/README.md):
#   docker run -e DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/db -p 8000:8000 family-api:dev

FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# System deps: none beyond what python:3.12-slim ships are required — the
# workspace uses psycopg (v3, binary wheel) and asyncpg, both of which ship
# prebuilt wheels for linux/amd64 and linux/arm64 on PyPI, so no build-essential
# / libpq-dev layer is needed here.

COPY pyproject.toml ./
COPY apps ./apps
COPY domains ./domains
COPY packages ./packages
COPY intelligence ./intelligence
COPY migrations ./migrations
COPY alembic.ini ./alembic.ini

# This workspace is a flat multi-package layout (apps/, domains/, packages/,
# intelligence/ each their own top-level import root — see pyproject.toml
# [tool.uv.workspace].members), not a single installable distribution, so
# `pip install -e .` on the root itself fails setuptools' flat-layout
# discovery. Instead we install the runtime dependencies directly (mirrors
# pyproject.toml [project].dependencies) and rely on WORKDIR /app already
# being on sys.path (Python adds the script's directory / cwd automatically)
# for the intra-workspace `from domains.assessment...` / `from apps...`
# imports used throughout this codebase.
RUN pip install --no-cache-dir \
    fastapi>=0.115 \
    "pydantic>=2.9" \
    "sqlalchemy>=2.0" \
    "alembic>=1.13" \
    "asyncpg>=0.29" \
    "httpx>=0.27" \
    "python-dotenv>=1.0" \
    "uvicorn[standard]>=0.30" \
    "anthropic>=0.116" \
    "psycopg[binary]>=3.1"

ENV PYTHONPATH=/app

EXPOSE 8000

CMD ["uvicorn", "apps.family_api.main:app", "--host", "0.0.0.0", "--port", "8000"]
