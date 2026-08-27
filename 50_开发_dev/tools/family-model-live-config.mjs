import fs from 'node:fs';

export function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const entries = {};
  for (const rawLine of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const normalized = line.startsWith('export ') ? line.slice('export '.length).trim() : line;
    const separator = normalized.indexOf('=');
    if (separator <= 0) continue;
    const key = normalized.slice(0, separator).trim();
    let value = normalized.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    entries[key] = value;
  }
  return entries;
}

export function pickFirstEnv(env, names) {
  for (const name of names) {
    const value = env[name]?.trim();
    if (value) return value;
  }
  return undefined;
}

export function familyModelProviderIdFor(env) {
  const explicit = env.FAMILY_MODEL_CC_SWITCH_PROVIDER_ID?.trim();
  if (explicit) return explicit;
  const kind = env.FAMILY_MODEL_CC_SWITCH_API_KIND?.trim().toLowerCase();
  if (kind === 'codex') return 'codex-cc-switch';
  if (env.FAMILY_MODEL_CODEX_BASE_URL || env.FAMILY_MODEL_CODEX_API_KEY || env.FAMILY_MODEL_CODEX_MODEL || env.CODEX_API_KEY) {
    return 'codex-cc-switch';
  }
  return 'anthropic-cc-switch';
}

export function readFamilyModelLiveConfig(env) {
  return {
    mode: env.FAMILY_MODEL_GATEWAY_MODE?.trim() ?? 'mock',
    allowLiveExternalAi: env.FAMILY_MODEL_ALLOW_LIVE_EXTERNAL_AI?.trim() === 'true',
    providerId: familyModelProviderIdFor(env),
    baseUrl: pickFirstEnv(env, ['FAMILY_MODEL_CODEX_BASE_URL', 'CODEX_API_BASE_URL', 'FAMILY_MODEL_CC_SWITCH_BASE_URL', 'FPAI_MODEL_BASE_URL']),
    apiKey: pickFirstEnv(env, ['FAMILY_MODEL_CODEX_API_KEY', 'CODEX_API_KEY', 'FAMILY_MODEL_CC_SWITCH_API_KEY', 'FPAI_MODEL_API_KEY']),
    model: pickFirstEnv(env, ['FAMILY_MODEL_CODEX_MODEL', 'CODEX_MODEL', 'FAMILY_MODEL_CC_SWITCH_MODEL', 'FPAI_MODEL_NAME']),
    timeoutMs: Number(env.FAMILY_MODEL_CC_SWITCH_TIMEOUT_MS ?? env.FPAI_MODEL_TIMEOUT_MS ?? 30000),
  };
}

export function validateFamilyModelLiveConfig(config, options = {}) {
  const failures = [];
  if (config.mode !== 'cc-switch') failures.push('FAMILY_MODEL_GATEWAY_MODE must be cc-switch');
  if (config.allowLiveExternalAi !== true) failures.push('FAMILY_MODEL_ALLOW_LIVE_EXTERNAL_AI must be true');
  if (options.liveAuthorized !== true) failures.push('live authorization is required for this run');
  if (!config.baseUrl) failures.push('FAMILY_MODEL_CODEX_BASE_URL/CODEX_API_BASE_URL or FAMILY_MODEL_CC_SWITCH_BASE_URL is required');
  if (config.baseUrl && !config.baseUrl.replace(/\/$/, '').endsWith('/v1')) failures.push('cc switch Codex/OpenAI-compatible base URL must end with /v1');
  if (!config.apiKey) failures.push('FAMILY_MODEL_CODEX_API_KEY/CODEX_API_KEY or FAMILY_MODEL_CC_SWITCH_API_KEY is required');
  if (!config.model) failures.push('FAMILY_MODEL_CODEX_MODEL/CODEX_MODEL or FAMILY_MODEL_CC_SWITCH_MODEL is required');
  if (!Number.isFinite(config.timeoutMs) || config.timeoutMs <= 0 || config.timeoutMs > 120000) failures.push('timeout must be 1..120000 ms');
  return failures;
}

export function redactedFamilyModelLiveConfig(config) {
  return {
    mode: config.mode,
    allowLiveExternalAi: config.allowLiveExternalAi,
    providerId: config.providerId,
    baseUrl: config.baseUrl ? '<SET>' : '<MISSING>',
    apiKey: config.apiKey ? '<SET>' : '<MISSING>',
    model: config.model ?? '<MISSING>',
    timeoutMs: config.timeoutMs,
  };
}