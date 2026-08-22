const tenants = [
  { id: 'tenant_bangyang', name: '榜样家庭成长中心', short: '榜样', brand: 'Family AI · 榜样教育', city: '北京', families: 126 },
  { id: 'tenant_suzhou', name: '苏州家庭成长伙伴', short: '苏州', brand: 'Family AI · 城市伙伴', city: '苏州', families: 48 },
];

/** @typedef {{ benefit_status?: string, remaining_units?: number|string, service_offering_ref?: string, channel?: string, booking_status?: string, external_effect?: boolean }} TenantProjectionRow */
/** @typedef {{ tenant: { tenant_id: string, tenant_ref: string, display_name: string }, commercial?: { entitlement_assets?: TenantProjectionRow[], membership_assets?: TenantProjectionRow[] }, service?: { booking_records?: TenantProjectionRow[] } }} TenantScopedUiProjection */
/** @typedef {{ operation_id: string, page_id: string, operation_kind: string, fixture_ref: string, status: 'CREATED'|'CONFIRMED'|'CANCELLED', source: 'TEST_FIXTURE'|'DOMAIN_COMMAND_ADAPTER', external_effect: false, created_at: string }} FamilyOperationReceipt */
/** @typedef {{ operations?: FamilyOperationReceipt[] }} FamilyOperationsProjection */

const roleNames = {
  PLATFORM_ADMIN: '平台管理员',
  TENANT_ADMIN: '租户管理员',
  TENANT_OPERATOR: '运营负责人',
  SERVICE_ADVISOR: '家庭顾问',
  FAMILY_MEMBER: '家庭成员',
};

const nav = [
  ['overview', '概览', '◈'], ['families', '家庭工作台', '◎'], ['journeys', '成长交付', '↗'],
  ['services', '专家与服务', '◇'], ['content', '内容与社群', '◌'], ['assets', '会员与资产', '▣'],
  ['operations', '运营工作台', '◫'], ['tenant', '租户设置', '⚙'],
];

const roleVisibility = {
  PLATFORM_ADMIN: nav.map(([id]) => id),
  TENANT_ADMIN: nav.map(([id]) => id),
  TENANT_OPERATOR: ['overview', 'families', 'journeys', 'services', 'content', 'assets', 'operations'],
  SERVICE_ADVISOR: ['overview', 'families', 'journeys', 'services'],
  FAMILY_MEMBER: ['overview', 'journeys', 'services', 'assets'],
};

/** @typedef {{ tenantId?: string, role?: keyof typeof roleVisibility, initialProjection?: TenantScopedUiProjection|null, loadTenantScopedProjection?: () => Promise<TenantScopedUiProjection>, initialOperations?: FamilyOperationsProjection|null, loadFamilyOperations?: () => Promise<FamilyOperationsProjection> }} PlatformConsoleOptions */

// Web 仅消费既有 tenant_family_bindings、tenant_policy_profiles 和 Family Scope Guard；不在 Web 端创建平行的 tenant 或 IAM 本体。

const pageCopy = {
  overview: { kicker: '今日运营总览', title: '让每个家庭的下一步都清晰可见', intro: '从家庭目标、行动、服务到权益，所有数据均在当前租户与授权范围内查看。' },
  families: { kicker: '家庭工作台', title: '家庭不是名单，而是持续的成长关系', intro: '按当前租户筛选家庭队列，进入家庭后仍需由服务端 Family Scope Guard 做对象级授权。' },
  journeys: { kicker: '成长交付', title: '把 21 天启动和 90 天陪伴做成标准服务', intro: '这里管理课程版本、行动节奏、顾问待办与阶段回顾，不对儿童生成诊断或结论。' },
  services: { kicker: '专家与服务', title: '供给可排班，服务可回读', intro: '专家、时段与咨询请求均绑定当前租户；实际预约、履约和结算继续走 Family API 受控命令。' },
  content: { kicker: '内容与社群', title: '把可信经验转化为家庭支持', intro: '家长小记、案例与标签需要可见范围和审核状态；默认不公开未成年人内容。' },
  assets: { kicker: '会员与资产', title: '权益、订单和成长档案应有单一账本', intro: 'Web 只展示当前租户中的会员、权益、订单与家庭资产；导出和分享仍由受控回执处理。' },
  operations: { kicker: '运营工作台', title: '用交付质量驱动增长，而非只看成交', intro: '关注激活、行动、服务响应、权益使用和风险队列；指标是运营信号，不是儿童排名。' },
  tenant: { kicker: '租户设置', title: '品牌、角色和数据范围由现有平台模型决定', intro: '本页只适配既有 tenant、tenant_family_binding、policy profile 与 account membership，不创建新的租户本体。' },
};

