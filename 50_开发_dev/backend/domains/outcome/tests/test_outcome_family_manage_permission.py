"""Tests for the RBAC half of `assert_tenant_family_scope` — the port of
`assertFamilyManagePermission` (`apps/api/src/modules/family/family-permission.ts`).

This is the domain's core correctness proof: `growth-review.service.ts` (the
NestJS file Outcome is ported from) carries its own independent copy of
`assertFamilyManagePermission` that implements ONLY the legacy `CreateFamily`
audit branch and never evaluates the `family_memberships` (tenancy) branch —
a confirmed NestJS bug (see `domain/permission_policy.py`). The Python port
must NOT reproduce that bug: both pass conditions below are exercised
independently (legacy-only success, tenancy-only success), and a case where
NEITHER holds must fail — which is the only way to demonstrate the tenancy
branch is actually wired in and not silently ignored the way the NestJS
source ignores it.
"""
from __future__ import annotations

import uuid

import pytest

from domains.outcome.domain.errors import OutcomeForbiddenError
from domains.outcome.infrastructure.fake_repository import FakeOutcomeRepository

TENANT_ID = "tenant-1"


@pytest.fixture
def family_id() -> str:
    return str(uuid.uuid4())


@pytest.fixture
def repo(family_id: str) -> FakeOutcomeRepository:
    repository = FakeOutcomeRepository()
    repository.seed_family(TENANT_ID, family_id)
    return repository


class TestAssertFamilyManagePermission:
    async def test_legacy_create_family_audit_passes_even_without_membership(
        self, repo: FakeOutcomeRepository, family_id: str
    ):
        """Pass condition #1 (legacy) alone is sufficient."""
        actor_id = "legacy-creator-actor"
        repo.seed_create_family_audit(family_id, actor_id)

        await repo.assert_tenant_family_scope(TENANT_ID, family_id, actor_id)

    async def test_owner_guardian_membership_passes_without_legacy_audit(
        self, repo: FakeOutcomeRepository, family_id: str
    ):
        """Pass condition #2 (tenancy) alone is sufficient — this is the
        branch `growth-review.service.ts` never evaluates. If the Python
        port had reproduced that bug, this test would fail with
        `actor_has_family_manage_permission` even though the actor holds an
        ACTIVE OWNER_GUARDIAN membership.
        """
        actor_id = str(uuid.uuid4())
        repo.grant_family_manage_permission(family_id, actor_id, role="OWNER_GUARDIAN")

        await repo.assert_tenant_family_scope(TENANT_ID, family_id, actor_id)

    async def test_guardian_membership_passes_without_legacy_audit(self, repo: FakeOutcomeRepository, family_id: str):
        """Same as above with the other manage-eligible role."""
        actor_id = str(uuid.uuid4())
        repo.grant_family_manage_permission(family_id, actor_id, role="GUARDIAN")

        await repo.assert_tenant_family_scope(TENANT_ID, family_id, actor_id)

    async def test_neither_condition_holding_is_forbidden(self, repo: FakeOutcomeRepository, family_id: str):
        """Core negative proof: an actor with NO legacy audit row and NO
        family_memberships row must be rejected — both gates are actually
        enforced, neither one is a rubber stamp.
        """
        actor_id = str(uuid.uuid4())

        with pytest.raises(OutcomeForbiddenError) as exc_info:
            await repo.assert_tenant_family_scope(TENANT_ID, family_id, actor_id)
        assert exc_info.value.code == "actor_has_family_manage_permission"

    async def test_non_manage_role_membership_is_forbidden(self, repo: FakeOutcomeRepository, family_id: str):
        """A family_memberships row exists, but with a role outside the
        manage-eligible allow-list — the tenancy branch must check `role`,
        not merely "does a membership row exist".
        """
        actor_id = str(uuid.uuid4())
        repo.grant_family_manage_permission(family_id, actor_id, role="ADULT_MEMBER")

        with pytest.raises(OutcomeForbiddenError) as exc_info:
            await repo.assert_tenant_family_scope(TENANT_ID, family_id, actor_id)
        assert exc_info.value.code == "actor_has_family_manage_permission"

    async def test_membership_in_a_different_family_does_not_grant_permission(
        self, repo: FakeOutcomeRepository, family_id: str
    ):
        other_family_id = str(uuid.uuid4())
        repo.seed_family(TENANT_ID, other_family_id)
        actor_id = str(uuid.uuid4())
        repo.grant_family_manage_permission(other_family_id, actor_id, role="OWNER_GUARDIAN")

        with pytest.raises(OutcomeForbiddenError) as exc_info:
            await repo.assert_tenant_family_scope(TENANT_ID, family_id, actor_id)
        assert exc_info.value.code == "actor_has_family_manage_permission"

    async def test_tenant_family_scope_is_still_checked_before_rbac(self, repo: FakeOutcomeRepository, family_id: str):
        """A membership alone must not bypass the tenant_family_bindings
        gate — the two checks are sequential (scope, then manage
        permission), not OR'd against each other.
        """
        unbound_family_id = str(uuid.uuid4())
        actor_id = str(uuid.uuid4())
        repo.grant_family_manage_permission(unbound_family_id, actor_id, role="OWNER_GUARDIAN")

        with pytest.raises(OutcomeForbiddenError) as exc_info:
            await repo.assert_tenant_family_scope(TENANT_ID, unbound_family_id, actor_id)
        assert exc_info.value.code == "tenant_family_scope_denied"

    async def test_default_seeded_test_actor_still_passes(self, repo: FakeOutcomeRepository, family_id: str):
        await repo.assert_tenant_family_scope(TENANT_ID, family_id, "actor-1")
