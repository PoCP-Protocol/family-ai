#!/usr/bin/env node
/**
 * validate-35ui-consistency.mjs
 *
 * 把 "35UI 前端 / 契约 / 后端" 的一致性从"文档声称"变成"代码实测"。
 *
 * 数据来源(全部只读交叉核对,不改任何运行时代码):
 *   - governance/FAMILY_35UI_RUNTIME_MATRIX_V1.json   (runtime_status / declared named_actions 权威)
 *   - packages/contracts/src/family-35ui.ts            (契约 FAMILY_UI_IDS)
 *   - apps/mobile/lib/family/ui-registry.ts            (canonical 前端 = mobile,V4.1 定)
 *   - apps/api/src/**  的 @RequireFamilyAction / @RequireOrchestrationAction (后端实测 guard 集合)
 *
 * 产物(--emit 时生成,默认模式只校验不写):
 *   - governance/FAMILY_35UI_CONSISTENCY_MATRIX_V1.json  (机器 SSOT,*_implemented 由本脚本实测回填)
 *   - governance/FAMILY_35UI_CONSISTENCY_MATRIX_V1.md    (人读版,自动生成)
 *
 * 用法(cwd 必须是 50_开发_dev,与其它 validate-*.mjs 一致):
 *   node tools/validate-35ui-consistency.mjs           # 校验:实测 vs 已提交矩阵,漂移则非零退出
 *   node tools/validate-35ui-consistency.mjs --emit     # 生成/刷新矩阵 JSON + MD
 *
 * 设计红线:named_actions_implemented 只统计"归一化名字精确匹配到后端 guard"的动作,
 * 决不把词汇改名的动作当作已实现(那属于 naming_divergence,须架构师裁决)。文档不得高于代码。
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const emit = process.argv.includes('--emit');

const matrixPath = path.join(root, 'governance', 'FAMILY_35UI_RUNTIME_MATRIX_V1.json');
const contractPath = path.join(root, 'packages', 'contracts', 'src', 'family-35ui.ts');
const mobileRegistryPath = path.join(root, 'apps', 'mobile', 'lib', 'family', 'ui-registry.ts');
const apiSrcRoot = path.join(root, 'apps', 'api', 'src');
const specsActionsDir = path.join(root, 'specs', 'actions');
const outJsonPath = path.join(root, 'governance', 'FAMILY_35UI_CONSISTENCY_MATRIX_V1.json');
const outMdPath = path.join(root, 'governance', 'FAMILY_35UI_CONSISTENCY_MATRIX_V1.md');

const errors = [];
const read = (p) => fs.readFileSync(p, 'utf8');
const assert = (cond, msg) => { if (!cond) errors.push(msg); };

for (const p of [matrixPath, contractPath, mobileRegistryPath]) {
  assert(fs.existsSync(p), `missing source: ${path.relative(root, p)}`);
}
if (errors.length) finish();

// ---------- 归一化 & 分词 ----------
const norm = (s) => String(s).replace(/[_\s-]/g, '').toLowerCase();
const snakeTokens = (s) => String(s).toLowerCase().split('_').filter(Boolean);
const pascalTokens = (s) => String(s).split(/(?=[A-Z])/).map((t) => t.toLowerCase()).filter(Boolean);

// ---------- 读契约 UI 集合 ----------
const contractSrc = read(contractPath);
const contractIds = [...new Set([...contractSrc.matchAll(/'(UI-\d{2})'/g)].map((m) => m[1]))];

// ---------- 读 mobile canonical 前端 UI 集合 ----------
const mobileSrc = read(mobileRegistryPath);
const mobileIds = [...new Set([...mobileSrc.matchAll(/id:\s*"(UI-\d{2})"/g)].map((m) => m[1]))];

// ---------- 实测后端 guard 集合 ----------
function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (/\.ts$/.test(e.name)) out.push(p);
  }
  return out;
}
/** normalized guard name -> { name, locations: [] } */
const backendGuards = new Map();
for (const file of walk(apiSrcRoot)) {
  const text = read(file);
  const rel = path.relative(root, file).replace(/\\/g, '/');
  const re = /@Require(?:Family|Orchestration)Action\('([^']+)'\)/g;
  let m;
  let line = 0;
  // track line numbers
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const lm = lines[i].match(/@Require(?:Family|Orchestration)Action\('([^']+)'\)/);
    if (lm) {
      const g = lm[1];
      const key = norm(g);
      if (!backendGuards.has(key)) backendGuards.set(key, { name: g, locations: [] });
      backendGuards.get(key).locations.push(`${rel}:${i + 1}`);
    }
  }
  void m; void line; void re;
}
const backendGuardNames = [...backendGuards.values()].map((g) => g.name).sort();

