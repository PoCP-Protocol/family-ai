const tenants = [
  { id: 'tenant_bangyang', name: '榜样家庭成长中心', short: '榜样', brand: 'Family AI · 榜样教育', city: '北京', families: 126 },
  { id: 'tenant_suzhou', name: '苏州家庭成长伙伴', short: '苏州', brand: 'Family AI · 城市伙伴', city: '苏州', families: 48 },
];

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

const metric = (label, value, delta, tone = 'blue') => `<article class="metric-card ${tone}"><span>${label}</span><strong>${value}</strong><em>${delta}</em></article>`;
const pill = (text, kind = '') => `<span class="pill ${kind}">${text}</span>`;

function overview() {
  return `<div class="metrics-grid">${metric('本周活跃家庭','86','较上周 +12%')}${metric('完成首个行动','63%','本周目标 70%','green')}${metric('待跟进服务','12','4 项在 SLA 内','amber')}${metric('权益使用率','58%','较上周 +6%','violet')}</div>
  <section class="split-grid"><article class="panel journey-panel"><div class="panel-head"><div><span class="eyebrow">家庭成长旅程</span><h3>从今晚的一件事开始</h3></div><button class="text-btn" data-page="journeys">查看交付</button></div><div class="journey-track"><div class="journey-step done"><b>01</b><span>目标选择</span><small>126 家庭</small></div><div class="journey-step done"><b>02</b><span>行动启动</span><small>92 家庭</small></div><div class="journey-step active"><b>03</b><span>陪伴服务</span><small>41 家庭</small></div><div class="journey-step"><b>04</b><span>阶段回顾</span><small>18 家庭</small></div></div></article>
  <article class="panel signal-panel"><div class="panel-head"><div><span class="eyebrow">运营信号</span><h3>今日优先队列</h3></div>${pill('当前租户','blue')}</div><ul class="signal-list"><li><i class="dot amber"></i><span>6 个家庭完成测评后尚未选择第一项行动</span><b>今日跟进</b></li><li><i class="dot blue"></i><span>3 份顾问建议等待家长确认</span><b>等待确认</b></li><li><i class="dot green"></i><span>8 个 21 天家庭进入第 2 周回顾</span><b>交付节点</b></li></ul></article></section>`;
}

function families() { return `<section class="panel table-panel"><div class="panel-head"><div><span class="eyebrow">家庭队列</span><h3>在授权范围内安排支持</h3></div><div class="filter-row"><button class="filter active">需要跟进</button><button class="filter">21 天</button><button class="filter">90 天</button></div></div><table><thead><tr><th>家庭</th><th>当前目标</th><th>最近行动</th><th>服务状态</th><th></th></tr></thead><tbody><tr><td><b>林杉家庭</b><small>已同意服务跟进</small></td><td>让晚间沟通更平和</td><td>今天 19:40 · 共读 15 分钟</td><td>${pill('顾问待回读','amber')}</td><td><button class="row-action">打开工作台 →</button></td></tr><tr><td><b>陈诺家庭</b><small>已激活 21 天</small></td><td>建立周末家庭会议</td><td>昨天 · 写下家庭小记</td><td>${pill('节奏稳定','green')}</td><td><button class="row-action">打开工作台 →</button></td></tr><tr><td><b>吴一家庭</b><small>测评进行中</small></td><td>尚待确认</td><td>3 天前 · 选择关注主题</td><td>${pill('等待行动','blue')}</td><td><button class="row-action">打开工作台 →</button></td></tr></tbody></table></section>`; }