/** @param {string} label @param {string} value @param {string} delta @param {string} [tone] */
const metric = (label, value, delta, tone = 'blue') => `<article class="metric-card ${tone}"><span>${label}</span><strong>${value}</strong><em>${delta}</em></article>`;
/** @param {string} text @param {string} [kind] */
const pill = (text, kind = '') => `<span class="pill ${kind}">${text}</span>`;
const htmlEscapes = { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' };
/** @param {unknown} value */
const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (character) => htmlEscapes[/** @type {keyof typeof htmlEscapes} */ (character)] ?? character);
/** @param {unknown} value @returns {TenantProjectionRow[]} */
const safeRows = (value) => Array.isArray(value) ? /** @type {TenantProjectionRow[]} */ (value) : [];
/** @param {TenantScopedUiProjection|null} projection @param {(value: TenantScopedUiProjection) => string} selector @param {string} fallback */
const liveValue = (projection, selector, fallback) => projection ? selector(projection) : fallback;

/** @param {TenantScopedUiProjection|null} projection */
function overview(projection) {
  const commerce = safeRows(projection?.commercial?.entitlement_assets); const membership = safeRows(projection?.commercial?.membership_assets); const services = safeRows(projection?.service?.booking_records);
  const caption = projection ? '当前家庭 · 实时 tenant-scoped 读取' : '开发预览 · 未连接真实家庭会话';
  return `<div class="metrics-grid">${metric('家庭范围资产', liveValue(projection, () => String(commerce.length), '—'), caption)}${metric('有效会员权益', liveValue(projection, () => String(membership.filter((item) => item.benefit_status === 'AVAILABLE').length), '—'), caption, 'green')}${metric('服务记录', liveValue(projection, () => String(services.length), '—'), caption, 'amber')}${metric('受控外部效果', liveValue(projection, () => '0', '—'), '支付、预约、通知均未执行','violet')}</div>
  <section class="split-grid"><article class="panel journey-panel"><div class="panel-head"><div><span class="eyebrow">家庭成长旅程</span><h3>从今晚的一件事开始</h3></div><button class="text-btn" data-page="journeys">查看交付</button></div><div class="journey-track"><div class="journey-step done"><b>01</b><span>目标选择</span><small>126 家庭</small></div><div class="journey-step done"><b>02</b><span>行动启动</span><small>92 家庭</small></div><div class="journey-step active"><b>03</b><span>陪伴服务</span><small>41 家庭</small></div><div class="journey-step"><b>04</b><span>阶段回顾</span><small>18 家庭</small></div></div></article>
  <article class="panel signal-panel"><div class="panel-head"><div><span class="eyebrow">运营信号</span><h3>今日优先队列</h3></div>${pill('当前租户','blue')}</div><ul class="signal-list"><li><i class="dot amber"></i><span>6 个家庭完成测评后尚未选择第一项行动</span><b>今日跟进</b></li><li><i class="dot blue"></i><span>3 份顾问建议等待家长确认</span><b>等待确认</b></li><li><i class="dot green"></i><span>8 个 21 天家庭进入第 2 周回顾</span><b>交付节点</b></li></ul></article></section>`;
}

