import { describe, expect, it } from 'vitest';
import { canDisplayOpsSurface, opsRoutes } from '@family/web-platform';

describe('operations production boundary', () => {
  it('keeps operations routes and role allowlist explicit', () => {
    expect(opsRoutes).toContain('/families/[familyId]');
    expect(canDisplayOpsSurface('TENANT_OPERATOR')).toBe(true);
    expect(canDisplayOpsSurface('FAMILY_MEMBER')).toBe(false);
  });
});
