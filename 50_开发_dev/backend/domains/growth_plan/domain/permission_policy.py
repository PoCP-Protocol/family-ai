"""Family manage-permission policy constants — reused verbatim from the
Assessment domain's port of `assertFamilyManagePermission`
(`apps/api/src/modules/family/family-permission.ts`). Duplicated here
(rather than imported cross-domain) because domains in this workspace do
not depend on each other's internals — see
`architecture/FAMILY_AI_PYTHON_ONLY_MIGRATION_PLAN_V1.md` section 3.
"""
from __future__ import annotations

CREATE_FAMILY_ACTION = "CreateFamily"

FAMILY_MANAGE_ROLES = ("OWNER_GUARDIAN", "GUARDIAN")
