"""Family manage-permission policy constants for the Outcome domain.

Byte-for-byte port of the constant declared in
`apps/api/src/modules/family/family-permission.ts` (`assertFamilyManagePermission`),
same as `domains/assessment/domain/permission_policy.py`.

Context (recorded per this task's explicit instruction, not a design choice
made here): `architecture/notes/batch2-domain-research-v1.md` section 1.4
documents that `growth-review.service.ts` — the NestJS file this domain is
ported from — carries its own independent copy of `assertFamilyManagePermission`
that implements *only* the legacy `CreateFamily`-audit branch and never
imports the shared `family-permission.ts`, so it never evaluates the
`family_memberships` (tenancy) branch. That is a confirmed NestJS bug, not a
business rule, and a parallel effort is fixing it on the TypeScript side. The
Python port below intentionally implements both pass conditions from the
start — see `infrastructure/fake_repository.py::assert_family_manage_permission`
and the equivalent SQLAlchemy repository — matching the *correct*, authoritative
`family-permission.ts` semantics rather than reproducing the NestJS
`growth-review.service.ts` gap. This is the one documented exception to
"faithfully port current behavior" in this domain.
"""
from __future__ import annotations

# Port of `CREATE_FAMILY_ACTION` in family-permission.ts — the legacy
# audit_logs.action_name value that, on a SUCCESS row for (family_id,
# actor_id), is treated as proof the actor is the family's creator.
CREATE_FAMILY_ACTION = "CreateFamily"

# Port of the `role in ('OWNER_GUARDIAN','GUARDIAN')` clause in
# assertFamilyManagePermission's family_memberships lookup.
FAMILY_MANAGE_ROLES = ("OWNER_GUARDIAN", "GUARDIAN")
