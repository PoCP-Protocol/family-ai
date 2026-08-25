import { describe, expect, it, vi } from 'vitest';
import { CaseAccessProjectionError, loadGrantedCaseProjection } from './case-access-client.js';

describe('Account-scoped Case access client', () => {
  it('reads the server projection without sending familyId or partyId', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ projection: { case_id: 'case-1', family_id: 'family-1', status: 'OPEN' }, granted_scope: { service_case: 'summary' } }),
    });
    const result = await loadGrantedCaseProjection({ apiBaseUrl: 'http://api.test', caseId: 'case-1', authToken: 'token', fetchImpl });
    expect(result.projection.case_id).toBe('case-1');
    expect(fetchImpl).toHaveBeenCalledWith('http://api.test/orchestration/case-access/case-1/projection', expect.objectContaining({
      headers: { Authorization: 'Bearer token' },
      credentials: 'omit',
    }));
  });

  it('keeps default deny when the backend returns 403', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 403 });
    await expect(loadGrantedCaseProjection({ apiBaseUrl: 'http://api.test', caseId: 'case-1', fetchImpl })).rejects.toEqual(
      expect.objectContaining({ name: 'CaseAccessProjectionError', message: 'case_access_read_failed_403' }),
    );
  });

  it('rejects a projection for another case', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ projection: { case_id: 'other', status: 'OPEN' } }) });
    await expect(loadGrantedCaseProjection({ apiBaseUrl: 'http://api.test', caseId: 'case-1', fetchImpl })).rejects.toBeInstanceOf(CaseAccessProjectionError);
  });
});
