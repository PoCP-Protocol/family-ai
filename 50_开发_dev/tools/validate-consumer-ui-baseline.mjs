#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const strictRuntime = process.argv.includes('--strict-runtime');
const matrixPath = path.join(root, 'governance', 'FAMILY_CONSUMER_UI_BASELINE_V1.json');
const invariantsPath = path.join(root, 'governance', 'FAMILY_ARCHITECTURE_INVARIANTS_V4_1.json');
const mobileRuntimeBoundaryPath = path.join(root, 'governance', 'FAMILY_MOBILE_RUNTIME_BOUNDARY_V1.json');
const mobileRegistryPath = path.join(root, 'apps', 'mobile', 'lib', 'family', 'ui-registry.ts');
const mobileDesignPath = path.join(root, 'apps', 'mobile', 'design.md');
const mobileBoundaryDocPath = path.join(root, 'apps', 'mobile', 'CROSS_PLATFORM_APP_WEB.md');
const mobileFamilyApiClientPath = path.join(root, 'apps', 'mobile', 'lib', 'family', 'family-api-client.ts');
const familyModelGatewayProviderPath = path.join(root, 'apps', 'api', 'src', 'modules', 'family', 'family-model-gateway.provider.ts');
const mobileServerRoot = path.join(root, 'apps', 'mobile', 'server');
const mobilePackagePath = path.join(root, 'apps', 'mobile', 'package.json');
const rootPackagePath = path.join(root, 'package.json');

const errors = [];
const warnings = [];
const assert = (condition, message) => { if (!condition) errors.push(message); };
const read = (p) => fs.readFileSync(p, 'utf8');

for (const p of [matrixPath, invariantsPath]) assert(fs.existsSync(p), `missing ${p}`);
if (errors.length) finish();

const matrix = JSON.parse(read(matrixPath));
const invariants = JSON.parse(read(invariantsPath));
const mobileRuntimeBoundary = fs.existsSync(mobileRuntimeBoundaryPath) ? JSON.parse(read(mobileRuntimeBoundaryPath)) : null;
const expected = Array.from({ length: 34 }, (_, i) => `UI-${String(i + 1).padStart(2, '0')}`);
const ids = matrix.screens.map((s) => s.ui_id);
const unique = [...new Set(ids)];

assert(ids.length === 34, `matrix must contain 34 baseline screens, got ${ids.length}`);
assert(unique.length === 34, 'matrix contains duplicate UI ids');
assert(expected.every((id) => unique.includes(id)), 'matrix must contain exactly UI-01..UI-34');
assert(!unique.includes('UI-35'), 'UI-35 is deleted and must not appear in the baseline matrix');

const validDomains = new Set(invariants.canonical_business_domains);
const validLoops = new Set(invariants.canonical_business_loops);
const validPlatforms = new Set(invariants.cross_domain_platforms);

