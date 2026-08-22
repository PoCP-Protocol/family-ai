import { createWafCommunityApp } from './waf.js';
import { createPrincipalApp, defaultPrincipalConfig } from './principal.js';
import { createTestLoopApp, defaultTestLoopConfig } from './test-loop.js';
import { createPlatformConsole } from './platform-console.js';
import { createFamilyApiAdapter } from './family-api-adapter.js';
import { createGrowthApp, defaultConfig } from './app.js';

const root = /** @type {HTMLElement | null} */ (document.querySelector('#app'));

if (!root) {
  throw new Error('Missing #app root element.');
}
const appRoot = root;

const searchParams = new URLSearchParams(window.location.search);
const bearerToken = window.sessionStorage.getItem('family-ui01-ui09-synthetic-bearer') ?? undefined;
const isDevTestRuntime = searchParams.get('runtime') === 'dev-test' && Boolean(bearerToken);

/**
 * 家庭门户复用现有 35 UI Web 流程、Family API 与已注册的 Dev/Test 受控命令。
 * 无会话时只展示页面基线；有会话且显式进入 Dev/Test 时才读取/写入受控测试数据。
 */
function mountFamilyPortal() {
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
      <div class="family-portal-rail-foot"><a href="?product=growth-onboarding">开始一段成长旅程</a><a href="?product=console">进入运营工作台</a></div>
    </aside>
    <section class="family-portal-stage" aria-label="家庭成长页面"><div id="family-portal-experience"></div></section>
    <aside class="family-portal-context" aria-label="家庭成长提示">
      <section><span>家庭成长方式</span><h2>先看见，再行动</h2><p>每一次记录、计划、服务和权益都回到同一个家庭成长旅程中。</p></section>
      <section><span>本周建议</span><strong data-family-portal-today>连接家庭会话后显示</strong><p data-family-portal-today-detail>今天的一项小行动会从同一家庭成长计划读取。</p></section>
      <section data-family-portal-card="journey"><span>计划阶段</span><strong data-family-portal-plan>连接家庭会话后显示</strong><p data-family-portal-plan-detail>计划阶段由同一 90 天成长计划读取。</p></section>
      <section data-family-portal-card="interventions"><span>家庭练习内容</span><strong data-family-portal-interventions>连接家庭会话后显示</strong><p data-family-portal-interventions-detail>仅展示已审核、已发布的家庭练习。</p></section>
      <section data-family-portal-card="operations"><span>运营回执</span><strong data-family-portal-operations>连接家庭会话后显示</strong><p data-family-portal-operations-detail>课程、服务和权益操作均以家庭私有回执回读。</p></section>
      <section><span>家庭资料</span><strong data-family-portal-assets>连接家庭会话后显示</strong><p data-family-portal-assets-detail>家庭档案、同意范围与服务记录始终由现有 Family API 按当前家庭范围读取。</p></section>
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
  const childId = searchParams.get('childId');
  const apiBaseUrl = searchParams.get('apiBaseUrl') ?? defaultTestLoopConfig.apiBaseUrl;
  const planTitle = /** @type {HTMLElement | null} */ (appRoot.querySelector('[data-family-portal-plan]'));
  const planDetail = /** @type {HTMLElement | null} */ (appRoot.querySelector('[data-family-portal-plan-detail]'));
  const operationTitle = /** @type {HTMLElement | null} */ (appRoot.querySelector('[data-family-portal-operations]'));
  const operationDetail = /** @type {HTMLElement | null} */ (appRoot.querySelector('[data-family-portal-operations-detail]'));
  const interventionTitle = /** @type {HTMLElement | null} */ (appRoot.querySelector('[data-family-portal-interventions]'));
  const interventionDetail = /** @type {HTMLElement | null} */ (appRoot.querySelector('[data-family-portal-interventions-detail]'));
  const todayTitle = /** @type {HTMLElement | null} */ (appRoot.querySelector('[data-family-portal-today]'));
  const todayDetail = /** @type {HTMLElement | null} */ (appRoot.querySelector('[data-family-portal-today-detail]'));
  const assetsTitle = /** @type {HTMLElement | null} */ (appRoot.querySelector('[data-family-portal-assets]'));
  const assetsDetail = /** @type {HTMLElement | null} */ (appRoot.querySelector('[data-family-portal-assets-detail]'));
  if (isDevTestRuntime && bearerToken && familyId && planTitle && planDetail && operationTitle && operationDetail && interventionTitle && interventionDetail && todayTitle && todayDetail && assetsTitle && assetsDetail) {
    const adapter = createFamilyApiAdapter({ baseUrl: apiBaseUrl, bearerToken, familyId });
    Promise.all([
      adapter.getJourneyPlan(),
      adapter.getExperienceCustomerProjection(),
      adapter.getInterventionLibrary(),
      childId ? adapter.resolveFamilyContext(childId, 'GROWTH_GUIDANCE') : Promise.resolve(null),
      adapter.getToday(),
      adapter.getTenantScopedUiProjection(),
    ])
      .then(([journeyResult, operationsResult, libraryResult, contextResult, todayResult, tenantProjection]) => {
        const plan = journeyResult?.plan;
        const phase = plan?.current_phase ?? '尚未开始';
        const phases = Array.isArray(plan?.phases) ? /** @type {{ phase?: string, status?: string }[]} */ (plan.phases) : [];
        const operations = Array.isArray(operationsResult?.operations) ? /** @type {{ status?: string }[]} */ (operationsResult.operations) : [];
        const currentPhase = phases.find((item) => item.phase === phase);
        const operationCount = operations.length;
        const pendingCount = operations.filter((item) => item.status !== 'CANCELLED').length;
        const interventions = Array.isArray(libraryResult?.items)
          ? /** @type {{ review_status?: string, intervention?: { name_zh?: string } }[]} */ (libraryResult.items).filter((item) => item.review_status === 'PUBLISHED')
          : [];
        const context = /** @type {{ consent?: { allowed?: boolean }, action_bridge_status?: string } | null} */ (contextResult);
        planTitle.textContent = `当前阶段 · ${phase}`;
        planDetail.textContent = currentPhase?.status === 'REVIEW_DUE' ? '这一阶段可以回顾：继续下一阶段，或先调整节奏。' : `计划状态：${currentPhase?.status ?? plan?.status ?? '未连接'}`;
        operationTitle.textContent = `家庭回执 · ${operationCount} 条`;
        operationDetail.textContent = pendingCount > 0 ? `${pendingCount} 条受控操作已记录，均未触发外部效果。` : '当前没有待回看的受控操作。';
        interventionTitle.textContent = `已审核练习 · ${interventions.length} 项`;
        interventionDetail.textContent = interventions.length > 0
          ? `${interventions[0]?.intervention?.name_zh ?? '家庭练习'}可用于成长计划；${context?.consent?.allowed ? '成长使用同意已确认' : '当前仅展示通用内容'}，行动仍需家长确认。`
          : '当前没有可用的已发布家庭练习。';
        const today = /** @type {{ assignment_text?: string, journey_phase?: string, day_index?: number }|null} */ (todayResult);
        todayTitle.textContent = today?.assignment_text ?? '今天还没有安排成长行动';
        todayDetail.textContent = today?.assignment_text
          ? `来自${today.journey_phase ?? '当前'}阶段 · 第 ${today.day_index ?? 1} 天；完成只记录行动过程。`
          : '可先完成家庭测评或确认成长计划，再回来查看今天的一件小事。';
        const projection = /** @type {{ commercial?: { entitlement_assets?: unknown[], membership_assets?: unknown[] }, service?: { booking_records?: unknown[] } }} */ (tenantProjection ?? {});
        const entitlementCount = projection.commercial?.entitlement_assets?.length ?? 0;
        const membershipCount = projection.commercial?.membership_assets?.length ?? 0;
        const serviceCount = projection.service?.booking_records?.length ?? 0;
        assetsTitle.textContent = `家庭资产 · ${membershipCount + entitlementCount} 项权益`;
        assetsDetail.textContent = serviceCount > 0
          ? `还有 ${serviceCount} 条服务记录可回看；权益和服务均只在当前家庭范围显示。`
          : '当前没有待回看的服务记录；家庭权益会在确认后同步到这里。';
      })
      .catch(() => {
        planTitle.textContent = '暂时无法读取计划';
        planDetail.textContent = '请检查当前家庭会话后重试。';
        operationTitle.textContent = '暂时无法读取回执';
        operationDetail.textContent = '运营回执仍以当前家庭范围为准。';
        interventionTitle.textContent = '暂时无法读取练习内容';
        interventionDetail.textContent = '仅在家庭会话和审核状态有效时展示。';
        todayTitle.textContent = '暂时无法读取今天的行动';
        todayDetail.textContent = '请检查当前家庭会话后重试。';
        assetsTitle.textContent = '暂时无法读取家庭资产';
        assetsDetail.textContent = '权益与服务记录始终以当前家庭范围为准。';
      });
  }
  appRoot.dataset.clientSurface = 'web-family-portal';
  appRoot.dataset.platformCore = 'existing-family-api';
  appRoot.dataset.runtime = isDevTestRuntime ? 'DEV_TEST_CONTROLLED' : 'BASELINE_READONLY';
}

