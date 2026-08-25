import { createWafCommunityApp } from './waf.js';
import { createPrincipalApp, defaultPrincipalConfig } from './principal.js';
import { createTestLoopApp, defaultTestLoopConfig } from './test-loop.js';
import { createPlatformConsole } from './platform-console.js';
import { createFamilyApiAdapter } from './family-api-adapter.js';
import { createGrowthApp, defaultConfig } from './app.js';
import { createConsumerExperience } from './experience/consumer-shell.js';
import { createOperationsExperience } from './experience/operations-shell.js';

const root = /** @type {HTMLElement | null} */ (document.querySelector('#app'));

if (!root) {
  throw new Error('Missing #app root element.');
}
const appRoot = root;

const searchParams = new URLSearchParams(window.location.search);
const bearerToken = window.sessionStorage.getItem('family-ui01-ui09-synthetic-bearer') ?? undefined;
const isDevTestRuntime = searchParams.get('runtime') === 'dev-test' && Boolean(bearerToken);

/**
 * 家庭门户复用现有 legacy UI Web 流程、Family API 与已注册的 Dev/Test 受控命令。
 * 无会话时只展示页面基线；有会话且显式进入 Dev/Test 时才读取/写入受控测试数据。
 */
function mountFamilyPortal() {
  document.title = 'Family AI · 家庭成长空间';
  appRoot.dataset.surface = 'external-family';
  appRoot.innerHTML = `<div class="family-portal-layout">
    <aside class="family-portal-rail" aria-label="家庭成长导航">
      <a class="family-portal-brand" href="?product=family"><span>F</span><strong>Family AI</strong><small>家庭成长空间</small></a>
      <nav class="family-portal-nav" aria-label="家庭成长主要入口">
        <button data-family-route="home"><span>⌂</span>今天</button>
        <button data-family-route="growth-assessment"><span>◌</span>成长测评</button>
        <button data-family-route="core-plan"><span>↗</span>成长计划</button>
        <button data-family-route="commerce-mall"><span>◇</span>课程与权益</button>
        <button data-family-route="teacher-zone"><span>◎</span>专家与服务</button>
        <button data-family-route="parent-community"><span>◍</span>家长社区</button>
        <button data-family-route="family-profile"><span>□</span>家庭档案</button>
      </nav>
      <div class="family-portal-rail-foot"><a href="?product=growth-onboarding">开始一段成长旅程</a></div>
    </aside>
    <section class="family-portal-stage" aria-label="家庭成长页面"><div id="family-portal-experience"></div></section>
    <aside class="family-portal-context" aria-label="家庭成长提示">
      <section><span>家庭成长方式</span><h2>先看见，再行动</h2><p>每一次记录、计划、服务和权益都回到同一个家庭成长旅程中。</p></section>
      <section><span>本周建议</span><strong>先完成今晚的一件小事</strong><p>完成后再回看下一步，不需要一次做完所有改变。</p></section>
      <section data-family-portal-card="home"><span>今晚一件事</span><strong data-family-portal-home>连接家庭会话后显示</strong><p data-family-portal-home-detail>由 UI-01 统一家庭首页投影读取。</p></section>
      <section data-family-portal-card="journey"><span>计划阶段</span><strong data-family-portal-plan>连接家庭会话后显示</strong><p data-family-portal-plan-detail>计划阶段由同一 90 天成长计划读取。</p></section>
      <section data-family-portal-card="support"><span>家庭支持</span><strong data-family-portal-operations>连接家庭会话后显示</strong><p data-family-portal-operations-detail>这里显示家庭自己的成长安排和服务记录。</p></section>
      <section data-family-portal-card="assessment"><span>家庭支持需要确认</span><strong data-family-assessment-title>连接家庭会话后可用</strong><p data-family-assessment-detail>回答是家庭视角，不生成孩子分数或医学诊断。</p><form data-family-assessment-form hidden><label>本次关注谁<select data-family-assessment-subject required></select></label><label>当前最希望改善的场景<select data-family-assessment-focus required><option value="">请选择关注场景</option><option value="LEARNING_HABITS">学习习惯</option><option value="EMOTION_REGULATION">情绪管理</option><option value="PARENT_CHILD_COMMUNICATION">亲子沟通</option><option value="DEVICE_USE_CONTEXT">手机与边界</option><option value="SELF_REGULATION">自律能力</option></select></label><label>家庭情况<select data-family-assessment-structure><option value="TWO_PARENT">双亲家庭</option><option value="SINGLE_PARENT">单亲家庭</option><option value="BLENDED">重组家庭</option><option value="PREFER_NOT_TO_SAY">暂不说明</option></select></label><button type="submit">提交家庭支持需要</button></form><p data-family-assessment-result role="status" aria-live="polite"></p></section>
      <section data-family-portal-card="hypothesis"><span>成长解读假设</span><strong data-family-hypothesis-title>完成家庭支持需要后显示</strong><p data-family-hypothesis-detail>确认前不会创建成长意图。</p><div data-family-hypothesis-actions></div><p data-family-hypothesis-result role="status" aria-live="polite"></p></section>
      <section data-family-portal-card="growth-help"><span>法咪莉校长</span><strong data-family-growth-help-title>连接家庭会话后可用</strong><p data-family-growth-help-detail>首页不会自动分析家庭文字，只有显式提交后才会发送。</p><form data-family-growth-help-form hidden><label>为哪位孩子<select data-family-growth-help-subject required></select></label><label>现在发生了什么？<textarea data-family-growth-help-text maxlength="500" required placeholder="例如：孩子刚摔门，我今晚不知道怎么重新开口……"></textarea></label><button type="submit">提交并获取下一步</button></form><p data-family-growth-help-result role="status" aria-live="polite"></p><div data-family-growth-help-actions></div></section>
      <section><span>家庭资料</span><p>家庭档案、同意范围与服务记录始终由现有 Family API 按当前家庭范围读取。</p></section>
    </aside>
  </div>`;
  const experienceRoot = /** @type {HTMLElement | null} */ (appRoot.querySelector('#family-portal-experience'));
  if (!experienceRoot) throw new Error('Missing family portal experience root.');
  const portal = createTestLoopApp(experienceRoot, {
    ...defaultTestLoopConfig,
    apiBaseUrl: searchParams.get('apiBaseUrl') ?? defaultTestLoopConfig.apiBaseUrl,
    familyId: searchParams.get('familyId') ?? defaultTestLoopConfig.familyId,
    initialPage: searchParams.get('page') ?? undefined,
    onboardingId: searchParams.get('onboardingId') ?? undefined,
    firstSliceApiMode: isDevTestRuntime ? 'synthetic-api' : 'disabled',
    coreGrowthApiMode: isDevTestRuntime ? 'synthetic-api' : 'disabled',
    platformSurfacesApiMode: isDevTestRuntime ? 'synthetic-api' : 'disabled',
    commerceCatalogApiMode: isDevTestRuntime ? 'synthetic-api' : 'disabled',
    membershipProjectionApiMode: isDevTestRuntime ? 'synthetic-api' : 'disabled',
    serviceRecordsApiMode: isDevTestRuntime ? 'synthetic-api' : 'disabled',
    authToken: bearerToken,
    authActorId: searchParams.get('actorPersonId') ?? undefined,
  });
  appRoot.querySelectorAll('[data-family-route]').forEach((button) => button.addEventListener('click', () => {
    portal.navigate(/** @type {HTMLElement} */ (button).dataset.familyRoute ?? 'home');
  }));
  const familyId = searchParams.get('familyId') ?? defaultTestLoopConfig.familyId;
  const apiBaseUrl = searchParams.get('apiBaseUrl') ?? defaultTestLoopConfig.apiBaseUrl;
  const planTitle = /** @type {HTMLElement | null} */ (appRoot.querySelector('[data-family-portal-plan]'));
  const planDetail = /** @type {HTMLElement | null} */ (appRoot.querySelector('[data-family-portal-plan-detail]'));
  const operationTitle = /** @type {HTMLElement | null} */ (appRoot.querySelector('[data-family-portal-operations]'));
  const operationDetail = /** @type {HTMLElement | null} */ (appRoot.querySelector('[data-family-portal-operations-detail]'));
  const homeTitle = /** @type {HTMLElement | null} */ (appRoot.querySelector('[data-family-portal-home]'));
  const homeDetail = /** @type {HTMLElement | null} */ (appRoot.querySelector('[data-family-portal-home-detail]'));
  const growthHelpTitle = /** @type {HTMLElement | null} */ (appRoot.querySelector('[data-family-growth-help-title]'));
  const growthHelpDetail = /** @type {HTMLElement | null} */ (appRoot.querySelector('[data-family-growth-help-detail]'));
  const growthHelpForm = /** @type {HTMLFormElement | null} */ (appRoot.querySelector('[data-family-growth-help-form]'));
  const growthHelpSubject = /** @type {HTMLSelectElement | null} */ (appRoot.querySelector('[data-family-growth-help-subject]'));
  const growthHelpText = /** @type {HTMLTextAreaElement | null} */ (appRoot.querySelector('[data-family-growth-help-text]'));
  const growthHelpResult = /** @type {HTMLElement | null} */ (appRoot.querySelector('[data-family-growth-help-result]'));
  const growthHelpActions = /** @type {HTMLElement | null} */ (appRoot.querySelector('[data-family-growth-help-actions]'));
  const assessmentTitle = /** @type {HTMLElement | null} */ (appRoot.querySelector('[data-family-assessment-title]'));
  const assessmentDetail = /** @type {HTMLElement | null} */ (appRoot.querySelector('[data-family-assessment-detail]'));
  const assessmentForm = /** @type {HTMLFormElement | null} */ (appRoot.querySelector('[data-family-assessment-form]'));
  const assessmentSubject = /** @type {HTMLSelectElement | null} */ (appRoot.querySelector('[data-family-assessment-subject]'));
  const assessmentFocus = /** @type {HTMLSelectElement | null} */ (appRoot.querySelector('[data-family-assessment-focus]'));
  const assessmentStructure = /** @type {HTMLSelectElement | null} */ (appRoot.querySelector('[data-family-assessment-structure]'));
  const assessmentResult = /** @type {HTMLElement | null} */ (appRoot.querySelector('[data-family-assessment-result]'));
  const hypothesisTitle = /** @type {HTMLElement | null} */ (appRoot.querySelector('[data-family-hypothesis-title]'));
  const hypothesisDetail = /** @type {HTMLElement | null} */ (appRoot.querySelector('[data-family-hypothesis-detail]'));
  const hypothesisActions = /** @type {HTMLElement | null} */ (appRoot.querySelector('[data-family-hypothesis-actions]'));
  const hypothesisResult = /** @type {HTMLElement | null} */ (appRoot.querySelector('[data-family-hypothesis-result]'));
  if (isDevTestRuntime && bearerToken && familyId && planTitle && planDetail && operationTitle && operationDetail && homeTitle && homeDetail) {
    const adapter = createFamilyApiAdapter({ baseUrl: apiBaseUrl, bearerToken, familyId });
    Promise.all([adapter.getJourneyPlan(), adapter.getExperienceCustomerProjection(), adapter.getFamilyHome(), adapter.getFamilyAssessment(), adapter.getGrowthHypothesis()])
      .then(([journeyResult, operationsResult, homeResult, assessment, hypothesisProjection]) => {
        const plan = journeyResult?.plan;
        const phase = plan?.current_phase ?? '尚未开始';
        const phases = Array.isArray(plan?.phases) ? /** @type {{ phase?: string, status?: string }[]} */ (plan.phases) : [];
        const operations = Array.isArray(operationsResult?.operations) ? /** @type {{ status?: string }[]} */ (operationsResult.operations) : [];
        const currentPhase = phases.find((item) => item.phase === phase);
        const operationCount = operations.length;
        const pendingCount = operations.filter((item) => item.status !== 'CANCELLED').length;
        planTitle.textContent = `当前阶段 · ${phase}`;
        planDetail.textContent = currentPhase?.status === 'REVIEW_DUE' ? '这一阶段可以回顾：继续下一阶段，或先调整节奏。' : `计划状态：${currentPhase?.status ?? plan?.status ?? '未连接'}`;
        operationTitle.textContent = `家庭回执 · ${operationCount} 条`;
        operationDetail.textContent = pendingCount > 0 ? `${pendingCount} 条受控操作已记录，均未触发外部效果。` : '当前没有待回看的受控操作。';
        homeTitle.textContent = homeResult?.primary_action?.assignment_text ?? '今天还没有安排成长行动';
        const recommendationCount = Array.isArray(homeResult?.recommendations) ? homeResult.recommendations.length : 0;
        homeDetail.textContent = `${homeResult?.family?.display_name ?? '当前家庭'} · ${recommendationCount} 项已审核内容/服务可用`;
        const growthHelp = homeResult?.growth_help;
        const subjects = Array.isArray(growthHelp?.subjects) ? /** @type {{ person_id: string, display_name: string, availability: string }[]} */ (growthHelp.subjects) : [];
        const availableSubjects = subjects.filter((subject) => subject.availability === 'AVAILABLE');
        if (hypothesisTitle && hypothesisDetail && hypothesisActions && hypothesisResult) {
          const hypothesis = hypothesisProjection?.hypothesis;
          hypothesisTitle.textContent = hypothesisProjection?.availability === 'READY' && hypothesis ? hypothesis.title : hypothesisProjection?.availability === 'POLICY_BLOCKED' ? '当前家庭策略未开放' : '完成家庭支持需要后显示';
          hypothesisDetail.textContent = hypothesis ? `${hypothesis.statement} 来源：Tool v${hypothesis.source_refs.tool_version} / Evidence ${hypothesis.source_refs.assessment_evidence_id.slice(0, 8)}。局限：${hypothesis.limitations.join('；')}` : '没有已提交测评时，不生成猜测或预置报告。';
          hypothesisActions.replaceChildren();
          if (hypothesis) {
            /** @type {Map<string,string>} */
            const decisionKeys = new Map();
            /** @param {'CONFIRM'|'DISMISS'} decisionType */
            const decideHypothesis = async (decisionType) => {
              const fingerprint = `${hypothesis.hypothesis_ref}:${decisionType}`;
              const key = decisionKeys.get(fingerprint) ?? globalThis.crypto?.randomUUID?.() ?? `web-hypothesis-${Date.now()}`;
              decisionKeys.set(fingerprint, key);
              hypothesisResult.textContent = '正在保存家庭选择……';
              try {
                const receipt = await adapter.decideGrowthHypothesis({ assessment_session_id: hypothesis.source_refs.assessment_session_id, hypothesis_ref: hypothesis.hypothesis_ref, decision_type: decisionType }, key);
                hypothesisResult.textContent = receipt.outcome === 'INTENT_CREATED' ? '家庭已确认；GrowthIntent 已创建，但它不代表成长结果。' : '已记录：暂不形成成长方向；没有创建计划或服务。';
                hypothesisActions.replaceChildren();
                if (receipt.outcome === 'INTENT_CREATED') portal.navigate('core-plan');
              } catch { hypothesisResult.textContent = '这次选择暂时未保存；可安全重试，不会重复创建成长意图。'; }
            };
            const confirm = document.createElement('button'); confirm.type = 'button'; confirm.textContent = '确认这个支持方向'; confirm.addEventListener('click', () => void decideHypothesis('CONFIRM'));
            const dismiss = document.createElement('button'); dismiss.type = 'button'; dismiss.textContent = '暂不形成成长方向'; dismiss.dataset.tone = 'secondary'; dismiss.addEventListener('click', () => void decideHypothesis('DISMISS'));
            hypothesisActions.append(confirm, dismiss);
          }
        }
        if (assessmentTitle && assessmentDetail && assessmentForm && assessmentSubject && assessmentFocus && assessmentStructure && assessmentResult) {
          const assessmentSubjects = Array.isArray(assessment?.subjects) ? /** @type {{ person_id: string, display_name: string, availability: string }[]} */ (assessment.subjects) : [];
          const eligibleAssessmentSubjects = assessmentSubjects.filter((subject) => subject.availability === 'AVAILABLE');
          const tool = assessment?.tool;
          assessmentTitle.textContent = assessment?.availability === 'AVAILABLE' ? '整理此刻最需要的家庭支持' : assessment?.availability === 'CONSENT_REQUIRED' ? '需要先完成测评同意' : assessment?.availability === 'POLICY_BLOCKED' ? '当前家庭策略未开放' : '当前没有可选孩子';
          assessmentDetail.textContent = tool ? `${tool.title} · 工具版本 v${tool.version_no} · E1 家庭视角证据；不评分、不诊断。` : '当前没有已准入的测评工具。';
          assessmentForm.hidden = assessment?.availability !== 'AVAILABLE' || !tool;
          assessmentSubject.replaceChildren();
          const placeholder = document.createElement('option');
          placeholder.value = '';
          placeholder.textContent = '请选择孩子';
          assessmentSubject.append(placeholder);
          for (const subject of eligibleAssessmentSubjects) {
            const option = document.createElement('option');
            option.value = subject.person_id;
            option.textContent = subject.display_name;
            assessmentSubject.append(option);
          }
          /** @type {Map<string, string>} */
          const assessmentKeys = new Map();
          /** @param {string} fingerprint */
          const assessmentKey = (fingerprint) => {
            const current = assessmentKeys.get(fingerprint);
            if (current) return current;
            const created = globalThis.crypto?.randomUUID?.() ?? `web-assessment-${Date.now()}-${assessmentKeys.size}`;
            assessmentKeys.set(fingerprint, created);
            return created;
          };
          assessmentForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const subjectPersonId = assessmentSubject.value;
            const focus = assessmentFocus.value;
            if (!subjectPersonId || !focus || !tool) return;
            const button = /** @type {HTMLButtonElement | null} */ (assessmentForm.querySelector('button[type="submit"]'));
            if (button) button.disabled = true;
            assessmentResult.textContent = '正在保存版本化回答并生成家庭私有证据……';
            try {
              const assessmentSessions = Array.isArray(assessment.sessions) ? /** @type {{ assessment_session_id: string, subject_person_id: string, status: string }[]} */ (assessment.sessions) : [];
              const active = assessmentSessions.find((item) => item.subject_person_id === subjectPersonId && item.status === 'IN_PROGRESS') ?? null;
              const started = active ? { session: active } : await adapter.startFamilyAssessment(subjectPersonId, tool.tool_ref, assessmentKey(`start:${subjectPersonId}:${tool.tool_ref}`));
              const sessionId = started.session.assessment_session_id;
              await adapter.saveFamilyAssessmentResponse(sessionId, { item_ref: 'FOCUS', response_type: 'SINGLE_CHOICE', response_value: focus }, assessmentKey(`focus:${sessionId}:${focus}`));
              await adapter.saveFamilyAssessmentResponse(sessionId, { item_ref: 'FAMILY_STRUCTURE', response_type: 'SINGLE_CHOICE', response_value: assessmentStructure.value }, assessmentKey(`structure:${sessionId}:${assessmentStructure.value}`));
              const submitted = await adapter.submitFamilyAssessment(sessionId, assessmentKey(`submit:${sessionId}:${focus}:${assessmentStructure.value}`));
              assessmentResult.textContent = `已提交并锁定工具 v${submitted.session.tool_version}；证据回执 ${submitted.evidence_id}。提交后回答不可修改。`;
              portal.navigate('core-report');
            } catch {
              assessmentResult.textContent = '暂时没有提交成功；可安全重试，同一请求不会重复创建会话或回答。';
              if (button) button.disabled = false;
            }
          });
        }
        if (growthHelpTitle && growthHelpDetail && growthHelpForm && growthHelpSubject && growthHelpText && growthHelpResult && growthHelpActions) {
          growthHelpTitle.textContent = growthHelp?.state === 'AVAILABLE' ? '说说现在最需要帮助的一件事' : growthHelp?.state === 'CONSENT_REQUIRED' ? '需要先完成服务同意' : growthHelp?.state === 'POLICY_BLOCKED' ? '当前家庭策略未开放' : '当前没有符合服务范围的孩子';
          growthHelpDetail.textContent = '原文只会在你点击提交后发送，并先经过安全分流。';
          growthHelpForm.hidden = growthHelp?.state !== 'AVAILABLE';
          growthHelpSubject.replaceChildren();
          if (availableSubjects.length !== 1) {
            const placeholder = document.createElement('option');
            placeholder.value = '';
            placeholder.textContent = '请选择孩子';
            growthHelpSubject.append(placeholder);
          }
          for (const subject of availableSubjects) {
            const option = document.createElement('option');
            option.value = subject.person_id;
            option.textContent = subject.display_name;
            growthHelpSubject.append(option);
          }
          /** @type {{ fingerprint: string, key: string } | null} */
          let retry = null;
          /** @type {{ fingerprint: string, confirmKey: string, recommendationKey: string } | null} */
          let confirmationRetry = null;
          /** @type {Map<string, string>} */
          const decisionKeys = new Map();
          growthHelpText.addEventListener('input', () => { growthHelpResult.textContent = ''; growthHelpResult.removeAttribute('data-safety-route'); growthHelpActions.replaceChildren(); });
          growthHelpSubject.addEventListener('change', () => { growthHelpResult.textContent = ''; growthHelpResult.removeAttribute('data-safety-route'); growthHelpActions.replaceChildren(); });
          growthHelpForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const subjectPersonId = growthHelpSubject.value;
            const rawText = growthHelpText.value.trim();
            if (!subjectPersonId || !rawText) return;
            const fingerprint = `${subjectPersonId}:${rawText}`;
            if (retry?.fingerprint !== fingerprint) retry = { fingerprint, key: globalThis.crypto?.randomUUID?.() ?? `web-growth-help-${Date.now()}` };
            const button = /** @type {HTMLButtonElement | null} */ (growthHelpForm.querySelector('button[type="submit"]'));
            if (button) button.disabled = true;
            growthHelpActions.replaceChildren();
            growthHelpResult.textContent = '正在安全检查并保存这次请求……';
            try {
              const result = /** @type {{ signal_id: string, confirm_prompt?: string, safety_route?: string, next_action?: string }} */ (await adapter.requestGrowthHelp(subjectPersonId, rawText, retry.key));
              growthHelpResult.dataset.safetyRoute = result.safety_route ?? 'UNKNOWN';
              growthHelpResult.textContent = result.confirm_prompt ?? '已收到请求。';
              if (result.next_action === 'CONFIRM_INTENT') {
                const confirmButton = document.createElement('button');
                confirmButton.type = 'button';
                confirmButton.textContent = '确认这个方向并查看可用帮助';
                growthHelpActions.append(confirmButton);
                confirmButton.addEventListener('click', async () => {
                  const confirmFingerprint = `${result.signal_id}:${rawText}`;
                  if (confirmationRetry?.fingerprint !== confirmFingerprint) confirmationRetry = {
                    fingerprint: confirmFingerprint,
                    confirmKey: globalThis.crypto?.randomUUID?.() ?? `web-confirm-intent-${Date.now()}`,
                    recommendationKey: globalThis.crypto?.randomUUID?.() ?? `web-growth-recommendation-${Date.now()}`,
                  };
                  confirmButton.disabled = true;
                  growthHelpResult.textContent = '正在确认方向并检查可用资源……';
                  try {
                    const intent = /** @type {{ intent_id: string }} */ (await adapter.confirmGrowthIntent(result.signal_id, rawText, confirmationRetry.confirmKey));
                    const recommendation = /** @type {{ recommendation_id: string, intent_id: string, version: number, why_now: string, recommended_offer_refs: string[], candidates: { offer_ref: string, why_this: string, limitations: string[] }[] }} */ (await adapter.requestGrowthRecommendation(intent.intent_id, confirmationRetry.recommendationKey));
                    growthHelpResult.textContent = recommendation.why_now;
                    growthHelpActions.replaceChildren();
                    for (const candidate of recommendation.candidates) {
                      const item = document.createElement('article');
                      const name = candidate.offer_ref === 'resource:v1:ai_coach' ? 'AI 沟通陪练' : candidate.offer_ref === 'resource:v1:no_action' ? '今晚先不安排' : candidate.offer_ref.startsWith('resource:v1:external_referral') ? '专业支持转介' : '家庭成长支持';
                      const title = document.createElement('b'); title.textContent = name;
                      const why = document.createElement('p'); why.textContent = candidate.why_this;
                      item.append(title, why);
                      for (const limitation of candidate.limitations) { const boundary = document.createElement('small'); boundary.textContent = `边界：${limitation}`; item.append(boundary); }
                      growthHelpActions.append(item);
                    }
                    const executableOffers = recommendation.recommended_offer_refs.filter((offerRef) => offerRef !== 'resource:v1:no_action');
                    /** @param {'ACCEPT_RECOMMENDATION'|'DISMISS'} decisionType @param {string[]} selectedOfferRefs */
                    const decide = async (decisionType, selectedOfferRefs) => {
                      const decisionFingerprint = `${recommendation.recommendation_id}:${decisionType}:${selectedOfferRefs.join(',')}`;
                      const decisionKey = decisionKeys.get(decisionFingerprint) ?? globalThis.crypto?.randomUUID?.() ?? `web-growth-decision-${Date.now()}`;
                      decisionKeys.set(decisionFingerprint, decisionKey);
                      growthHelpResult.textContent = '正在保存你的选择……';
                      try {
                        const decision = /** @type {{ outcome?: string, executed_resource_type?: string }} */ (await adapter.decideGrowthService({ intent_id: recommendation.intent_id, recommendation_id: recommendation.recommendation_id, recommendation_version: recommendation.version, decision_type: decisionType, selected_offer_refs: selectedOfferRefs }, decisionKey));
                        growthHelpResult.textContent = decision.outcome === 'SERVICE_STARTED' ? `服务已启动${decision.executed_resource_type ? ` · ${decision.executed_resource_type}` : ''}` : decision.outcome === 'NO_ACTION' ? '已记录：今晚先不安排；没有创建下游成长任务。' : '服务状态已更新，请重新查看可用帮助。';
                        growthHelpActions.replaceChildren();
                      } catch { growthHelpResult.textContent = '这次选择暂时没有保存，请稍后重试；系统不会重复启动服务。'; }
                    };
                    if (executableOffers.length > 0) { const accept = document.createElement('button'); accept.type = 'button'; accept.textContent = '接受建议并开始'; accept.addEventListener('click', () => void decide('ACCEPT_RECOMMENDATION', executableOffers)); growthHelpActions.append(accept); }
                    const dismiss = document.createElement('button'); dismiss.type = 'button'; dismiss.textContent = '今晚先不安排'; dismiss.dataset.tone = 'secondary'; dismiss.addEventListener('click', () => void decide('DISMISS', [])); growthHelpActions.append(dismiss);
                  } catch { growthHelpResult.textContent = '方向确认暂时没有完成，请稍后重试；重复点击不会重复创建记录。'; confirmButton.disabled = false; }
                });
              }
            } catch {
              growthHelpResult.textContent = '暂时没有提交成功，原文仍保留在输入框中，请稍后重试。';
            } finally {
              if (button) button.disabled = false;
            }
          });
        }
      })
      .catch(() => {
        planTitle.textContent = '暂时无法读取计划';
        planDetail.textContent = '请检查当前家庭会话后重试。';
        operationTitle.textContent = '暂时无法读取回执';
        operationDetail.textContent = '运营回执仍以当前家庭范围为准。';
        homeTitle.textContent = '暂时无法读取今晚行动';
        homeDetail.textContent = '请检查当前家庭会话后重试。';
        if (growthHelpTitle) growthHelpTitle.textContent = '暂时无法读取服务状态';
        if (growthHelpDetail) growthHelpDetail.textContent = '请检查当前家庭会话后重试。';
        if (assessmentTitle) assessmentTitle.textContent = '暂时无法读取测评状态';
        if (assessmentDetail) assessmentDetail.textContent = '请检查当前家庭会话后重试。';
        if (hypothesisTitle) hypothesisTitle.textContent = '暂时无法读取成长解读';
        if (hypothesisDetail) hypothesisDetail.textContent = '请检查当前家庭会话后重试。';
      });
  }
  appRoot.dataset.clientSurface = 'web-family-portal';
  appRoot.dataset.platformCore = 'existing-family-api';
  appRoot.dataset.runtime = isDevTestRuntime ? 'DEV_TEST_CONTROLLED' : 'BASELINE_READONLY';
}

