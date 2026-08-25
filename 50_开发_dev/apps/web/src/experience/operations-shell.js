// @ts-nocheck
// Presentation-only shell; domain contracts remain type-checked in the existing adapters.
const OPS_NAV = [
  ['overview', '运营总览', '今天需要关注什么'], ['families', '家庭运营', '家庭上下文与阶段'], ['journeys', '成长旅程', '21 / 90 天交付'], ['assessment', '测评与 AI 质量', '证据、假设与评测'], ['services', '服务交付', '专家、预约与记录'], ['content', '内容与社区', '内容、草稿与审核'], ['commerce', '会员与资产', '意向、权益与回执'], ['safety', '安全与人工介入', '高风险队列与同意'], ['audit', '审计与回执', '命名动作、模型运行'], ['settings', '组织与权限', '租户、角色与策略'],
];
const escapeHtml = (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
const workspace = (item) => `<header class="ops-page-head"><div><span>Family AI / 治理 / 设计预览</span><h1>${item[1]}</h1><p>${item[2]}</p></div><span class="ops-preview-pill">演示数据</span></header><section class="ops-panel ops-alert"><h2>${item[1]}</h2><p>当前页面只展示当前租户与角色范围内的只读投影；真实写入继续通过既有 Family API、Named Action、Policy 和 Human Gate。</p></section><section class="ops-grid">${['当前状态','待处理队列','来源与边界'].map((label, index) => `<article class="ops-panel"><small>${label}</small><h3>${index === 0 ? '按当前上下文查看' : index === 1 ? '需要人工确认' : '不把 AI 输出当作家庭事实'}</h3><p>${escapeHtml(item[2])}；不使用家庭评分或跨家庭排名。</p></article>`).join('')}</section>`;
export function createOperationsExperience(root) {
  let current = 'overview';
  root.innerHTML = `<div class="family-web family-web--ops"><aside class="ops-sidebar"><a class="ops-brand" href="?product=console"><span>F</span><div><b>Family AI</b><small>运营工作台</small></div></a><nav>${OPS_NAV.map(([id, label, hint]) => `<button data-ops-route="${id}"><b>${label}</b><small>${hint}</small></button>`).join('')}</nav><footer><a href="?product=family">返回家庭空间</a></footer></aside><section class="ops-app"><header class="ops-topbar"><label>⌕ <input type="search" placeholder="搜索家庭、服务单、内容或回执"></label><span>榜样教育 · 租户运营员</span></header><main data-ops-content></main></section><div class="ops-toast" data-ops-toast role="status"></div></div>`;
  const content = root.querySelector('[data-ops-content]'); const toast = root.querySelector('[data-ops-toast]');
  const showToast = (message) => { toast.textContent = message; toast.classList.add('is-visible'); window.setTimeout(() => toast.classList.remove('is-visible'), 2000); };
  const render = () => { const item = OPS_NAV.find(([id]) => id === current) ?? OPS_NAV[0]; content.innerHTML = workspace(item); root.querySelectorAll('[data-ops-route]').forEach((button) => { button.classList.toggle('is-active', button.dataset.opsRoute === current); button.onclick = () => { current = button.dataset.opsRoute; render(); }; }); document.title = `${item[1]} · Family AI 运营工作台`; };
  render(); root.dataset.clientSurface = 'operations-web-v2'; return { navigate: (route) => { current = route; render(); }, getCurrentRoute: () => current, showToast };
}