function families() { return `<section class="panel table-panel"><div class="panel-head"><div><span class="eyebrow">家庭队列</span><h3>在授权范围内安排支持</h3></div><div class="filter-row"><button class="filter active">需要跟进</button><button class="filter">21 天</button><button class="filter">90 天</button></div></div><table><thead><tr><th>家庭</th><th>当前目标</th><th>最近行动</th><th>服务状态</th><th></th></tr></thead><tbody><tr><td><b>林杉家庭</b><small>已同意服务跟进</small></td><td>让晚间沟通更平和</td><td>今天 19:40 · 共读 15 分钟</td><td>${pill('顾问待回读','amber')}</td><td><button class="row-action">打开工作台 →</button></td></tr><tr><td><b>陈诺家庭</b><small>已激活 21 天</small></td><td>建立周末家庭会议</td><td>昨天 · 写下家庭小记</td><td>${pill('节奏稳定','green')}</td><td><button class="row-action">打开工作台 →</button></td></tr><tr><td><b>吴一家庭</b><small>测评进行中</small></td><td>尚待确认</td><td>3 天前 · 选择关注主题</td><td>${pill('等待行动','blue')}</td><td><button class="row-action">打开工作台 →</button></td></tr></tbody></table></section>`; }

function journeys() { return `<section class="workspace-grid"><article class="panel"><span class="eyebrow">标准交付包</span><h3>21 天启动 · 90 天陪伴 · 年度会员</h3><div class="program-stack"><div><b>21</b><span><strong>智慧父母成长营</strong><small>每日一件小事 · 每周一次回顾</small></span>${pill('已发布','green')}</div><div><b>90</b><span><strong>家庭成长计划</strong><small>目标、行动、服务与阶段复盘</small></span>${pill('当前版本 v1.4','blue')}</div><div><b>365</b><span><strong>年度家庭成长服务</strong><small>权益、主题季、活动与家庭档案</small></span>${pill('需运营审批','amber')}</div></div></article><article class="panel"><span class="eyebrow">顾问待办</span><h3>交付不是催打卡</h3><div class="task-cards"><div><small>今天</small><b>确认林杉家庭的第二周节奏</b><span>家长已留下反思草稿，等待人工回读。</span></div><div><small>明天</small><b>复核 4 个家庭的阶段回顾</b><span>仅整理家长视角与已完成行动，不下效果结论。</span></div></div></article></section>`; }
/** @param {TenantScopedUiProjection|null} projection */
function services(projection) {
  const records = safeRows(projection?.service?.booking_records);
  const recordsHtml = projection
    ? (records.length ? records.slice(0, 3).map((record) => `<div><span class="avatar blue">服</span><span><b>${escapeHtml(record.service_offering_ref)}</b><small>${escapeHtml(record.channel)} · ${escapeHtml(record.booking_status)} · 开发/测试受控记录</small></span>${pill(record.external_effect === false ? '未外部预约' : '待核验','amber')}</div>`).join('') : '<p class="muted">当前家庭没有可读取的服务记录。</p>')
    : '<p class="muted">开发预览未绑定真实家庭会话；服务记录将在有效 Bearer 会话建立后由 Family API 读取。</p>';
  return `<section class="workspace-grid"><article class="panel"><span class="eyebrow">服务记录</span><h3>家庭范围内的受控回读</h3><div class="supply-list">${recordsHtml}</div></article><article class="panel"><span class="eyebrow">服务边界</span><h3>读取不等于真实履约</h3><div class="quality-row"><b>${projection ? records.length : '—'}</b><span>当前家庭服务记录<br/><small>不是效果评估</small></span></div><div class="quality-row"><b>0</b><span>外部预约与通知<br/><small>本环境一律不执行</small></span></div></article></section>`;
}
function content() { return `<section class="workspace-grid"><article class="panel"><span class="eyebrow">内容审核</span><h3>家长经验需要可信和克制</h3><div class="moderation"><div><b>12</b><span>待审核家庭小记</span>${pill('私有草稿','blue')}</div><div><b>3</b><span>需补充可见范围</span>${pill('人工处理','amber')}</div><div><b>28</b><span>已通过经验阅读</span>${pill('仅家长','green')}</div></div></article><article class="panel"><span class="eyebrow">内容资产</span><h3>本周主题</h3><div class="topic-cloud"><span>晚间沟通</span><span>家庭会议</span><span>亲子阅读</span><span>学习日常</span><span>情绪共处</span></div></article></section>`; }
/** @param {TenantScopedUiProjection|null} projection */
function assets(projection) {
  const entitlements = safeRows(projection?.commercial?.entitlement_assets); const memberships = safeRows(projection?.commercial?.membership_assets); const remainingUnits = memberships.reduce((total, item) => total + Number(item.remaining_units ?? 0), 0);
  return `<section class="workspace-grid"><article class="panel"><span class="eyebrow">权益账本</span><h3>从购买意向到服务兑现</h3><div class="ledger"><div><span>当前会员订阅</span><b>${projection ? memberships.length : '—'}</b><small>${projection ? '当前家庭有效投影' : '需建立真实家庭会话'}</small></div><div><span>可用权益次数</span><b>${projection ? remainingUnits : '—'}</b><small>只读余额，不执行扣减</small></div><div><span>家庭权益资产</span><b>${projection ? entitlements.length : '—'}</b><small>仅限当前 tenant + family</small></div></div></article><article class="panel"><span class="eyebrow">家庭资产</span><h3>私有、可回看、可授权</h3><p class="muted">成长故事、阶段回顾、权益和服务记录按家庭范围隔离。导出与分享都需要明确的家庭授权，并记录受控回执。</p><button class="primary-btn">查看资产规则 <span>→</span></button></article></section>`;
}
/** @param {FamilyOperationsProjection|null} projection @returns {FamilyOperationReceipt[]} */
function safeReceipts(projection) { return Array.isArray(projection?.operations) ? /** @type {FamilyOperationReceipt[]} */ (projection.operations) : []; }
/** @param {string} pageId */
function receiptPageLabel(pageId) { return ({ 'UI-13': '成长商城', 'UI-14': '课程与工具', 'UI-15': '邀请同行', 'UI-16': '一起参与', 'UI-17': '成长积分', 'UI-18': '我的服务', 'UI-19': '专家陪伴', 'UI-20': '专家介绍', 'UI-21': '咨询预约', 'UI-22': '主题活动', 'UI-23': '亲子活动', 'UI-24': '服务进度' })[pageId] ?? pageId; }
/** @param {FamilyOperationsProjection|null} receiptProjection @param {'live'|'loading'|'preview'} receiptState @param {string} pageFilter @param {string} statusFilter */
function operations(receiptProjection, receiptState, pageFilter, statusFilter) {
  const receipts = safeReceipts(receiptProjection);
  const pages = [...new Set(receipts.map((item) => item.page_id))].sort();
  const statuses = [...new Set(receipts.map((item) => item.status))].sort();
  const filtered = receipts.filter((item) => (pageFilter === 'ALL' || item.page_id === pageFilter) && (statusFilter === 'ALL' || item.status === statusFilter));
  const queue = receiptState === 'live'
    ? (filtered.length ? `<div class="table-panel receipt-panel"><div class="filter-row receipt-filters"><label>页面<select id="receiptPageFilter"><option value="ALL">全部页面</option>${pages.map((page) => `<option value="${escapeHtml(page)}" ${page === pageFilter ? 'selected' : ''}>${escapeHtml(receiptPageLabel(page))}</option>`).join('')}</select></label><label>状态<select id="receiptStatusFilter"><option value="ALL">全部状态</option>${statuses.map((status) => `<option value="${escapeHtml(status)}" ${status === statusFilter ? 'selected' : ''}>${escapeHtml(status)}</option>`).join('')}</select></label></div><table><thead><tr><th>页面</th><th>受控动作</th><th>状态</th><th>来源</th><th>外部效果</th></tr></thead><tbody>${filtered.map((item) => `<tr><td><b>${escapeHtml(receiptPageLabel(item.page_id))}</b><small>${escapeHtml(item.page_id)}</small></td><td>${escapeHtml(item.operation_kind)}<small>${escapeHtml(item.fixture_ref)}</small></td><td>${pill(escapeHtml(item.status), item.status === 'CANCELLED' ? 'amber' : 'green')}</td><td>${item.source === 'DOMAIN_COMMAND_ADAPTER' ? '领域命令回执' : '测试体验回执'}</td><td>${pill('未执行', 'blue')}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">当前筛选没有家庭回执。</p>')
    : `<p class="muted">${receiptState === 'loading' ? '正在读取当前家庭的运营回执…' : '建立真实家庭会话后，可按页面和状态查看当前家庭的受控回执。'}</p>`;
  return `<section class="workspace-grid"><article class="panel wide"><span class="eyebrow">运营漏斗</span><h3>把家庭行动与服务质量放在同一张图上</h3><div class="funnel"><div style="--w:100%"><b>326</b><span>进入首页</span></div><div style="--w:78%"><b>255</b><span>选择主题</span></div><div style="--w:56%"><b>183</b><span>完成首个行动</span></div><div style="--w:32%"><b>104</b><span>进入陪伴计划</span></div><div style="--w:18%"><b>58</b><span>使用服务权益</span></div></div></article><article class="panel"><span class="eyebrow">风险队列</span><h3>运营需要先处理什么</h3><ul class="signal-list"><li><i class="dot red"></i><span>1 条内容举报待审核</span></li><li><i class="dot amber"></i><span>3 个服务需求接近 SLA</span></li><li><i class="dot blue"></i><span>5 个权益即将到期</span></li></ul></article><article class="panel wide"><span class="eyebrow">家庭受控回执</span><h3>按页面和状态回看当前家庭操作</h3>${queue}</article></section>`;
}
function tenant() { return `<section class="workspace-grid"><article class="panel"><span class="eyebrow">当前租户上下文</span><h3>复用 Family 既有数据隔离</h3><dl class="tenant-kv"><dt>tenant_id</dt><dd>tenant_bangyang</dd><dt>家庭绑定</dt><dd>tenant_family_bindings</dd><dt>策略档案</dt><dd>tenant_policy_profiles</dd><dt>供给范围</dt><dd>当前租户专家、服务与时段</dd></dl></article><article class="panel"><span class="eyebrow">角色与权限</span><h3>前端只适配，不做授权裁决</h3><p class="muted">所有读取与行动继续由 Bearer、账户成员资格、家庭范围及服务端策略校验。切换租户或角色仅在拥有已有授权时发生。</p><div class="role-list"><span>${pill('平台管理员','violet')}</span><span>${pill('租户管理员','blue')}</span><span>${pill('运营负责人','green')}</span><span>${pill('家庭顾问','amber')}</span></div></article></section>`; }
const renderers = { overview, families, journeys, services, content, assets, operations, tenant };

/** @param {HTMLElement} root @param {PlatformConsoleOptions} [options] */
export function createPlatformConsole(root, options = {}) {
  /** @type {keyof typeof renderers} */ let active = 'overview'; let tenantId = options.tenantId ?? tenants[0].id; /** @type {keyof typeof roleVisibility} */ let role = options.role ?? 'TENANT_OPERATOR';
  /** @type {TenantScopedUiProjection|null} */ let projection = options.initialProjection ?? null; let projectionState = projection ? 'live' : options.loadTenantScopedProjection ? 'loading' : 'preview';
  /** @type {FamilyOperationsProjection|null} */
  let receiptProjection = options.initialOperations ?? null;
  /** @type {'live'|'loading'|'preview'} */
  let receiptState = receiptProjection ? 'live' : options.loadFamilyOperations ? 'loading' : 'preview';
  let receiptPageFilter = 'ALL'; let receiptStatusFilter = 'ALL';
  const render = () => {
    const previewTenant = tenants.find((item) => item.id === tenantId) ?? tenants[0]; const tenant = projection ? { id: projection.tenant.tenant_id, name: projection.tenant.display_name, short: projection.tenant.tenant_ref, city: '已授权会话', families: '当前家庭' } : previewTenant; const copy = pageCopy[active];
    const visibleNav = nav.filter(([id]) => (roleVisibility[role] ?? roleVisibility.TENANT_OPERATOR).includes(id));
    if (!visibleNav.some(([id]) => id === active)) active = 'overview';
    const runtimeNotice = projectionState === 'live' ? '已加载真实 tenant-scoped 读取投影：当前显示内容已同时通过家庭会话、账户成员资格、tenant policy profile 与 tenant/family 双重范围校验；前端不在 Web 端自行裁决高风险策略。' : projectionState === 'loading' ? '正在通过 Family API 读取当前家庭的 tenant-scoped 投影；不会在前端生成或放大任何授权，也不在 Web 端自行裁决高风险策略。' : '开发预览：未建立真实家庭会话，页面不展示伪造的商业、服务或会员数据。真实读取仍由 Family API 的账户成员资格、tenant policy profile 与 Family Scope Guard 校验；前端切换不构成授权，且不在 Web 端自行裁决高风险策略。';
    const content = active === 'operations' ? operations(receiptProjection, receiptState, receiptPageFilter, receiptStatusFilter) : renderers[active](projection);
    root.innerHTML = `<div class="console-shell"><aside class="sidebar"><div class="brand"><span class="brand-mark">F</span><div><b>Family AI</b><small>成长运营平台</small></div></div><div class="tenant-select"><span class="eyebrow">当前租户</span><select id="tenantSelect" ${projection ? 'disabled' : ''}>${projection ? `<option>${escapeHtml(tenant.name)}</option>` : tenants.map((item)=>`<option value="${item.id}" ${item.id===tenantId?'selected':''}>${item.name}</option>`).join('')}</select><small>${escapeHtml(tenant.city)} · ${escapeHtml(tenant.families)} 个家庭</small></div><nav>${visibleNav.map(([id,label,icon])=>`<button class="nav-item ${active===id?'active':''}" data-page="${id}"><span>${icon}</span>${label}</button>`).join('')}</nav><div class="sidebar-foot"><span class="secure-dot"></span><small>${projection ? '真实范围已加载' : '开发预览范围'}</small></div></aside><main class="console-main"><header class="topbar"><div class="crumb"><span>Family AI</span><b>/</b><strong>${escapeHtml(tenant.short)}</strong></div><div class="top-actions"><select id="roleSelect" class="role-select" aria-label="开发预览角色">${Object.entries(roleNames).map(([id,label])=>`<option value="${id}" ${id===role?'selected':''}>${label}</option>`).join('')}</select><button class="help">?</button><button class="user">林</button></div></header><div class="preview-notice">${runtimeNotice}</div><section class="hero"><div><span class="eyebrow">${copy.kicker}</span><h1>${copy.title}</h1><p>${copy.intro}</p></div><div class="hero-actions"><button class="secondary-btn">查看帮助</button><button class="primary-btn" id="quickAction">新建受控任务 <span>+</span></button></div></section><section class="content-area">${content}</section></main></div>`;
    root.querySelectorAll('[data-page]').forEach((button)=>button.addEventListener('click',()=>{active=/** @type {keyof typeof renderers} */ (/** @type {HTMLElement} */ (button).dataset.page ?? 'overview');render();}));
    root.querySelector('#tenantSelect')?.addEventListener('change',(event)=>{tenantId=/** @type {HTMLSelectElement} */ (event.target).value;render();});
    root.querySelector('#roleSelect')?.addEventListener('change',(event)=>{role=/** @type {keyof typeof roleVisibility} */ (/** @type {HTMLSelectElement} */ (event.target).value);render();});
    root.querySelector('#receiptPageFilter')?.addEventListener('change',(event)=>{receiptPageFilter=/** @type {HTMLSelectElement} */ (event.target).value;render();});
    root.querySelector('#receiptStatusFilter')?.addEventListener('change',(event)=>{receiptStatusFilter=/** @type {HTMLSelectElement} */ (event.target).value;render();});
    root.querySelector('#quickAction')?.addEventListener('click',()=>window.alert('此演示仅展示受控任务入口。实际写入仍由现有 Family API、角色、租户与家庭范围策略校验。'));
  };
  render();
  if (options.loadTenantScopedProjection) {
    options.loadTenantScopedProjection().then((nextProjection) => { projection = nextProjection; projectionState = 'live'; render(); }).catch(() => { projectionState = 'preview'; render(); });
  }
  if (options.loadFamilyOperations) {
    options.loadFamilyOperations().then((nextProjection) => { receiptProjection = nextProjection; receiptState = 'live'; render(); }).catch(() => { receiptState = 'preview'; render(); });
  }
}
