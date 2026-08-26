import { describe, expect, it } from 'vitest';

type SubjectKind = 'child' | 'parent' | 'teacher' | 'school' | 'provider' | 'operations';

type SubjectRef = {
  tenantId: string;
  familyId: string;
  subjectId: string;
  kind: SubjectKind;
};

type RecipientScope = {
  tenantId: string;
  familyId: string;
  subjectId: string;
};

type SubjectContext = {
  tenantId: string;
  familyId: string;
  subject?: SubjectRef;
  recipientScope?: RecipientScope;
  globalChildSuperProfile?: boolean;
};

type IsolationResult =
  | { allowed: true }
  | { allowed: false; reason: string };

const reject = (reason: string): IsolationResult => ({ allowed: false, reason });

function evaluateSubjectIsolation(context: SubjectContext): IsolationResult {
  const { subject } = context;

  if (!subject) return reject('subject-required');
  if (context.globalChildSuperProfile) return reject('global-child-super-profile-forbidden');
  if (subject.tenantId !== context.tenantId) return reject('cross-tenant-subject');
  if (subject.familyId !== context.familyId) return reject('cross-family-subject');

  if (context.recipientScope) {
    const scope = context.recipientScope;
    if (
      scope.tenantId !== subject.tenantId ||
      scope.familyId !== subject.familyId ||
      scope.subjectId !== subject.subjectId
    ) {
      return reject('recipient-scope-mismatch');
    }
  }

  return { allowed: true };
}

const child = (subjectId: string, familyId = 'family-a', tenantId = 'tenant-a'): SubjectRef => ({
  tenantId,
  familyId,
  subjectId,
  kind: 'child',
});

describe('subject isolation contract', () => {
  it('allows a subject in the same family and tenant', () => {
    expect(
      evaluateSubjectIsolation({
        tenantId: 'tenant-a',
        familyId: 'family-a',
        subject: child('child-1'),
      }),
    ).toEqual({ allowed: true });
  });

  it('rejects a request with no subject', () => {
    expect(evaluateSubjectIsolation({ tenantId: 'tenant-a', familyId: 'family-a' })).toEqual({
      allowed: false,
      reason: 'subject-required',
    });
  });

  it('rejects a subject from another family', () => {
    expect(
      evaluateSubjectIsolation({
        tenantId: 'tenant-a',
        familyId: 'family-a',
        subject: child('child-1', 'family-b'),
      }),
    ).toEqual({ allowed: false, reason: 'cross-family-subject' });
  });

  it('rejects a subject from another tenant', () => {
    expect(
      evaluateSubjectIsolation({
        tenantId: 'tenant-a',
        familyId: 'family-a',
        subject: child('child-1', 'family-a', 'tenant-b'),
      }),
    ).toEqual({ allowed: false, reason: 'cross-tenant-subject' });
  });

  it('rejects a recipient scope that does not match the explicit subject', () => {
    expect(
      evaluateSubjectIsolation({
        tenantId: 'tenant-a',
        familyId: 'family-a',
        subject: child('child-1'),
        recipientScope: { tenantId: 'tenant-a', familyId: 'family-a', subjectId: 'child-2' },
      }),
    ).toEqual({ allowed: false, reason: 'recipient-scope-mismatch' });
  });

  it('rejects a global child super-profile', () => {
    expect(
      evaluateSubjectIsolation({
        tenantId: 'tenant-a',
        familyId: 'family-a',
        subject: child('child-1'),
        globalChildSuperProfile: true,
      }),
    ).toEqual({ allowed: false, reason: 'global-child-super-profile-forbidden' });
  });

  it('allows multiple children only when each request names its child subject explicitly', () => {
    const requests: SubjectContext[] = ['child-1', 'child-2'].map((subjectId) => ({
      tenantId: 'tenant-a',
      familyId: 'family-a',
      subject: child(subjectId),
      recipientScope: { tenantId: 'tenant-a', familyId: 'family-a', subjectId },
    }));

    expect(requests.map(evaluateSubjectIsolation)).toEqual([{ allowed: true }, { allowed: true }]);
    expect(
      evaluateSubjectIsolation({ tenantId: 'tenant-a', familyId: 'family-a' }),
    ).toEqual({ allowed: false, reason: 'subject-required' });
  });
});
