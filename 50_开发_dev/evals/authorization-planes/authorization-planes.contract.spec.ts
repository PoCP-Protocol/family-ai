import { describe, expect, it } from 'vitest';

type AuthorizationPlane = 'family' | 'school' | 'partner' | 'operations';
type Decision = 'ALLOW' | 'DENY' | 'REVIEW_REQUIRED';
type HumanGateState = 'NOT_REQUIRED' | 'PENDING' | 'APPROVED' | 'DENIED';

type AuthorizationInput = {
  plane: AuthorizationPlane;
  tenantId: string;
  subjectTenantId: string;
  familyId: string;
  subjectFamilyId: string;
  purpose?: string;
  purposeAllowed: boolean;
  grantStatus: 'ACTIVE' | 'REVOKED';
  expiresAt?: string;
  now: string;
  humanGate: HumanGateState;
  directDatabaseAccess: boolean;
};

type AuthorizationResult = {
  decision: Decision;
  reason: string;
};

function evaluateAuthorizationPlane(input: AuthorizationInput): AuthorizationResult {
  if (input.directDatabaseAccess) {
    return { decision: 'DENY', reason: 'direct-database-access-forbidden' };
  }

  if (input.tenantId !== input.subjectTenantId) {
    return { decision: 'DENY', reason: 'cross-tenant-scope' };
  }

  if (input.familyId !== input.subjectFamilyId) {
    return { decision: 'DENY', reason: 'cross-family-scope' };
  }

  if (!input.purpose || !input.purposeAllowed) {
    return { decision: 'DENY', reason: 'unknown-or-missing-purpose' };
  }

  if (input.grantStatus === 'REVOKED') {
    return { decision: 'DENY', reason: 'grant-revoked' };
  }

  if (input.expiresAt !== undefined && input.expiresAt <= input.now) {
    return { decision: 'DENY', reason: 'grant-expired' };
  }

  if (input.plane === 'operations' && input.humanGate !== 'APPROVED') {
    return {
      decision: input.humanGate === 'DENIED' ? 'DENY' : 'REVIEW_REQUIRED',
      reason: input.humanGate === 'DENIED' ? 'human-gate-denied' : 'human-gate-required',
    };
  }

  return { decision: 'ALLOW', reason: 'authorization-granted' };
}

const baseInput: AuthorizationInput = {
  plane: 'family',
  tenantId: 'tenant-a',
  subjectTenantId: 'tenant-a',
  familyId: 'family-a',
  subjectFamilyId: 'family-a',
  purpose: 'family-growth-read',
  purposeAllowed: true,
  grantStatus: 'ACTIVE',
  now: '2026-08-26T00:00:00.000Z',
  humanGate: 'NOT_REQUIRED',
  directDatabaseAccess: false,
};

describe('authorization planes contract', () => {
  it('allows Family access within the same tenant and family scope', () => {
    expect(evaluateAuthorizationPlane(baseInput)).toEqual({
      decision: 'ALLOW',
      reason: 'authorization-granted',
    });
  });

  it('denies School access when purpose is missing', () => {
    expect(
      evaluateAuthorizationPlane({ ...baseInput, plane: 'school', purpose: undefined }),
    ).toEqual({ decision: 'DENY', reason: 'unknown-or-missing-purpose' });
  });

  it('denies an expired Partner grant', () => {
    expect(
      evaluateAuthorizationPlane({
        ...baseInput,
        plane: 'partner',
        expiresAt: '2026-08-25T23:59:59.999Z',
      }),
    ).toEqual({ decision: 'DENY', reason: 'grant-expired' });
  });

  it('requires review for Operations access without an approved human gate', () => {
    expect(
      evaluateAuthorizationPlane({ ...baseInput, plane: 'operations', humanGate: 'PENDING' }),
    ).toEqual({ decision: 'REVIEW_REQUIRED', reason: 'human-gate-required' });
  });

  it('denies Operations access when the human gate denies it', () => {
    expect(
      evaluateAuthorizationPlane({ ...baseInput, plane: 'operations', humanGate: 'DENIED' }),
    ).toEqual({ decision: 'DENY', reason: 'human-gate-denied' });
  });

  it('denies cross-tenant access', () => {
    expect(
      evaluateAuthorizationPlane({ ...baseInput, subjectTenantId: 'tenant-b' }),
    ).toEqual({ decision: 'DENY', reason: 'cross-tenant-scope' });
  });

  it('denies a revoked grant', () => {
    expect(
      evaluateAuthorizationPlane({ ...baseInput, grantStatus: 'REVOKED' }),
    ).toEqual({ decision: 'DENY', reason: 'grant-revoked' });
  });

  it('denies an unknown purpose', () => {
    expect(
      evaluateAuthorizationPlane({ ...baseInput, purpose: 'unregistered-purpose', purposeAllowed: false }),
    ).toEqual({ decision: 'DENY', reason: 'unknown-or-missing-purpose' });
  });

  it('denies agent or provider direct database access', () => {
    expect(
      evaluateAuthorizationPlane({ ...baseInput, directDatabaseAccess: true }),
    ).toEqual({ decision: 'DENY', reason: 'direct-database-access-forbidden' });
  });
});
