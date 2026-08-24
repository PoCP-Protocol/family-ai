#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const errors = [];
const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const assert = (condition, message) => { if (!condition) errors.push(message); };

const registryPath = path.join(root, 'governance', 'FAMILY_SUBTRACTIVE_FREEZE_V1.json');
const packagePath = path.join(root, 'package.json');

assert(fs.existsSync(registryPath), `missing subtractive freeze registry: ${registryPath}`);
assert(fs.existsSync(packagePath), `missing package.json: ${packagePath}`);
if (errors.length) finish();

const registry = readJson(registryPath);
const packageJson = readJson(packagePath);
const scripts = packageJson.scripts ?? {};
const scriptNames = Object.keys(scripts);

assert(registry.schema_version === 'FAMILY_SUBTRACTIVE_FREEZE_V1', 'wrong subtractive freeze schema_version');
assert(registry.architecture_id === 'FAMILY_AI_PLATFORM_V4_1', 'subtractive freeze must bind to FAMILY_AI_PLATFORM_V4_1');
assert(registry.status === 'ACTIVE', 'subtractive freeze registry must be ACTIVE');

const allowed = new Set(registry.allowed_runtime_entrypoints ?? []);
const frozen = new Set((registry.frozen_root_scripts ?? []).map((entry) => entry.name));
const forbiddenScripts = new Set(registry.forbidden_root_scripts ?? []);
const forbiddenPrefixes = registry.forbidden_root_script_prefixes ?? [];

for (const name of scriptNames) {
  assert(allowed.has(name), `root script is not in the subtractive main-flow allowlist: ${name}`);
  assert(!frozen.has(name), `frozen root script is still exposed: ${name}`);
  assert(!forbiddenScripts.has(name), `forbidden root script is still exposed: ${name}`);
  for (const prefix of forbiddenPrefixes) {
    assert(!name.startsWith(prefix), `forbidden root script prefix is still exposed: ${name}`);
  }
}

for (const entry of registry.frozen_root_scripts ?? []) {
  assert(entry.status === 'REMOVED_FROM_ROOT_ENTRYPOINTS', `${entry.name}: frozen script status must be REMOVED_FROM_ROOT_ENTRYPOINTS`);
  assert(typeof entry.reason === 'string' && entry.reason.length > 20, `${entry.name}: freeze reason is required`);
}

for (const candidate of registry.deletion_candidates ?? []) {
  assert(candidate.status === 'DELETE_CANDIDATE_REQUIRES_REVIEW', `${candidate.path}: deletion candidate must require review`);
  assert(typeof candidate.reason === 'string' && candidate.reason.length > 20, `${candidate.path}: deletion reason is required`);
}

console.log('FAMILY_SUBTRACTIVE_FREEZE_GATE_V1');
console.log(`root_scripts=${scriptNames.length}`);
console.log(`frozen_root_scripts=${frozen.size}`);
console.log(`deletion_candidates=${registry.deletion_candidates?.length ?? 0}`);
finish();

function finish() {
  if (errors.length) {
    console.error(`FAIL: ${errors.length} subtractive freeze error(s)`);
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log('PASS: subtractive freeze guard');
}