// ---------- 权威动作注册表:specs/actions/*.action.yaml (PascalCase) ----------
/** normalized spec action name -> canonical file name */
const specActions = new Map();
if (fs.existsSync(specsActionsDir)) {
  for (const f of fs.readdirSync(specsActionsDir)) {
    const m = f.match(/^(.+)\.action\.yaml$/);
    if (m) specActions.set(norm(m[1]), m[1]);
  }
}
const specActionNames = [...specActions.values()].sort();

// ---------- 逐 UI 计算一致性 ----------
const matrix = JSON.parse(read(matrixPath));
const READONLY_STATUSES = new Set(['READ_ONLY_PROJECTION', 'GATE_BOUNDARY', 'TEST_LOOP_FIXTURE', 'LOCAL_DRAFT', 'NOT_IMPLEMENTED', 'REAL_INTERNAL_RUNTIME']);
const gateForStatus = (status) => ({
  READ_ONLY_PROJECTION: 'G1/G2 (write path per owning domain)',
  GATE_BOUNDARY: 'G2+ business gate (payment/human/child/public)',
  TEST_LOOP_FIXTURE: 'G1-C/G2 (real effect beyond fixture)',
  LOCAL_DRAFT: 'G1-C (promote local draft to canonical)',
  NOT_IMPLEMENTED: 'G1-C (build projection + wiring)',
  REAL_PERSISTED: 'CLOSED',
  REAL_INTERNAL_RUNTIME: 'G2 (external effect)',
}[status] || 'G1/G2');

const rows = matrix.screens.map((s) => {
  const declared = (s.named_actions || []).filter((a) => a && a !== 'NONE');
  const definedInSpecs = declared.filter((a) => specActions.has(norm(a)));
  const implemented = declared.filter((a) => backendGuards.has(norm(a)));
  const unmatched = declared.filter((a) => !backendGuards.has(norm(a)));

  // naming divergence: 未精确匹配,但后端存在共享词元(长度>=5)的 guard —— 疑似改名,advisory,不计入 implemented
  const divergence = [];
  for (const a of unmatched) {
    const at = new Set(snakeTokens(a).filter((t) => t.length >= 5));
    const cands = [];
    for (const g of backendGuards.values()) {
      const shared = pascalTokens(g.name).filter((t) => t.length >= 5 && at.has(t));
      if (shared.length) cands.push(g.name);
    }
    if (cands.length) divergence.push({ declared_action: a, backend_guard_candidates: [...new Set(cands)].sort() });
  }

  const frontendCanonical = mobileIds.includes(s.ui_id);
  const contractPresent = contractIds.includes(s.ui_id);
  const isReadOnlyByDesign = declared.length === 0; // named_actions === ["NONE"]

  let verdict;
  if (!frontendCanonical || !contractPresent) verdict = 'BROKEN_BASELINE';
  else if (isReadOnlyByDesign) verdict = 'READONLY_BY_DESIGN';
  else if (implemented.length === declared.length) verdict = 'BACKEND_WIRED';
  else if (implemented.length > 0) verdict = 'PARTIAL_BACKEND';
  else if (READONLY_STATUSES.has(s.runtime_status)) verdict = 'DECLARED_ONLY_GATED';
  else verdict = 'GAP_BACKEND_MISSING';

  return {
    ui_id: s.ui_id,
    title: s.title,
    loop: s.loop,
    primary_domain: s.primary_domain,
    canonical_frontend_route: s.frontend_route,
    frontend_canonical_present: frontendCanonical,
    web_status: 'ABSENT_BY_DESIGN', // V4.1: mobile canonical; web = ops/console, 35UI 不在 web 承载
    contract_present: contractPresent,
    projection: s.projection,
    runtime_status: s.runtime_status,
    named_actions_declared: declared.length ? declared : ['NONE'],
    named_actions_defined_in_specs: definedInSpecs,
    named_actions_implemented: implemented,
    named_actions_naming_divergence: divergence,
    consistency_verdict: verdict,
    closing_gate: gateForStatus(s.runtime_status),
  };
});

