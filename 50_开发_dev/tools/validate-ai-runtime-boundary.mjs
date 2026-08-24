#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const errors = [];
const warnings = [];
const assert = (condition, message) => { if (!condition) errors.push(message); };
const read = (filePath) => fs.readFileSync(filePath, 'utf8');
const readJson = (filePath) => JSON.parse(read(filePath));

const boundaryPath = path.join(root, 'governance', 'FAMILY_AI_RUNTIME_BOUNDARY_V1.json');
const mobileBoundaryPath = path.join(root, 'governance', 'FAMILY_MOBILE_RUNTIME_BOUNDARY_V1.json');
const packagePath = path.join(root, 'package.json');

for (const filePath of [boundaryPath, mobileBoundaryPath, packagePath]) {
  assert(fs.existsSync(filePath), `missing required AI runtime boundary artifact: ${filePath}`);
}
if (errors.length) finish();

const boundary = readJson(boundaryPath);
const mobileBoundary = readJson(mobileBoundaryPath);
const packageJson = readJson(packagePath);

assert(boundary.schema_version === 'FAMILY_AI_RUNTIME_BOUNDARY_V1', 'wrong AI runtime boundary schema_version');
assert(boundary.architecture_id === 'FAMILY_AI_PLATFORM_V4_1', 'AI runtime boundary must bind to FAMILY_AI_PLATFORM_V4_1');
assert(boundary.status === 'ACTIVE', 'AI runtime boundary must be ACTIVE');
assert(boundary.allowed_live_external_ai?.status === 'FAMILY_API_MODEL_GATEWAY_ONLY', 'live external AI must be Family API Model Gateway only');
assert(boundary.allowed_live_external_ai?.required_live_flag === 'FAMILY_MODEL_ALLOW_LIVE_EXTERNAL_AI', 'live external AI must be gated by FAMILY_MODEL_ALLOW_LIVE_EXTERNAL_AI');
assert(boundary.allowed_live_external_ai?.provider_path === 'apps/api/src/modules/family/family-model-gateway.provider.ts', 'live external AI provider path drift');
assert(mobileBoundary.dev_test_real_external_ai?.status === 'ALLOWED_VIA_FAMILY_API_MODEL_GATEWAY_ONLY', 'mobile runtime boundary must allow live AI only via Family API Model Gateway');

const providerPath = path.join(root, boundary.allowed_live_external_ai?.provider_path ?? '');
assert(fs.existsSync(providerPath), `Family API Model Gateway provider missing: ${providerPath}`);
if (fs.existsSync(providerPath)) {
  const provider = read(providerPath);
  for (const marker of boundary.allowed_live_external_ai?.required_markers ?? []) {
    assert(provider.includes(marker), `Family API Model Gateway provider missing marker: ${marker}`);
  }
}

const forbiddenKeyPattern = new RegExp(boundary.forbidden_provider_secret_patterns.join('|'));
for (const relativeRoot of boundary.forbidden_client_secret_roots ?? []) {
  for (const filePath of collectTextFiles(path.join(root, relativeRoot))) {
    assert(!forbiddenKeyPattern.test(read(filePath)), `client code must not read provider secret: ${path.relative(root, filePath)}`);
  }
}

const allowedQuarantineRoots = new Set(boundary.quarantined_template_runtime?.allowed_roots ?? []);
const quarantinedDirectProviderFiles = new Set(boundary.quarantined_template_runtime?.direct_provider_files ?? []);
for (const relativeFile of quarantinedDirectProviderFiles) {
  const filePath = path.join(root, relativeFile);
  assert(fs.existsSync(filePath), `declared quarantined direct-provider file missing: ${relativeFile}`);
}

const directProviderPattern = /forge\.manus\.im|\/v1\/chat\/completions|\/v1\/models|BUILT_IN_FORGE_API_KEY|OPENAI_API_KEY|authorization:\s*`Bearer \$\{ENV\.forgeApiKey\}`/;
const mobileRoot = path.join(root, 'apps', 'mobile');
for (const filePath of collectTextFiles(mobileRoot)) {
  const relativeFile = normalize(path.relative(root, filePath));
  if (!directProviderPattern.test(read(filePath))) continue;

  const isQuarantinedRoot = [...allowedQuarantineRoots].some((relativeRoot) => relativeFile.startsWith(`${relativeRoot}/`));
  assert(isQuarantinedRoot, `direct provider marker outside quarantined template runtime: ${relativeFile}`);
  if (isQuarantinedRoot && !quarantinedDirectProviderFiles.has(relativeFile)) {
    warnings.push(`direct provider marker remains in quarantined template runtime: ${relativeFile}`);
  }
}

for (const relativeRoot of boundary.forbidden_main_flow_import_roots ?? []) {
  for (const filePath of collectTextFiles(path.join(root, relativeRoot))) {
    const relativeFile = normalize(path.relative(root, filePath));
    const text = read(filePath);
    for (const forbiddenImport of boundary.forbidden_main_flow_imports ?? []) {
      assert(!text.includes(forbiddenImport), `main-flow code imports quarantined runtime ${forbiddenImport}: ${relativeFile}`);
    }
  }
}

const requiredScript = boundary.required_root_script;
assert(packageJson.scripts?.[requiredScript] === 'node tools/validate-ai-runtime-boundary.mjs', `package.json missing ${requiredScript} script`);

console.log('FAMILY_AI_RUNTIME_BOUNDARY_GATE_V1');
console.log(`quarantined_direct_provider_files=${quarantinedDirectProviderFiles.size}`);
console.log(`warnings=${warnings.length}`);
for (const warning of warnings) console.warn(`WARN: ${warning}`);
finish();

function collectTextFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const filePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', 'dist-web', '.expo'].includes(entry.name)) continue;
      files.push(...collectTextFiles(filePath));
    } else if (/\.(ts|tsx|js|mjs|cjs)$/.test(entry.name)) {
      files.push(filePath);
    }
  }
  return files;
}

function normalize(value) {
  return value.split(path.sep).join('/');
}

function finish() {
  if (errors.length) {
    console.error(`FAIL: ${errors.length} AI runtime boundary error(s)`);
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log('PASS: AI runtime boundary guard');
}