"""In-memory fake implementation of `GrowthIntentPort` — the test double this
domain's own test suite runs against, per
`architecture/FAMILY_AI_PYTHON_ONLY_MIGRATION_PLAN_V1.md` section 9
"FakeProvider" requirement. Not a port of the real GrowthIntent/
GrowthPriority domain's persistence (that domain is out of scope for this
batch); this fake just lets `GrowthPlanCommandHandler.create_plan` be
exercised without blocking on that domain landing first.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field


@dataclass
class FakeGrowthIntentAdapter:
    # (family_id, onboarding_id) -> (priority_id, dimension_id)
    active_priorities: dict[tuple[str, str], tuple[str, str]] = field(default_factory=dict)

    def seed_active_priority(self, family_id: str, onboarding_id: str, dimension_id: str = "P03") -> str:
        priority_id = str(uuid.uuid4())
        self.active_priorities[(family_id, onboarding_id)] = (priority_id, dimension_id)
        return priority_id

    async def load_active_priority(self, family_id: str, onboarding_id: str) -> tuple[str, str] | None:
        return self.active_priorities.get((family_id, onboarding_id))
