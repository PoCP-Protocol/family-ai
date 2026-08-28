"""Auth/family-context extraction.

EXPLICITLY SIMPLIFIED FOR NOW — real JWT/session verification (matching
NestJS's `@FamilyContext()`/`@ActorId()` decorators, which resolve from a
verified session token, not a raw header) is NOT implemented here. This
reads `x-tenant-id`/`x-family-id`/`x-actor-id` headers directly, with no
signature/session verification, no expiry check, no revocation check. This
is a known, tracked gap (see task report "NOT YET DONE") — acceptable for
PYTHON_READY-stage local verification against a real database, NOT
acceptable to expose on any network-reachable endpoint. Real auth wiring is
required before this process is anything more than a local verification
target.
"""
from __future__ import annotations

from fastapi import Header, HTTPException

from domains.assessment.api.dependencies import FamilyContext


async def extract_family_context(
    x_tenant_id: str | None = Header(default=None),
    x_family_id: str | None = Header(default=None),
    x_actor_id: str | None = Header(default=None),
) -> FamilyContext:
    if not x_tenant_id or not x_family_id or not x_actor_id:
        raise HTTPException(status_code=401, detail="real_family_session_required")
    return FamilyContext(tenant_id=x_tenant_id, family_id=x_family_id, person_id=x_actor_id)