function journeys() { return `<section class="workspace-grid"><article class="panel"><span class="eyebrow">标准交付包</span><h3>21 天启动 · 90 天陪伴 · 年度会员</h3><div class="program-stack"><div><b>21</b><span><strong>智慧父母成长营</strong><small>每日一件小事 · 每周一次回顾</small></span>${pill('已发布','green')}</div><div><b>90</b><span><strong>家庭成长计划</strong><small>目标、行动、服务与阶段复盘</small></span>${pill('当前版本 v1.4','blue')}</div><div><b>365</b><span><strong>年度家庭成长服务</strong><small>权益、主题季、活动与家庭档案</small></span>${pill('需运营审批','amber')}</div></div></article><article class="panel"><span class="eyebrow">顾问待办</span><h3>交付不是催打卡</h3><div class="task-cards"><div><small>今天</small><b>确认林杉家庭的第二周节奏</b><span>家长已留下反思草稿，等待人工回读。</span></div><div><small>明天</small><b>复核 4 个家庭的阶段回顾</b><span>仅整理家长视角与已完成行动，不下效果结论。</span></div></div></article></section>`; }
function services() { return `<section class="workspace-grid"><article class="panel"><span class="eyebrow">服务供给</span><h3>专家与时段</h3><div class="supply-list"><div><span class="avatar blue">周</span><span><b>周岚 · 家庭沟通顾问</b><small>本周可用 8 个时段 · 当前 2 个待确认需求</small></span>${pill('可排班','green')}</div><div><span class="avatar orange">沈</span><span><b>沈然 · 学习日常支持</b><small>本周可用 5 个时段 · 需要补充服务说明</small></span>${pill('待完善','amber')}</div></div></article><article class="panel"><span class="eyebrow">服务质量</span><h3>本周服务信号</h3><div class="quality-row"><b>94%</b><span>家长确认服务摘要<br/><small>不是效果评估</small></span></div><div class="quality-row"><b>4h</b><span>咨询需求中位响应<br/><small>当前租户 SLA：24h</small></span></div></article></section>`; }
function content() { return `<section class="workspace-grid"><article class="panel"><span class="eyebrow">内容审核</span><h3>家长经验需要可信和克制</h3><div class="moderation"><div><b>12</b><span>待审核家庭小记</span>${pill('私有草稿','blue')}</div><div><b>3</b><span>需补充可见范围</span>${pill('人工处理','amber')}</div><div><b>28</b><span>已通过经验阅读</span>${pill('仅家长','green')}</div></div></article><article class="panel"><span class="eyebrow">内容资产</span><h3>本周主题</h3><div class="topic-cloud"><span>晚间沟通</span><span>家庭会议</span><span>亲子阅读</span><span>学习日常</span><span>情绪共处</span></div></article></section>`; }
function assets() { return `<section class="workspace-grid"><article class="panel"><span class="eyebrow">权益账本</span><h3>从购买意向到服务兑现</h3><div class="ledger"><div><span>年度会员</span><b>72</b><small>当前有效家庭</small></div><div><span>咨询权益</span><b>36</b><small>待使用次数</small></div><div><span>活动意向</span><b>18</b><small>等待人工确认</small></div></div></article><article class="panel"><span class="eyebrow">家庭资产</span><h3>私有、可回看、可授权</h3><p class="muted">成长故事、阶段回顾、权益和服务记录按家庭范围隔离。导出与分享都需要明确的家庭授权，并记录受控回执。</p><button class="primary-btn">查看资产规则 <span>→</span></button></article></section>`; }
function operations() { return `<section class="workspace-grid"><article class="panel wide"><span class="eyebrow">运营漏斗</span><h3>把家庭行动与服务质量放在同一张图上</h3><div class="funnel"><div style="--w:100%"><b>326</b><span>进入首页</span></div><div style="--w:78%"><b>255</b><span>选择主题</span></div><div style="--w:56%"><b>183</b><span>完成首个行动</span></div><div style="--w:32%"><b>104</b><span>进入陪伴计划</span></div><div style="--w:18%"><b>58</b><span>使用服务权益</span></div></div></article><article class="panel"><span class="eyebrow">风险队列</span><h3>运营需要先处理什么</h3><ul class="signal-list"><li><i class="dot red"></i><span>1 条内容举报待审核</span></li><li><i class="dot amber"></i><span>3 个服务需求接近 SLA</span></li><li><i class="dot blue"></i><span>5 个权益即将到期</span></li></ul></article></section>`; }
function tenant() { return `<section class="workspace-grid"><article class="panel"><span class="eyebrow">当前租户上下文</span><h3>复用 Family 既有数据隔离</h3><dl class="tenant-kv"><dt>tenant_id</dt><dd>tenant_bangyang</dd><dt>家庭绑定</dt><dd>tenant_family_bindings</dd><dt>策略档案</dt><dd>tenant_policy_profiles</dd><dt>供给范围</dt><dd>当前租户专家、服务与时段</dd></dl></article><article class="panel"><span class="eyebrow">角色与权限</span><h3>前端只适配，不做授权裁决</h3><p class="muted">所有读取与行动继续由 Bearer、账户成员资格、家庭范围及服务端策略校验。切换租户或角色仅在拥有已有授权时发生。</p><div class="role-list"><span>${pill('平台管理员','violet')}</span><span>${pill('租户管理员','blue')}</span><span>${pill('运营负责人','green')}</span><span>${pill('家庭顾问','amber')}</span></div></article></section>`; }
const renderers = { overview, families, journeys, services, content, assets, operations, tenant };

export function createPlatformConsole(root, options = {}) {
  let active = 'overview'; let tenantId = options.tenantId ?? tenants[0].id; let role = options.role ?? 'TENANT_OPERATOR';
  const render = () => {
    const tenant = tenants.find((item) => item.id === tenantId) ?? tenants[0]; const copy = pageCopy[active];
    root.innerHTML = `<div class="console-shell"><aside class="sidebar"><div class="brand"><span class="brand-mark">F</span><div><b>Family AI</b><small>成长运营平台</small></div></div><div class="tenant-select"><span class="eyebrow">当前租户</span><select id="tenantSelect">${tenants.map((item)=>`<option value="${item.id}" ${item.id===tenantId?'selected':''}>${item.name}</option>`).join('')}</select><small>${tenant.city} · ${tenant.families} 个家庭</small></div><nav>${nav.map(([id,label,icon])=>`<button class="nav-item ${active===id?'active':''}" data-page="${id}"><span>${icon}</span>${label}</button>`).join('')}</nav><div class="sidebar-foot"><span class="secure-dot"></span><small>现有租户范围已加载</small></div></aside><main class="console-main"><header class="topbar"><div class="crumb"><span>Family AI</span><b>/</b><strong>${tenant.short}</strong></div><div class="top-actions"><span class="role-chip">${roleNames[role] ?? role}</span><button class="help">?</button><button class="user">林</button></div></header><div class="preview-notice">开发预览：队列与指标将由既有 Family API 的 tenant-scoped 投影替换；前端租户切换不构成授权。</div><section class="hero"><div><span class="eyebrow">${copy.kicker}</span><h1>${copy.title}</h1><p>${copy.intro}</p></div><div class="hero-actions"><button class="secondary-btn">查看帮助</button><button class="primary-btn" id="quickAction">新建受控任务 <span>+</span></button></div></section><section class="content-area">${renderers[active]()}</section></main></div>`;
    root.querySelectorAll('[data-page]').forEach((button)=>button.addEventListener('click',()=>{active=button.dataset.page;render();}));
    root.querySelector('#tenantSelect')?.addEventListener('change',(event)=>{tenantId=event.target.value;render();});
    root.querySelector('#quickAction')?.addEventListener('click',()=>window.alert('此演示仅展示受控任务入口。实际写入仍由现有 Family API、角色、租户与家庭范围策略校验。'));
  };
  render();
}
