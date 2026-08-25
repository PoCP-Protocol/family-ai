// @ts-check

/** @typedef {{ case_id: string, family_id: string, status: string, opened_at?: string, next_action_at?: string|null }} GrantedCaseProjection */
/** @typedef {{ projection: GrantedCaseProjection, granted_scope: Record<string, unknown> }} GrantedCaseResponse */

export class CaseAccessProjectionError extends Error {
  /** @param {string} message */
  constructor(message) {
    super(message);
    this.name = 'CaseAccessProjectionError';
  }
}

/**
 * Account-scoped teacher/provider read. The client never submits partyId or familyId.
 * @param {{ apiBaseUrl: string, caseId: string, authToken?: string, fetchImpl?: typeof fetch }} config
 * @returns {Promise<GrantedCaseResponse>}
 */
export async function loadGrantedCaseProjection(config) {
  if (!config.apiBaseUrl || !config.caseId) throw new CaseAccessProjectionError('case_access_context_required');
  const response = await (config.fetchImpl ?? fetch)(
    `${config.apiBaseUrl.replace(/\/$/, '')}/orchestration/case-access/${encodeURIComponent(config.caseId)}/projection`,
    {
      method: 'GET',
      credentials: config.authToken ? 'omit' : 'include',
      headers: config.authToken ? { Authorization: `Bearer ${config.authToken}` } : {},
    },
  );
  if (!response.ok) throw new CaseAccessProjectionError(`case_access_read_failed_${response.status}`);
  const payload = /** @type {GrantedCaseResponse} */ (await response.json());
  if (!payload?.projection || payload.projection.case_id !== config.caseId || typeof payload.projection.status !== 'string') {
    throw new CaseAccessProjectionError('case_access_projection_invalid');
  }
  return payload;
}
