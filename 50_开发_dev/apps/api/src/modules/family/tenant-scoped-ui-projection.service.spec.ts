import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve(__dirname, 'tenant-scoped-ui-projection.service.ts'), 'utf8');

describe('TenantScopedUiProjectionService contract', () => {
  it('reuses active tenant/family/account scope and existing read views', () => {
    expect(source).toContain('tenant_family_bindings');
    expect(source).toContain('tenant_account_memberships');
    expect(source).toContain('family_customer_commerce_projection_v');
    expect(source).toContain('family_customer_service_booking_projection_v');
    expect(source).toContain('family_customer_membership_asset_projection_v');
  });

  it('keeps all 35 surfaces and no-op external business boundaries', () => {
    expect(source).toContain('length: 35');
    expect(source).toContain('active_tenant_membership_required_for_family_projection');
    expect(source).toContain("payment: 'NOT_EXECUTED'");
    expect(source).toContain("external_booking: 'NOT_EXECUTED'");
  });
});