for (const screen of matrix.screens) {
  assert(validDomains.has(screen.primary_domain), `${screen.ui_id}: invalid primary_domain`);
  assert(validLoops.has(screen.loop), `${screen.ui_id}: invalid loop`);
  assert(typeof screen.projection === 'string' && screen.projection.length > 0, `${screen.ui_id}: projection required`);
  assert(Array.isArray(screen.named_actions) && screen.named_actions.length > 0, `${screen.ui_id}: named_actions required`);
  assert(Array.isArray(screen.ai_use_cases), `${screen.ui_id}: ai_use_cases required`);
  assert(Array.isArray(screen.skills), `${screen.ui_id}: skills required`);
  assert(Array.isArray(screen.platform_dependencies), `${screen.ui_id}: platform_dependencies required`);
  for (const domain of screen.supporting_domains ?? []) assert(validDomains.has(domain), `${screen.ui_id}: invalid supporting domain ${domain}`);
  for (const platform of screen.platform_dependencies ?? []) assert(validPlatforms.has(platform), `${screen.ui_id}: invalid platform dependency ${platform}`);

  if (screen.ai_use_cases.length > 0) {
    assert(screen.target_ai_control_plane === 'FAMILY_AI_CONTROL_PLANE', `${screen.ui_id}: target AI control plane must be FAMILY_AI_CONTROL_PLANE`);
    assert(['FAMILY_LLM_GATEWAY','NONE'].includes(screen.runtime_ai_adapter), `${screen.ui_id}: invalid runtime_ai_adapter`);
  } else {
    assert(screen.target_ai_control_plane === 'NONE', `${screen.ui_id}: empty AI use cases must target NONE`);
  }

  const route = path.join(root, screen.frontend_route.replace(/^50_开发_dev\//, ''));
  assert(fs.existsSync(route), `${screen.ui_id}: frontend route missing: ${screen.frontend_route}`);
}

assert(fs.existsSync(mobileRegistryPath), 'mobile ui-registry.ts missing');
if (fs.existsSync(mobileRegistryPath)) {
  const registry = read(mobileRegistryPath);
  const registryIds = [...new Set([...registry.matchAll(/id:\s*"(UI-\d{2})"/g)].map((m) => m[1]))];
  assert(expected.every((id) => registryIds.includes(id)), 'mobile ui-registry is not aligned to UI-01..UI-34');
  assert(!registryIds.includes('UI-35'), 'mobile ui-registry must not register deleted UI-35');
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

const hasMobileRuntimeBoundary = Boolean(
  mobileRuntimeBoundary?.schema_version === 'FAMILY_MOBILE_RUNTIME_BOUNDARY_V1'
  && mobileRuntimeBoundary?.dev_test_real_external_ai?.status === 'ALLOWED_VIA_FAMILY_API_MODEL_GATEWAY_ONLY'
  && mobileRuntimeBoundary?.dev_test_real_external_ai?.required_live_flag === 'FAMILY_MODEL_ALLOW_LIVE_EXTERNAL_AI'
  && mobileRuntimeBoundary?.mobile_template_runtime?.status === 'QUARANTINED_TEMPLATE_COMPATIBILITY_RUNTIME'
  && Array.isArray(mobileRuntimeBoundary?.production_forbidden)
  && mobileRuntimeBoundary.production_forbidden.includes('NO_CLIENT_DIRECT_MODEL_CALL')
  && mobileRuntimeBoundary.production_forbidden.includes('NO_SECOND_BUSINESS_BACKEND')
  && mobileRuntimeBoundary.production_forbidden.includes('NO_SECOND_CANONICAL_DB')
);

function assertMobileRuntimeBoundary() {
  assert(hasMobileRuntimeBoundary, 'strict runtime requires FAMILY_MOBILE_RUNTIME_BOUNDARY_V1 with dev/test live API allowed via Family API Model Gateway only');
  assert(fs.existsSync(familyModelGatewayProviderPath), 'Family Model Gateway provider missing');
  if (fs.existsSync(familyModelGatewayProviderPath)) {
    const provider = read(familyModelGatewayProviderPath);
    assert(provider.includes('createFamilyModelGatewayFromEnv'), 'Family Model Gateway provider must use createFamilyModelGatewayFromEnv');
    assert(provider.includes('FAMILY_MODEL_ALLOW_LIVE_EXTERNAL_AI'), 'Family Model Gateway provider must gate live AI with FAMILY_MODEL_ALLOW_LIVE_EXTERNAL_AI');
  }
  assert(fs.existsSync(mobileBoundaryDocPath), 'mobile runtime boundary doc missing');
  if (fs.existsSync(mobileBoundaryDocPath)) {
    const doc = read(mobileBoundaryDocPath);
    for (const marker of mobileRuntimeBoundary?.required_client_boundary_text ?? []) {
      assert(doc.includes(marker), `mobile boundary doc missing marker: ${marker}`);
    }
  }
  assert(fs.existsSync(mobileFamilyApiClientPath), 'FamilyApiClient missing');
  if (fs.existsSync(mobileFamilyApiClientPath)) {
    const apiClient = read(mobileFamilyApiClientPath);
    for (const marker of mobileRuntimeBoundary?.required_family_api_client_paths ?? []) {
      assert(apiClient.includes(marker), `FamilyApiClient missing canonical path marker: ${marker}`);
    }
  }
  for (const relativeRoot of mobileRuntimeBoundary?.dev_test_real_external_ai?.forbidden_client_secret_paths ?? []) {
    const forbiddenRoot = path.join(root, relativeRoot);
    for (const file of collectTextFiles(forbiddenRoot)) {
      const text = read(file);
      assert(!/OPENAI_API_KEY|ANTHROPIC_AUTH_TOKEN|FAMILY_LLM_API_KEY|ZHIPUAI_API_KEY/.test(text), `client/mobile code must not read provider API keys: ${path.relative(root, file)}`);
    }
  }
}

function collectTextFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectTextFiles(p));
    else if (/\.(ts|tsx|js|mjs|cjs)$/.test(entry.name)) out.push(p);
  }
  return out;
}

