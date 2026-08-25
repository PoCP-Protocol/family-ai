#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const canonicalMapPath = path.join(root, 'governance', 'FAMILY_UI_CANONICAL_MAP_V1.json');
const functionalRebaselinePath = path.join(root, 'governance', 'FAMILY_UI_FUNCTIONAL_REALIZATION_REBASELINE_V1.json');
const consumerBaselinePath = path.join(root, 'governance', 'FAMILY_CONSUMER_UI_BASELINE_V1.json');
const actionPoliciesPath = path.join(root, 'apps', 'mobile', 'lib', 'family', 'ui-action-policies.ts');
const mobileTodoPath = path.join(root, 'apps', 'mobile', 'todo.md');

const errors = [];
const warnings = [];
const read = (filePath) => fs.readFileSync(filePath, 'utf8');
const readJson = (filePath) => JSON.parse(read(filePath));
const assert = (condition, message) => { if (!condition) errors.push(message); };

for (const filePath of [canonicalMapPath, functionalRebaselinePath, consumerBaselinePath, actionPoliciesPath, mobileTodoPath]) {
  assert(fs.existsSync(filePath), `missing required rebaseline artifact: ${filePath}`);
}
if (errors.length) finish();

const canonicalMap = readJson(canonicalMapPath);
const functional = readJson(functionalRebaselinePath);
const consumerBaseline = readJson(consumerBaselinePath);
const actionPolicies = read(actionPoliciesPath);
const todo = read(mobileTodoPath);
const expectedIds = Array.from({ length: 34 }, (_, index) => `UI-${String(index + 1).padStart(2, '0')}`);

assert(canonicalMap.schema_version === 'FAMILY_UI_CANONICAL_MAP_V1', 'wrong canonical map schema_version');
assert(functional.schema_version === 'FAMILY_UI_FUNCTIONAL_REALIZATION_REBASELINE_V1', 'wrong functional rebaseline schema_version');
assert(canonicalMap.architecture_id === 'FAMILY_AI_PLATFORM_V4_1', 'canonical map must bind to V4.1');
assert(functional.architecture_id === 'FAMILY_AI_PLATFORM_V4_1', 'functional rebaseline must bind to V4.1');
assert(canonicalMap.status === 'ACTIVE', 'canonical map must be ACTIVE');
assert(functional.status === 'ACTIVE', 'functional rebaseline must be ACTIVE');
assert(canonicalMap.numbering_decision?.ui35_status === 'DELETED_DUPLICATE_PRODUCT_SURFACE', 'UI-35 deletion decision must remain explicit');

const canonicalScreens = canonicalMap.screens ?? [];
const depthScreens = functional.screen_depths ?? [];
const baselineScreens = consumerBaseline.screens ?? [];
assert(canonicalScreens.length === 34, `canonical map must contain 34 screens, got ${canonicalScreens.length}`);
assert(depthScreens.length === 34, `functional rebaseline must contain 34 screen depths, got ${depthScreens.length}`);
assert(baselineScreens.length === 34, `consumer baseline must contain 34 screens, got ${baselineScreens.length}`);

const canonicalIds = new Set(canonicalScreens.map((screen) => screen.ui_id));
const depthIds = new Set(depthScreens.map((screen) => screen.ui_id));
const baselineIds = new Set(baselineScreens.map((screen) => screen.ui_id));
for (const uiId of expectedIds) {
  assert(canonicalIds.has(uiId), `canonical map missing ${uiId}`);
  assert(depthIds.has(uiId), `functional rebaseline missing ${uiId}`);
  assert(baselineIds.has(uiId), `consumer baseline missing ${uiId}`);
}
assert(!canonicalIds.has('UI-35') && !depthIds.has('UI-35') && !baselineIds.has('UI-35'), 'UI-35 must not re-enter canonical maps');

const semanticKeys = new Set();
for (const screen of canonicalScreens) {
  assert(typeof screen.semantic_key === 'string' && /^[A-Z0-9_]+$/.test(screen.semantic_key), `${screen.ui_id}: semantic_key must be stable SCREAMING_SNAKE_CASE`);
  assert(!semanticKeys.has(screen.semantic_key), `${screen.ui_id}: duplicate semantic_key ${screen.semantic_key}`);
  semanticKeys.add(screen.semantic_key);
  const route = path.join(root, screen.current_route);
  assert(fs.existsSync(route), `${screen.ui_id}: current_route missing: ${screen.current_route}`);
}

const allowedDepths = new Set((functional.depth_levels ?? []).map((entry) => entry.level));
for (const screen of depthScreens) {
  assert(semanticKeys.has(screen.semantic_key), `${screen.ui_id}: screen_depth semantic_key not present in canonical map`);
  assert(allowedDepths.has(screen.current_depth), `${screen.ui_id}: invalid current_depth ${screen.current_depth}`);
  assert(allowedDepths.has(screen.target_depth), `${screen.ui_id}: invalid target_depth ${screen.target_depth}`);
  assert(typeof screen.gap_class === 'string' && screen.gap_class.length > 5, `${screen.ui_id}: gap_class required`);
  assert(typeof screen.implementation_wave === 'string' && screen.implementation_wave.startsWith('PHASE_'), `${screen.ui_id}: implementation_wave required`);
}

const markerEvidence = [];
for (const marker of functional.current_gap_markers ?? []) {
  if (actionPolicies.includes(marker) || todo.includes(marker)) markerEvidence.push(marker);
}
assert(markerEvidence.length >= 6, 'functional rebaseline must stay evidence-linked to current draft/no-op markers');

const prohibitedCompletionClaims = [
  '页面开发完成 = 业务产品完成',
  'UI项目完成 = Family 1.0 ready'
];
for (const claim of prohibitedCompletionClaims) {
  assert(!todo.includes(claim), `todo must not claim false completion: ${claim}`);
}

const requiredLoops = new Set(['GOLDEN_GROWTH_LOOP', 'SERVICE_LOOP', 'COMMERCE_LOOP', 'COMMUNITY_LOOP', 'FAMILY_OPERATIONS_OS']);
for (const loop of functional.product_loops ?? []) requiredLoops.delete(loop.loop_id);
assert(requiredLoops.size === 0, `missing product loop(s): ${[...requiredLoops].join(', ')}`);

const hasUi35AuditDisposition = todo.includes('UI-35 基线状态说明（供审计追溯，不代表当前代码状态）');
if (todo.includes('- [x] 接入 UI-13 至 UI-18 商业、权益、积分、邀请和家庭参与循环') && !hasUi35AuditDisposition) {
  warnings.push('todo.md still uses visual/projection completion language; functional rebaseline supersedes it for Family 1.0 readiness');
}

console.log('FAMILY_UI_FUNCTIONAL_REALIZATION_GATE_V1');
console.log(`screens=${canonicalScreens.length}`);
console.log(`semantic_keys=${semanticKeys.size}`);
console.log(`gap_markers_evidenced=${markerEvidence.length}`);
console.log(`warnings=${warnings.length}`);
for (const warning of warnings) console.warn(`WARN: ${warning}`);
finish();

function finish() {
  if (errors.length) {
    console.error(`FAIL: ${errors.length} functional realization error(s)`);
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log('PASS: UI functional realization rebaseline');
}