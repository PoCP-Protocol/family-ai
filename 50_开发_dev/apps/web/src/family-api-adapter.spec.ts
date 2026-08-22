import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve(process.cwd(), 'src/family-api-adapter.js'), 'utf8');

describe('Family API tenant-scoped Web adapter', () => {
  it('uses the unified tenant-scoped UI projection read endpoint', () => {
    expect(source).toContain("getTenantScopedUiProjection: () => read('/tenant-scoped/ui-projection')");
  });

  it('reads the established family-scoped operations receipt projection for the portal status card', () => {
    expect(source).toContain("getExperienceCustomerProjection: () => read('/orchestration/test-loop/experience/customer-projection')");
    expect(source).toContain("getJourneyPlan: () => read('/growth/journey-plan')");
  });

  it('reads the approved intervention library and minimum family context through the same bearer family scope', () => {
    expect(source).toContain("getInterventionLibrary: () => read('/growth/interventions')");
    expect(source).toContain('resolveFamilyContext: (subjectPersonId, purpose) => read(`/growth/subjects/${encodeURIComponent(subjectPersonId)}/context/${purpose}`)');
  });

  it('writes an operation follow-up only through the existing family-scoped controlled endpoint with an idempotency key', () => {
    expect(source).toContain("updateOperationFollowUp: (operationId, input) => write(`/orchestration/test-loop/experience/operations/${operationId}/follow-up`, input)");
    expect(source).toContain("method: 'POST'");
    expect(source).toContain("'idempotency-key': globalThis.crypto?.randomUUID?.()");
  });

  it('uses bearer-only credentials when a short-lived bearer is supplied', () => {
    expect(source).toContain("credentials: bearerToken ? 'omit' : 'include'");
    expect(source).toContain('Authorization: `Bearer ${bearerToken}`');
  });
});