const directProviderHits = [];
for (const file of collectTextFiles(mobileServerRoot)) {
  const text = read(file);
  if (/forge\.manus\.im|\/v1\/chat\/completions|OPENAI_API_KEY|forgeApiKey/.test(text)) directProviderHits.push(path.relative(root, file));
}
if (directProviderHits.length > 0) {
  const message = `mobile direct model-provider paths remain: ${directProviderHits.join(', ')}`;
  if (strictRuntime && !hasMobileRuntimeBoundary) errors.push(message);
  else warnings.push(`${message} [QUARANTINED_TEMPLATE_COMPATIBILITY_RUNTIME]`);
}

if (fs.existsSync(mobilePackagePath)) {
  const mobilePackage = JSON.parse(read(mobilePackagePath));
  const deps = { ...(mobilePackage.dependencies ?? {}), ...(mobilePackage.devDependencies ?? {}) };
  if (deps.mysql2 || deps['drizzle-orm']) {
    const message = 'mobile second DB/identity dependencies remain (mysql2/drizzle)';
    if (strictRuntime && !hasMobileRuntimeBoundary) errors.push(message);
    else warnings.push(`${message} [QUARANTINED_TEMPLATE_COMPATIBILITY_RUNTIME]`);
  }
  if (deps.express || deps['@trpc/server'] || mobilePackage.scripts?.['dev:server']) {
    const message = 'mobile second server runtime remains (Express/tRPC/dev:server)';
    if (strictRuntime && !hasMobileRuntimeBoundary) errors.push(message);
    else warnings.push(`${message} [QUARANTINED_TEMPLATE_COMPATIBILITY_RUNTIME]`);
  }
  if (fs.existsSync(rootPackagePath)) {
    const rootPackage = JSON.parse(read(rootPackagePath));
    if (mobilePackage.packageManager && rootPackage.packageManager && mobilePackage.packageManager !== rootPackage.packageManager) {
      const message = `package manager drift: mobile=${mobilePackage.packageManager}, root=${rootPackage.packageManager}`;
      strictRuntime ? errors.push(message) : warnings.push(message);
    }
  }
}

if (strictRuntime) assertMobileRuntimeBoundary();

const domainCounts = {};
for (const s of matrix.screens) domainCounts[s.primary_domain] = (domainCounts[s.primary_domain] || 0) + 1;
console.log('FAMILY_CONSUMER_UI_BASELINE_GATE_V1');
console.log(`screens=${ids.length}`);
console.log(`strict_runtime=${strictRuntime ? 'YES' : 'NO'}`);
console.log(`domains=${JSON.stringify(domainCounts)}`);
console.log(`warnings=${warnings.length}`);
for (const warning of warnings) console.warn(`WARN: ${warning}`);
finish();

function finish() {
  if (errors.length) {
    console.error(`FAIL: ${errors.length} alignment error(s)`);
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log('PASS: structural consumer UI baseline alignment');
}