if (searchParams.get('product') === 'console') {
  // 正式 Web 默认入口：仅展示现有 tenant_family_bindings、account membership 与 Family API
  // 的租户/家庭范围语义，不在 Web 端创建平行的 tenant 或 IAM 本体。
  const familyId = searchParams.get('familyId') ?? undefined;
  const apiBaseUrl = searchParams.get('apiBaseUrl') ?? 'http://localhost:3000';
  const familyAdapter = familyId && bearerToken ? createFamilyApiAdapter({ baseUrl: apiBaseUrl, bearerToken, familyId }) : undefined;
  const loadTenantScopedProjection = familyAdapter ? () => familyAdapter.getTenantScopedUiProjection() : undefined;
  const loadFamilyOperations = familyAdapter ? () => familyAdapter.getExperienceCustomerProjection() : undefined;
  /** @type {((operationId: string, input: { follow_up_status: 'PENDING_FOLLOW_UP'|'PROCESSED', operator_note?: string|null, assigned_to_account_id?: string|null, follow_up_due_date?: string|null }) => Promise<{ follow_up_status: string, operator_note: string|null, follow_up_updated_at: string, assigned_to_account_id: string|null, assigned_to_display_name: string|null, follow_up_due_date: string|null }>)|undefined} */
  const updateFamilyOperationFollowUp = familyAdapter
    ? async (operationId, input) => /** @type {{ follow_up_status: string, operator_note: string|null, follow_up_updated_at: string, assigned_to_account_id: string|null, assigned_to_display_name: string|null, follow_up_due_date: string|null }} */ (await familyAdapter.updateOperationFollowUp(operationId, input))
    : undefined;
  const loadOperationFollowUpAssignees = familyAdapter ? () => familyAdapter.getOperationFollowUpAssignees() : undefined;
  const loadOperationFollowUpWorkspaceMetrics = familyAdapter ? () => familyAdapter.getOperationFollowUpWorkspaceMetrics() : undefined;
  /** @type {((operationIds: string[]) => Promise<{ operation_ids: string[], updated_count: number, follow_up_status: string }>)|undefined} */
  const batchProcessFamilyOperationFollowUps = familyAdapter
    ? async (operationIds) => /** @type {{ operation_ids: string[], updated_count: number, follow_up_status: string }} */ (await familyAdapter.batchProcessOperationFollowUps(operationIds))
    : undefined;
  /** @type {((operationIds: string[], assignedToAccountId: string, dueDate: string|null) => Promise<{ operation_ids: string[], updated_count: number, assigned_to_account_id: string, follow_up_due_date: string|null }>)|undefined} */
  const batchAssignFamilyOperationFollowUps = familyAdapter
    ? async (operationIds, assignedToAccountId, dueDate) => /** @type {{ operation_ids: string[], updated_count: number, assigned_to_account_id: string, follow_up_due_date: string|null }} */ (await familyAdapter.batchAssignOperationFollowUps(operationIds, assignedToAccountId, dueDate))
    : undefined;
  createPlatformConsole(root, {
    tenantId: searchParams.get('tenantId') ?? 'tenant_bangyang',
    role: /** @type {'PLATFORM_ADMIN'|'TENANT_ADMIN'|'TENANT_OPERATOR'|'SERVICE_ADVISOR'|'FAMILY_MEMBER'} */ (searchParams.get('role') ?? 'TENANT_OPERATOR'),
    loadTenantScopedProjection,
    loadFamilyOperations,
    updateFamilyOperationFollowUp,
    loadOperationFollowUpAssignees,
    loadOperationFollowUpWorkspaceMetrics,
    batchProcessFamilyOperationFollowUps,
    batchAssignFamilyOperationFollowUps,
  });
} else if (searchParams.get('product') === 'test-loop' || window.location.hash === '#test-loop') {
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
  mountFamilyPortal();
} else {
  // 无法识别的入口不降级为其他产品，避免混淆家庭门户与运营控制台的使用语境。
  window.location.replace('?product=family');
}
