"""In-memory fake implementation of `GrowthIntentPort` — kept for
`GrowthPlanCommandHandler`'s own isolated unit tests
(`tests/test_growth_plan_flow.py`), per
`architecture/FAMILY_AI_PYTHON_ONLY_MIGRATION_PLAN_V1.md` section 9
"FakeProvider" requirement.

Superseded for real wiring purposes: the `growth_priority` domain now has a
real (in-batch) implementation of the GrowthPriority lifecycle
(`confirmGrowthPriority` port, safety/consent gates, ACTIVE/SUPERSEDED
version chain — see `application/commands.py` and
`infrastructure/fake_repository.py` there). Use
`infrastructure/growth_priority_adapter.py`'s `GrowthPriorityAdapter` to
wire `GrowthPlanCommandHandler` to that real domain instead of this stub
whenever the caller wants `createPlan` to actually be gated by a genuinely
confirmed GrowthPriority (see
`tests/test_growth_priority_adapter_integration.py`). This fake remains
useful on its own only for exercising `growth_plan`'s state machine in
isolation, since it has no concept of "confirmed" and will fabricate an
active priority on demand via `seed_active_priority()`.
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
