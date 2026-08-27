#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadDotEnv,
  readFamilyModelLiveConfig,
  redactedFamilyModelLiveConfig,
  validateFamilyModelLiveConfig,
} from './family-model-live-config.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const sprintPath = join(root, 'CURRENT_SPRINT.md');
const envPath = join(root, '.env');

function readSprintAuthorization() {
  const text = readFileSync(sprintPath, 'utf8');
  const liveExternalAi = /LIVE_EXTERNAL_AI\s*=\s*AUTHORIZED/.test(text) ? 'AUTHORIZED' : 'NOT_AUTHORIZED';
  return { liveExternalAi };
}

const fileEnv = loadDotEnv(envPath);
const mergedEnv = { ...fileEnv, ...process.env };
const authorization = readSprintAuthorization();
const config = readFamilyModelLiveConfig(mergedEnv);
const checks = [];

function check(name, pass, detail) {
  checks.push({ name, pass, detail });
}

check('mode_supported', ['mock', 'cc-switch'].includes(config.mode), `mode=${config.mode}`);
check('timeout_valid', Number.isFinite(config.timeoutMs) && config.timeoutMs > 0 && config.timeoutMs <= 120000, `timeoutMs=${config.timeoutMs}`);

if (config.mode === 'mock') {
  check('live_disabled_in_mock', !config.allowLiveExternalAi, `FAMILY_MODEL_ALLOW_LIVE_EXTERNAL_AI=${config.allowLiveExternalAi}`);
} else {
  const failures = validateFamilyModelLiveConfig(config, { liveAuthorized: authorization.liveExternalAi === 'AUTHORIZED' });
  check('provider_selected', !!config.providerId, `providerId=${config.providerId}`);
  check('live_config_valid', failures.length === 0, failures.length ? failures.join('; ') : JSON.stringify(redactedFamilyModelLiveConfig(config)));
}

console.log('=== Family Model Gateway Config Validation ===');
console.log(`env_file: ${existsSync(envPath) ? '.env loaded' : '.env not found'}`);
console.log(`provider_id: ${config.providerId}`);
console.log(`sprint_live_external_ai: ${authorization.liveExternalAi}`);
for (const item of checks) {
  console.log(`${item.pass ? 'PASS' : 'FAIL'} ${item.name}: ${item.detail}`);
}

const failures = checks.filter((item) => !item.pass);
if (failures.length > 0) {
  console.error(`\nGateway config validation failed: ${failures.length}`);
  process.exit(1);
}

console.log('\nGateway config validation passed. No external API call was made.');