// ---------- 汇总 ----------
const verdictCounts = {};
for (const r of rows) verdictCounts[r.consistency_verdict] = (verdictCounts[r.consistency_verdict] || 0) + 1;
const totalDeclared = rows.reduce((n, r) => n + r.named_actions_declared.filter((a) => a !== 'NONE').length, 0);
const totalDefinedInSpecs = rows.reduce((n, r) => n + r.named_actions_defined_in_specs.length, 0);
const totalImplemented = rows.reduce((n, r) => n + r.named_actions_implemented.length, 0);
const totalDivergence = rows.reduce((n, r) => n + r.named_actions_naming_divergence.length, 0);

const summary = {
  screens: rows.length,
  frontend_canonical: 'apps/mobile (V4.1)',
  frontend_canonical_coverage: `${rows.filter((r) => r.frontend_canonical_present).length}/${rows.length}`,
  web_35ui_coverage: `0/${rows.length} (ABSENT_BY_DESIGN)`,
  contract_coverage: `${rows.filter((r) => r.contract_present).length}/${rows.length}`,
  named_actions_declared: totalDeclared,
  named_actions_defined_in_specs: totalDefinedInSpecs,
  named_actions_implemented_exact: totalImplemented,
  named_actions_naming_divergence: totalDivergence,
  verdicts: verdictCounts,
  three_vocabularies: {
    matrix_style: 'SCREAMING_SNAKE (named_actions in RUNTIME_MATRIX)',
    specs_registry_style: 'PascalCase (specs/actions/*.action.yaml)',
    backend_guard_style: 'PascalCase (@Require*Action guards)',
    note: 'declared/defined_in_specs/implemented 三者归一化后基本不互认,须架构师裁决唯一权威动作词汇表',
  },
  specs_action_registry: specActionNames,
  backend_guard_vocabulary: backendGuardNames,
};

const built = {
  schema_version: 'FAMILY_35UI_CONSISTENCY_MATRIX_V1',
  layered_on: 'FAMILY_AI_PLATFORM_V4_1',
  generated_by: 'tools/validate-35ui-consistency.mjs --emit',
  truth_note:
    'named_actions_implemented 仅统计归一化名字精确匹配到后端 @Require*Action guard 的动作。' +
    'naming_divergence = 后端存在疑似改名的 guard(advisory,须架构师裁决词汇统一),不计入 implemented。' +
    '35_UI_BACKEND_COMPLETE=NO;本矩阵不解除任何 Gate,只登记现状与关闭它的 Gate。',
  runtime_status_source: 'governance/FAMILY_35UI_RUNTIME_MATRIX_V1.json',
  summary,
  screens: rows,
};

// ---------- emit or verify ----------
if (emit) {
  fs.writeFileSync(outJsonPath, JSON.stringify(built, null, 2) + '\n');
  fs.writeFileSync(outMdPath, renderMd(built));
  console.log('EMIT: wrote FAMILY_35UI_CONSISTENCY_MATRIX_V1.{json,md}');
  printSummary();
  finish();
}

// verify mode
assert(contractIds.length === 35, `contract FAMILY_UI_IDS must be 35, got ${contractIds.length}`);
assert(mobileIds.length === 35, `mobile ui-registry must be 35, got ${mobileIds.length}`);
assert(fs.existsSync(outJsonPath), `missing ${path.relative(root, outJsonPath)} — run with --emit first`);
if (!errors.length) {
  const committed = JSON.parse(read(outJsonPath));
  // 关键防漂移:实测 rows 必须与已提交矩阵逐 UI 相等(名字集合 + 判定)
  const cmp = (a, b, ui, field) => {
    const sa = JSON.stringify(a);
    const sb = JSON.stringify(b);
    if (sa !== sb) errors.push(`${ui}: ${field} drift — committed ${sb} != measured ${sa}`);
  };
  const byId = new Map(committed.screens.map((r) => [r.ui_id, r]));
  for (const r of rows) {
    const c = byId.get(r.ui_id);
    if (!c) { errors.push(`${r.ui_id}: missing in committed matrix`); continue; }
    cmp(r.named_actions_implemented, c.named_actions_implemented, r.ui_id, 'named_actions_implemented');
    cmp(r.named_actions_defined_in_specs, c.named_actions_defined_in_specs, r.ui_id, 'named_actions_defined_in_specs');
    cmp(r.consistency_verdict, c.consistency_verdict, r.ui_id, 'consistency_verdict');
    cmp(r.named_actions_declared, c.named_actions_declared, r.ui_id, 'named_actions_declared');
  }
  assert(committed.summary.named_actions_implemented_exact === totalImplemented,
    `summary.named_actions_implemented_exact drift: committed ${committed.summary.named_actions_implemented_exact} != measured ${totalImplemented}`);
}
printSummary();
finish();

