/**
 * Web 端 Family API 适配器。
 * 不保存令牌、不生成 tenant/family 授权，也不绕过既有 Family Scope Guard。
 * 宿主认证层只在已建立服务端会话后把短生命周期 Bearer 与 familyId 注入此适配器。
 */
/** @typedef {{ baseUrl: string, bearerToken?: string, familyId: string }} FamilyApiAdapterConfig */

/**
 * @param {FamilyApiAdapterConfig} config
 */
export function createFamilyApiAdapter({ baseUrl, bearerToken, familyId }) {
  if (!baseUrl || !familyId) throw new Error('family_api_context_required');
  /** @param {string} path */
  const read = async (path) => {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/families/${familyId}${path}`, {
      headers: bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {},
      credentials: bearerToken ? 'omit' : 'include',
    });
    if (!response.ok) throw new Error(`family_api_read_failed_${response.status}`);
    return response.json();
  };
  /** @param {string} path @param {Record<string, unknown>} body */
  const write = async (path, body) => {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/families/${familyId}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}),
        'idempotency-key': globalThis.crypto?.randomUUID?.() ?? `web-followup-${Date.now()}`,
      },
      credentials: bearerToken ? 'omit' : 'include',
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`family_api_write_failed_${response.status}`);
    return response.json();
  };
  return {
    getFamily: () => read(''),
    getToday: () => read('/today'),
    getJourneyPlan: () => read('/growth/journey-plan'),
    getExperienceCustomerProjection: () => read('/orchestration/test-loop/experience/customer-projection'),
    /** @param {string} operationId @param {{ follow_up_status: 'PENDING_FOLLOW_UP'|'PROCESSED', operator_note?: string|null, assigned_to_account_id?: string|null, follow_up_due_date?: string|null }} input */
    updateOperationFollowUp: (operationId, input) => write(`/orchestration/test-loop/experience/operations/${operationId}/follow-up`, input),
    getOperationFollowUpAssignees: () => read('/orchestration/test-loop/experience/operations/follow-up/assignees'),
    getOperationFollowUpWorkspaceMetrics: () => read('/orchestration/test-loop/experience/operations/follow-up/metrics'),
    /** @param {string[]} operationIds */
    batchProcessOperationFollowUps: (operationIds) => write('/orchestration/test-loop/experience/operations/follow-up/batch-process', { operation_ids: operationIds }),
    /** @param {string[]} operationIds @param {string} assignedToAccountId @param {string|null} dueDate */
    batchAssignOperationFollowUps: (operationIds, assignedToAccountId, dueDate) => write('/orchestration/test-loop/experience/operations/follow-up/batch-assign', { operation_ids: operationIds, assigned_to_account_id: assignedToAccountId, follow_up_due_date: dueDate }),
    /** @param {string} onboardingId */
    getServiceJourney: (onboardingId) => read(`/growth/onboardings/${onboardingId}/service-journey`),
    getCoreGrowthPreview: () => read('/dev/core-growth'),
    getPlatformSurfacePreview: () => read('/dev/platform-surfaces'),
    getTenantScopedUiProjection: () => read('/tenant-scoped/ui-projection'),
  };
}