if (searchParams.get('product') === 'console') {
  createOperationsExperience(root);
} else if (searchParams.get('product') === 'legacy-console') {
  document.title = 'Family AI · 内部工作台';
  appRoot.dataset.surface = 'internal-operations';
  // 内部工作台与家庭门户使用独立产品入口；权限仍由服务端会话和对象范围决定。
  const familyId = searchParams.get('familyId') ?? undefined;
  const apiBaseUrl = searchParams.get('apiBaseUrl') ?? 'http://localhost:3000';
  const familyAdapter = familyId && bearerToken ? createFamilyApiAdapter({ baseUrl: apiBaseUrl, bearerToken, familyId }) : undefined;
  const loadTenantScopedProjection = familyAdapter ? () => familyAdapter.getTenantScopedUiProjection() : undefined;
  const loadFamilyOperations = familyAdapter ? () => familyAdapter.getExperienceCustomerProjection() : undefined;
  const caseId = searchParams.get('caseId') ?? undefined;
  const loadGrantedCaseProjection = familyAdapter && caseId ? () => familyAdapter.getGrantedCaseProjection(caseId) : undefined;
  const createServiceTask = familyAdapter && caseId
    ? (input) => familyAdapter.createServiceTask(caseId, input)
    : undefined;
  /** @type {((operationId: string, input: { follow_up_status: 'PENDING_FOLLOW_UP'|'PROCESSED', operator_note?: string|null }) => Promise<{ follow_up_status: string, operator_note: string|null, follow_up_updated_at: string }>)|undefined} */
  const updateFamilyOperationFollowUp = familyAdapter
    ? async (operationId, input) => /** @type {{ follow_up_status: string, operator_note: string|null, follow_up_updated_at: string }} */ (await familyAdapter.updateOperationFollowUp(operationId, input))
    : undefined;
  const requestedRole = searchParams.get('role') ?? 'TENANT_OPERATOR';
  const internalRoles = new Set(['PLATFORM_ADMIN', 'TENANT_ADMIN', 'TENANT_OPERATOR', 'SERVICE_ADVISOR']);
  createPlatformConsole(root, {
    tenantId: searchParams.get('tenantId') ?? 'tenant_bangyang',
    role: /** @type {'PLATFORM_ADMIN'|'TENANT_ADMIN'|'TENANT_OPERATOR'|'SERVICE_ADVISOR'} */ (internalRoles.has(requestedRole) ? requestedRole : 'TENANT_OPERATOR'),
    loadTenantScopedProjection,
    loadFamilyOperations,
    updateFamilyOperationFollowUp,
    loadGrantedCaseProjection,
    caseAccessCaseId: caseId,
    createServiceTask,
  });
} else if (searchParams.get('product') === 'test-loop' || searchParams.get('product') === 'legacy-family' || window.location.hash === '#test-loop') {
  // 历史链接仍指向同一家庭门户，避免保留第二套产品入口。
  mountFamilyPortal();
} else if (searchParams.get('product') === 'principal' || window.location.hash === '#principal') {
  // W2-101 消费端法咪莉校长(WF1-C 内部级);确定性、零外呼、x-actor-id。
  createPrincipalApp(root, {
    ...defaultPrincipalConfig,
    apiBaseUrl: searchParams.get('apiBaseUrl') ?? defaultPrincipalConfig.apiBaseUrl,
    actorPersonId: searchParams.get('actorPersonId') ?? defaultPrincipalConfig.actorPersonId,
    familyId: searchParams.get('familyId') ?? defaultPrincipalConfig.familyId,
    childId: searchParams.get('childId') ?? defaultPrincipalConfig.childId,
    onboardingId: searchParams.get('onboardingId') ?? undefined,
    priorityId: searchParams.get('priorityId') ?? undefined,
  });
} else if (searchParams.get('product') === 'waf' || window.location.hash === '#waf') {
  createWafCommunityApp(root);
} else if (searchParams.get('product') === 'growth-onboarding') {
  // 既有成长登记/视角采集流程继续复用原 Family API，实现为家庭门户中的深层入口。
  const config = {
    ...defaultConfig,
    apiBaseUrl: searchParams.get('apiBaseUrl') ?? defaultConfig.apiBaseUrl,
    actorPersonId: searchParams.get('actorPersonId') ?? defaultConfig.actorPersonId,
    familyId: searchParams.get('familyId') ?? defaultConfig.familyId,
    childId: searchParams.get('childId') ?? defaultConfig.childId,
    guardianPersonId: searchParams.get('guardianPersonId') ?? defaultConfig.guardianPersonId,
    authToken: window.sessionStorage.getItem('family-ui01-ui09-synthetic-bearer') ?? undefined,
    wave2ApiMode: searchParams.get('wave2ApiMode') === 'real-api' ? 'real-api' : defaultConfig.wave2ApiMode,
  };

  createGrowthApp(root, config);
} else if (searchParams.get('product') === 'family' || !searchParams.get('product')) {
  createConsumerExperience(root);
} else {
  // 无法识别的入口不降级为其他产品，避免混淆家庭门户与运营控制台的使用语境。
  window.location.replace('?product=family');
}
