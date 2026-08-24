import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve(process.cwd(), 'src/family-api-adapter.js'), 'utf8');
const mainSource = readFileSync(resolve(process.cwd(), 'src/main.js'), 'utf8');

describe('Family API tenant-scoped Web adapter', () => {
  it('uses the unified tenant-scoped UI projection read endpoint', () => {
    expect(source).toContain("getTenantScopedUiProjection: () => read('/tenant-scoped/ui-projection')");
  });

  it('reads UI-01 from the shared commercial home projection', () => {
    expect(source).toContain("getFamilyHome: () => read('/ui/01/home')");
  });

  it('runs UI-02 through the versioned commercial assessment actions instead of a synthetic flow receipt', () => {
    expect(source).toContain("getFamilyAssessment: () => read('/ui/02/assessment')");
    expect(source).toContain("startFamilyAssessment: (subjectPersonId, toolRef, idempotencyKey) => write('/assessments/sessions'");
    expect(source).toContain("saveFamilyAssessmentResponse: (sessionId, input, idempotencyKey) => write(`/assessments/sessions/${sessionId}/responses`");
    expect(source).toContain("submitFamilyAssessment: (sessionId, idempotencyKey) => write(`/assessments/sessions/${sessionId}/submit`");
    expect(mainSource).toContain('data-family-assessment-subject');
    expect(mainSource).toContain('工具版本 v${tool.version_no}');
    expect(mainSource).toContain("item_ref: 'FOCUS', response_type: 'SINGLE_CHOICE'");
    expect(mainSource).toContain('提交后回答不可修改');
  });

  it('shows UI-03 as an evidence-bound hypothesis and requires an explicit family decision', () => {
    expect(source).toContain("getGrowthHypothesis: () => read('/ui/03/growth-hypothesis')");
    expect(source).toContain("decideGrowthHypothesis: (input, idempotencyKey) => write('/growth-hypotheses/decisions'");
    expect(mainSource).toContain('data-family-hypothesis-actions');
    expect(mainSource).toContain('确认前不会创建成长意图');
    expect(mainSource).toContain("decision_type: decisionType");
    expect(mainSource).toContain('GrowthIntent 已创建，但它不代表成长结果');
  });

  it('does not expose the deleted UI-35 camp lifecycle to the Web entry', () => {
    expect(source).not.toContain('getGrowthCamp');
    expect(source).not.toContain('/ui/35/growth-camp');
    expect(source).not.toContain('enrollGrowthCamp');
    expect(source).not.toContain('checkInGrowthCampDay');
    expect(source).not.toContain('growth-camps');
  });

  it('submits UI-01 growth help with an explicit subject, text and retry-stable idempotency key', () => {
    expect(source).toContain("requestGrowthHelp: (subjectPersonId, rawText, idempotencyKey) => write('/orchestration/needs'");
    expect(source).toContain("confirmGrowthIntent: (signalId, goalText, idempotencyKey) => write('/orchestration/intents'");
    expect(source).toContain("requestGrowthRecommendation: (intentId, idempotencyKey) => write(`/orchestration/intents/${intentId}/recommendations`");
    expect(source).toContain("decideGrowthService: (input, idempotencyKey) => write('/orchestration/decisions'");
    expect(source).toContain('{ subject_person_id: subjectPersonId, raw_text: rawText }');
    expect(source).toContain("'idempotency-key': idempotencyKey ??");
    expect(mainSource).toContain('data-family-growth-help-subject');
    expect(mainSource).toContain("subject.availability === 'AVAILABLE'");
    expect(mainSource).toContain('首页不会自动分析家庭文字');
    expect(mainSource).toContain('growthHelpResult.dataset.safetyRoute');
    expect(mainSource).toContain('确认这个方向并查看可用帮助');
    expect(mainSource).toContain('接受建议并开始');
    expect(mainSource).toContain('今晚先不安排');
  });

  it('reads the established family-scoped operations receipt projection for the portal status card', () => {
    expect(source).toContain("getExperienceCustomerProjection: () => read('/orchestration/test-loop/experience/customer-projection')");
    expect(source).toContain("getJourneyPlan: () => read('/growth/journey-plan')");
  });

  it('writes an operation follow-up only through the existing family-scoped controlled endpoint with an idempotency key', () => {
    expect(source).toContain("updateOperationFollowUp: (operationId, input) => write(`/orchestration/test-loop/experience/operations/${operationId}/follow-up`, input)");
    expect(source).toContain("method: 'POST'");
    expect(source).toContain("'idempotency-key': idempotencyKey ?? globalThis.crypto?.randomUUID?.()");
  });

  it('uses bearer-only credentials when a short-lived bearer is supplied', () => {
    expect(source).toContain("credentials: bearerToken ? 'omit' : 'include'");
    expect(source).toContain('Authorization: `Bearer ${bearerToken}`');
  });
});
