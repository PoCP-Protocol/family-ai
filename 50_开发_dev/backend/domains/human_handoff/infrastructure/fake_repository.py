"""In-memory fake repository — the test double the unit-test suite runs
against (per the migration plan's FakeProvider requirement). Mirrors the same
invariants the real repository must hold: family-scoped load, the atomic
`where status='OPEN'` resolve guard, and the idempotent
`where ... and released_at is null` release stamp (same error codes /
semantics as NestJS `principal.repository.ts`).
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime

from ..domain.entities import HumanHandoff
from ..domain.errors import HumanHandoffForbiddenError
from ..domain.value_objects import HandoffReason, HandoffResolution, HandoffStatus

DEFAULT_TEST_TENANT = "tenant-1"
DEFAULT_TEST_ACTOR = "reviewer-1"


@dataclass
class FakeHumanHandoffRepository:
    """Not thread-safe / not process-safe — intentional; this is a unit-test
    double, not a substitute for a real Postgres-backed repository. Its
    resolve/release methods still enforce the same atomic guards the real SQL
    WHERE clauses enforce, so the state-machine tests exercise real semantics.
    """

    tenant_family_bindings: set[tuple[str, str]] = field(default_factory=set)
    handoffs: dict[str, HumanHandoff] = field(default_factory=dict)  # handoff_id -> row
    # response_id -> (family_id, output payload) — the withheld candidate response.
    responses: dict[str, tuple[str, object]] = field(default_factory=dict)

    # --- seeding helpers -------------------------------------------------

    def seed_scope(self, tenant_id: str, family_id: str) -> None:
        self.tenant_family_bindings.add((tenant_id, family_id))

    def seed_response(self, response_id: str, family_id: str, output: object) -> None:
        """Register a withheld candidate response (as Principal's saveResponse
        would have persisted it) so release can return its body."""
        self.responses[response_id] = (family_id, output)

    # --- port implementation ---------------------------------------------

    async def assert_tenant_family_scope(self, tenant_id: str, family_id: str, actor_id: str) -> None:
        if (tenant_id, family_id) not in self.tenant_family_bindings:
            raise HumanHandoffForbiddenError("tenant_family_scope_denied")

    async def open_handoff(
        self,
        tenant_id: str,
        family_id: str,
        reason: HandoffReason,
        risk_route: str,
        session_id: str | None,
        subject_ref: str | None,
        assigned_role: str | None,
        response_id: str | None,
    ) -> HumanHandoff:
        handoff = HumanHandoff(
            handoff_id=str(uuid.uuid4()),
            family_id=family_id,
            tenant_id=tenant_id,
            reason=reason,
            status=HandoffStatus.OPEN,
            response_id=response_id,
            created_at=datetime.now(UTC),
        )
        self.handoffs[handoff.handoff_id] = handoff
        return handoff

    async def load_by_id(self, handoff_id: str, family_id: str) -> HumanHandoff | None:
        handoff = self.handoffs.get(handoff_id)
        if handoff is None or handoff.family_id != family_id:
            return None
        return handoff

    async def resolve_handoff(
        self, handoff_id: str, family_id: str, actor_id: str, resolution: HandoffResolution, note: str | None
    ) -> bool:
        handoff = self.handoffs.get(handoff_id)
        # Mirrors `where handoff_id=$1 and family_id=$2 and status='OPEN'`.
        if handoff is None or handoff.family_id != family_id or handoff.status != HandoffStatus.OPEN:
            return False
        self.handoffs[handoff_id] = handoff.model_copy(
            update={
                "status": HandoffStatus.RESOLVED,
                "resolution": resolution,
                "note": note,
                "resolved_by_actor_id": actor_id,
            }
        )
        return True

    async def mark_released(self, handoff_id: str, family_id: str, response_id: str) -> bool:
        handoff = self.handoffs.get(handoff_id)
        # Mirrors `where handoff_id=$1 and family_id=$2 and response_id=$3
        #          and resolution='APPROVED' and released_at is null`.
        if (
            handoff is None
            or handoff.family_id != family_id
            or handoff.response_id != response_id
            or handoff.resolution != HandoffResolution.APPROVED
            or handoff.released_at is not None
        ):
            return False
        self.handoffs[handoff_id] = handoff.model_copy(update={"released_at": datetime.now(UTC)})
        return True

    async def load_response_output(self, response_id: str, family_id: str) -> object | None:
        entry = self.responses.get(response_id)
        if entry is None or entry[0] != family_id:
            return None
        return entry[1]
