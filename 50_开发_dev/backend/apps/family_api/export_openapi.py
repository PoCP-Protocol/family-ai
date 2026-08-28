"""Export the family_api FastAPI app's OpenAPI 3.x schema to a JSON file.

Usage (from `50_开发_dev/backend/`):

    python3 -m apps.family_api.export_openapi
    python3 -m apps.family_api.export_openapi --out ../openapi/family-assessment.json

Does NOT start a server or open a real DB connection: `app.openapi()` is a
pure function over the route/Pydantic definitions already registered at
import time. `DATABASE_URL` is not required for this to run — a default is
supplied so importing `apps.family_api.main` (whose `lifespan` only touches
the DB on actual app startup, not on import) doesn't fail in a shell with no
`.env` loaded, per `db.py`'s `init_engine()` being called on `lifespan`
startup, not at import.

Coverage: this is Batch 1 (Assessment domain) only — the 6 routes mounted in
`apps/family_api/main.py` plus `/health`. `ai_runtime` and `workflow_worker`
(migration plan section 2) are not started processes yet and have no routes
to export.
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

# `app.openapi()` never touches the DB (see module docstring), but importing
# `apps.family_api.main` does construct `db.py` module-level state that reads
# `DATABASE_URL` at import time in some configurations — supply an
# obviously-fake default so this script is runnable without a real `.env`.
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://openapi-export:unused@localhost/unused")

from apps.family_api.main import app  # noqa: E402  (must follow the env default above)

DEFAULT_OUT = Path(__file__).resolve().parents[2] / "openapi" / "family-assessment-openapi.json"


def export_openapi(out_path: Path = DEFAULT_OUT) -> Path:
    schema = app.openapi()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(schema, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return out_path


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--out",
        type=Path,
        default=DEFAULT_OUT,
        help=f"Output path for the OpenAPI JSON (default: {DEFAULT_OUT})",
    )
    args = parser.parse_args()
    written = export_openapi(args.out)
    print(f"Wrote OpenAPI schema ({len(app.openapi()['paths'])} paths) to {written}")


if __name__ == "__main__":
    main()