// ---------- helpers ----------
function printSummary() {
  console.log('FAMILY_35UI_CONSISTENCY_V1');
  console.log(`screens=${summary.screens}`);
  console.log(`frontend_canonical_coverage=${summary.frontend_canonical_coverage}`);
  console.log(`contract_coverage=${summary.contract_coverage}`);
  console.log(`named_actions declared=${totalDeclared} defined_in_specs=${totalDefinedInSpecs} implemented_exact=${totalImplemented} naming_divergence=${totalDivergence}`);
  console.log(`verdicts=${JSON.stringify(verdictCounts)}`);
}

function renderMd(b) {
  const L = [];
  L.push('# FAMILY 35UI 一致性矩阵 (V1)');
  L.push('');
  L.push('> 本文件由 `tools/validate-35ui-consistency.mjs --emit` 自动生成,请勿手改。');
  L.push('> 叠加于 V4.1;canonical 前端 = `apps/mobile`;`35_UI_BACKEND_COMPLETE=NO`。');
  L.push('> `named_actions_implemented` = 归一化精确匹配到后端 `@Require*Action` guard 的动作(实测);');
  L.push('> `naming_divergence` = 疑似改名的后端 guard(advisory,须架构师裁决),**不计入已实现**。');
  L.push('');
  L.push('## 汇总');
  L.push('');
  L.push(`- screens: **${b.summary.screens}**`);
  L.push(`- canonical 前端(mobile)覆盖: **${b.summary.frontend_canonical_coverage}**`);
  L.push(`- web 35UI 覆盖: **${b.summary.web_35ui_coverage}**`);
  L.push(`- 契约覆盖: **${b.summary.contract_coverage}**`);
  L.push(`- named_actions: declared=**${b.summary.named_actions_declared}** / defined_in_specs=**${b.summary.named_actions_defined_in_specs}** / implemented_exact=**${b.summary.named_actions_implemented_exact}** / naming_divergence=**${b.summary.named_actions_naming_divergence}**`);
  L.push(`- 判定分布: ${JSON.stringify(b.summary.verdicts)}`);
  L.push('');
  L.push('### 三套动作词汇(互不相认,须架构师裁决统一)');
  L.push('');
  L.push(`- 矩阵 named_actions(SCREAMING_SNAKE)`);
  L.push('- specs/actions 注册表(PascalCase): `' + b.summary.specs_action_registry.join('`, `') + '`');
  L.push('- 后端 guard(PascalCase): `' + b.summary.backend_guard_vocabulary.join('`, `') + '`');
  L.push('');
  L.push('## 逐 UI');
  L.push('');
  L.push('| UI | 标题 | loop | 域 | runtime_status | declared | defined_in_specs | implemented | 判定 | 关闭 Gate |');
  L.push('|---|---|---|---|---|---|---|---|---|---|');
  for (const r of b.screens) {
    const impl = r.named_actions_implemented.length ? r.named_actions_implemented.join(', ') : '—';
    const defs = r.named_actions_defined_in_specs.length ? r.named_actions_defined_in_specs.join(', ') : '—';
    const decl = r.named_actions_declared.join(', ');
    L.push(`| ${r.ui_id} | ${r.title} | ${r.loop} | ${r.primary_domain} | ${r.runtime_status} | ${decl} | ${defs} | ${impl} | ${r.consistency_verdict} | ${r.closing_gate} |`);
  }
  L.push('');
  const divs = b.screens.filter((r) => r.named_actions_naming_divergence.length);
  if (divs.length) {
    L.push('## 词汇分歧(naming divergence — 须架构师裁决统一)');
    L.push('');
    L.push('| UI | declared 动作 | 疑似后端 guard |');
    L.push('|---|---|---|');
    for (const r of divs) {
      for (const d of r.named_actions_naming_divergence) {
        L.push(`| ${r.ui_id} | ${d.declared_action} | ${d.backend_guard_candidates.join(', ')} |`);
      }
    }
    L.push('');
  }
  return L.join('\n') + '\n';
}

function finish() {
  if (errors.length) {
    console.error(`FAIL: ${errors.length} consistency error(s)`);
    for (const e of errors) console.error(`- ${e}`);
    process.exit(1);
  }
  console.log(emit ? 'EMIT OK' : 'PASS: 35UI consistency (measured == committed)');
  process.exit(0);
}
