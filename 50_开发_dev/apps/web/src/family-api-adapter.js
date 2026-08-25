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
  /** @param {string} path @param {Record<string, unknown>} body @param {string=} idempotencyKey */
  const write = async (path, body, idempotencyKey) => {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/families/${familyId}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}),
        'idempotency-key': idempotencyKey ?? globalThis.crypto?.randomUUID?.() ?? `web-followup-${Date.now()}`,
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
    getFamilyHome: () => read('/ui/01/home'),
    getFamilyAssessment: () => read('/ui/02/assessment'),
    /** @param {string} subjectPersonId @param {string} toolRef @param {string} idempotencyKey */
    startFamilyAssessment: (subjectPersonId, toolRef, idempotencyKey) => write('/assessments/sessions', { subject_person_id: subjectPersonId, tool_ref: toolRef }, idempotencyKey),
    /** @param {string} sessionId @param {{ item_ref: string, response_type: 'SINGLE_CHOICE'|'TEXT'|'BOOLEAN', response_value: string|boolean }} input @param {string} idempotencyKey */
    saveFamilyAssessmentResponse: (sessionId, input, idempotencyKey) => write(`/assessments/sessions/${sessionId}/responses`, input, idempotencyKey),
    /** @param {string} sessionId @param {string} idempotencyKey */
    submitFamilyAssessment: (sessionId, idempotencyKey) => write(`/assessments/sessions/${sessionId}/submit`, {}, idempotencyKey),
    getGrowthHypothesis: () => read('/ui/03/growth-hypothesis'),
    /** @param {{ assessment_session_id: string, hypothesis_ref: string, decision_type: 'CONFIRM'|'DISMISS' }} input @param {string} idempotencyKey */
    decideGrowthHypothesis: (input, idempotencyKey) => write('/growth-hypotheses/decisions', input, idempotencyKey),
    /** @param {string} subjectPersonId @param {string} rawText @param {string} idempotencyKey */
    requestGrowthHelp: (subjectPersonId, rawText, idempotencyKey) => write('/orchestration/needs', { subject_person_id: subjectPersonId, raw_text: rawText }, idempotencyKey),
    /** @param {string} signalId @param {string} goalText @param {string} idempotencyKey */
    confirmGrowthIntent: (signalId, goalText, idempotencyKey) => write('/orchestration/intents', { signal_id: signalId, goal_text: goalText }, idempotencyKey),
    /** @param {string} intentId @param {string} idempotencyKey */
    requestGrowthRecommendation: (intentId, idempotencyKey) => write(`/orchestration/intents/${intentId}/recommendations`, {}, idempotencyKey),
    /** @param {{ intent_id: string, recommendation_id: string, recommendation_version: number, decision_type: 'ACCEPT_RECOMMENDATION'|'DISMISS', selected_offer_refs: string[] }} input @param {string} idempotencyKey */
    decideGrowthService: (input, idempotencyKey) => write('/orchestration/decisions', input, idempotencyKey),
    getServiceTasks: (caseId) => read(`/orchestration/cases/${encodeURIComponent(caseId)}/tasks`),
    createServiceTask: (caseId, input, idempotencyKey) => write(`/orchestration/cases/${encodeURIComponent(caseId)}/tasks`, input, idempotencyKey),
    assignServiceTask: (caseId, taskId, input, idempotencyKey) => write(`/orchestration/cases/${encodeURIComponent(caseId)}/tasks/${encodeURIComponent(taskId)}/assign`, input, idempotencyKey),
    deliverServiceTask: (caseId, taskId, input, idempotencyKey) => write(`/orchestration/cases/${encodeURIComponent(caseId)}/tasks/${encodeURIComponent(taskId)}/deliver`, input, idempotencyKey),
    verifyServiceTask: (caseId, taskId, input, idempotencyKey) => write(`/orchestration/cases/${encodeURIComponent(caseId)}/tasks/${encodeURIComponent(taskId)}/verify`, input, idempotencyKey),
    getJourneyPlan: () => read('/growth/journey-plan'),
    getExperienceCustomerProjection: () => read('/orchestration/test-loop/experience/customer-projection'),
    /** @param {string} operationId @param {{ follow_up_status: 'PENDING_FOLLOW_UP'|'PROCESSED', operator_note?: string|null }} input */
    updateOperationFollowUp: (operationId, input) => write(`/orchestration/test-loop/experience/operations/${operationId}/follow-up`, input),
    /** @param {string} onboardingId */
    getServiceJourney: (onboardingId) => read(`/growth/onboardings/${onboardingId}/service-journey`),
    getCoreGrowthPreview: () => read('/dev/core-growth'),
    getPlatformSurfacePreview: () => read('/dev/platform-surfaces'),
    getTenantScopedUiProjection: () => read('/tenant-scoped/ui-projection'),
    /** @param {string} caseId */
    getGrantedCaseProjection: (caseId) => fetch(`${baseUrl.replace(/\/$/, '')}/orchestration/case-access/${encodeURIComponent(caseId)}/projection`, {
      headers: bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {},
      credentials: bearerToken ? 'omit' : 'include',
    }).then(async (response) => {
      if (!response.ok) throw new Error(`case_access_read_failed_${response.status}`);
      return response.json();
    }),
  };
}
