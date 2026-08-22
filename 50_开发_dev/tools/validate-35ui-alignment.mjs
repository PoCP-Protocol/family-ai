#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const strictRuntime = process.argv.includes('--strict-runtime');
const matrixPath = path.join(root, 'governance', 'FAMILY_35UI_RUNTIME_MATRIX_V1.json');
const mobileRegistryPath = path.join(root, 'apps', 'mobile', 'lib', 'family', 'ui-registry.ts');
const mobileDesignPath = path.join(root, 'apps', 'mobile', 'design.md');
const mobileLlmPath = path.join(root, 'apps', 'mobile', 'server', '_core', 'llm.ts');
const mobileDbPath = path.join(root, 'apps', 'mobile', 'server', 'db.ts');
const mobilePackagePath = path.join(root, 'apps', 'mobile', 'package.json');

const errors = [];
const warnings = [];
const assert = (condition, message) => { if (!condition) errors.push(message); };
const read = (p) => fs.readFileSync(p, 'utf8');

assert(fs.existsSync(matrixPath), `missing ${matrixPath}`);
if (errors.length) finish();

const matrix = JSON.parse(read(matrixPath));
const expected = Array.from({ length: 35 }, (_, i) => `UI-${String(i + 1).padStart(2, '0')}`);
const ids = matrix.screens.map((s) => s.ui_id);
const unique = [...new Set(ids)];

assert(ids.length === 35, `matrix must contain 35 screens, got ${ids.length}`);
assert(unique.length === 35, 'matrix contains duplicate UI ids');
assert(expected.every((id) => unique.includes(id)), 'matrix must contain exactly UI-01..UI-35');

const validDomains = new Set(matrix.domains);
const validLoops = new Set(matrix.loops);

for (const screen of matrix.screens) {
  assert(validDomains.has(screen.primary_domain), `${screen.ui_id}: invalid primary_domain`);
  assert(validLoops.has(screen.loop), `${screen.ui_id}: invalid loop`);
  assert(typeof screen.projection === 'string' && screen.projection.length > 0, `${screen.ui_id}: projection required`);
  assert(Array.isArray(screen.named_actions) && screen.named_actions.length > 0, `${screen.ui_id}: named_actions required`);
  assert(Array.isArray(screen.ai_use_cases), `${screen.ui_id}: ai_use_cases required`);
  assert(Array.isArray(screen.skills), `${screen.ui_id}: skills required`);

  if (screen.ai_use_cases.length > 0) {
    assert(screen.ai_control_plane === 'FAMILY_LLM_GATEWAY', `${screen.ui_id}: AI must use FAMILY_LLM_GATEWAY`);
  } else {
    assert(screen.ai_control_plane === 'NONE', `${screen.ui_id}: empty AI use cases must use NONE`);
  }

  const route = path.join(root, screen.frontend_route.replace(/^50_开发_dev\//, ''));
  assert(fs.existsSync(route), `${screen.ui_id}: frontend route missing: ${screen.frontend_route}`);
}

assert(fs.existsSync(mobileRegistryPath), 'mobile ui-registry.ts missing');
if (fs.existsSync(mobileRegistryPath)) {
  const registry = read(mobileRegistryPath);
  const registryIds = [...new Set([...registry.matchAll(/id:\s*"(UI-\d{2})"/g)].map((m) => m[1]))];
  assert(registryIds.length === 35, `mobile ui-registry must contain 35 unique IDs, got ${registryIds.length}`);
  assert(expected.every((id) => registryIds.includes(id)), 'mobile ui-registry is not aligned to UI-01..UI-35');
}

assert(fs.existsSync(mobileDesignPath), 'mobile design.md missing');
if (fs.existsSync(mobileDesignPath)) {
  const design = read(mobileDesignPath);
  const missing = expected.filter((id) => !design.includes(id));
  assert(missing.length === 0, `mobile design.md missing: ${missing.join(', ')}`);
}

const diagnosis = matrix.screens.find((s) => s.ui_id === 'UI-03');
assert(Boolean(diagnosis?.ai_use_cases?.includes('AI_DIAGNOSIS')), 'UI-03 must retain AI_DIAGNOSIS capability');
assert(matrix.principles?.ai_diagnosis?.keep === true, 'matrix must keep AI诊断');

if (fs.existsSync(mobileLlmPath)) {
  const llm = read(mobileLlmPath);
  const directProvider = /forge\.manus\.im|\/v1\/chat\/completions/.test(llm);
  if (directProvider) {
    const message = 'mobile contains a direct model-provider path; converge to backend FAMILY_LLM_GATEWAY';
    strictRuntime ? errors.push(message) : warnings.push(message);
  }
}

if (fs.existsSync(mobileDbPath) && fs.existsSync(mobilePackagePath)) {
  const mobilePackage = read(mobilePackagePath);
  const secondDb = /mysql2/.test(mobilePackage);
  if (secondDb) {
    const message = 'mobile contains a MySQL-backed server path; canonical domain backend must remain apps/api + PostgreSQL';
    strictRuntime ? errors.push(message) : warnings.push(message);
  }
}

const domainCounts = {};
for (const s of matrix.screens) domainCounts[s.primary_domain] = (domainCounts[s.primary_domain] || 0) + 1;

console.log('FAMILY_35UI_ALIGNMENT');
console.log(`screens=${ids.length}`);
console.log(`strict_runtime=${strictRuntime ? 'YES' : 'NO'}`);
console.log(`domains=${JSON.stringify(domainCounts)}`);
console.log(`warnings=${warnings.length}`);
for (const w of warnings) console.warn(`WARN: ${w}`);

finish();

function finish() {
  if (errors.length) {
    console.error(`FAIL: ${errors.length} alignment error(s)`);
    for (const e of errors) console.error(`- ${e}`);
    process.exit(1);
  }
  console.log('PASS: structural 35-UI alignment');
  process.exit(0);
}
