#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import {
  loadDotEnv,
  readFamilyModelLiveConfig,
  redactedFamilyModelLiveConfig,
  validateFamilyModelLiveConfig,
} from './family-model-live-config.mjs';

const require = createRequire(import.meta.url);
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(rootDir, '.env');
const reportDir = path.join(rootDir, 'reports', 'multi-api-distillation');

const { RoutingAiGateway, AiGatewayError, AnthropicAiGateway, OpenAICompatibleAiGateway } = require(path.join(rootDir, 'packages/ai-gateway/dist/index.js'));

function argValue(name) {
  const prefix = `${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function writeReport(report) {
  fs.mkdirSync(reportDir, { recursive: true });
  const latestPath = path.join(reportDir, 'multi-api-distillation-run.latest.json');
  const text = `${JSON.stringify(report, null, 2)}\n`;
  fs.writeFileSync(latestPath, text, 'utf8');
  return { latestPath };
}

function pushUnique(items, item) {
  if (item && !items.includes(item)) items.push(item);
}

const fileEnv = loadDotEnv(envPath);
const env = { ...fileEnv, ...process.env };
const liveAuthorized = process.argv.includes('--live-authorized') || env.FAMILY_MODEL_LIVE_AUTHORIZED === 'true';
const primaryConfig = readFamilyModelLiveConfig(env);
const primaryFailures = validateFamilyModelLiveConfig(primaryConfig, { liveAuthorized });

function routeFromIndex(index) {
  const prefix = `FAMILY_MODEL_MULTI_API_ROUTE_${index}`;
  const providerId = env[`${prefix}_PROVIDER_ID`]?.trim();
  const kind = env[`${prefix}_KIND`]?.trim() || 'openai-compatible';
  const baseUrl = env[`${prefix}_BASE_URL`]?.trim();
  const apiKey = env[`${prefix}_API_KEY`]?.trim();
  const model = env[`${prefix}_MODEL`]?.trim();
  const timeoutMs = Number(env[`${prefix}_TIMEOUT_MS`] ?? primaryConfig.timeoutMs ?? 30000);
  if (!providerId && !baseUrl && !apiKey && !model) return null;
  return { providerId: providerId ?? `family-model-route-${index}`, kind, baseUrl, apiKey, model, timeoutMs };
}

const indexedRoutes = [1, 2, 3, 4, 5].map(routeFromIndex).filter(Boolean);
const routes = indexedRoutes.length > 0
  ? indexedRoutes
  : [{
      providerId: primaryConfig.providerId,
      kind: 'openai-compatible',
      baseUrl: primaryConfig.baseUrl,
      apiKey: primaryConfig.apiKey,
      model: primaryConfig.model,
      timeoutMs: primaryConfig.timeoutMs,
    }];

const failures = [];
if (indexedRoutes.length === 0) {
  for (const failure of primaryFailures) pushUnique(failures, failure);
} else {
  if (!liveAuthorized) pushUnique(failures, 'live authorization is required for this run');
  if (env.FAMILY_MODEL_ALLOW_LIVE_EXTERNAL_AI !== 'true') pushUnique(failures, 'FAMILY_MODEL_ALLOW_LIVE_EXTERNAL_AI must be true');
}
for (const route of routes) {
  if (!['openai-compatible', 'anthropic-compatible'].includes(route.kind)) pushUnique(failures, `${route.providerId} kind must be openai-compatible or anthropic-compatible`);
  if (!route.baseUrl) pushUnique(failures, `${route.providerId} base URL is required`);
  if (!route.apiKey) pushUnique(failures, `${route.providerId} API key is required`);
  if (!route.model) pushUnique(failures, `${route.providerId} model is required`);
  if (!Number.isFinite(route.timeoutMs) || route.timeoutMs <= 0 || route.timeoutMs > 120000) pushUnique(failures, `${route.providerId} timeout must be 1..120000 ms`);
}

console.log('=== Family Multi-API Distillation ===');
console.log(`env_file: ${fs.existsSync(envPath) ? '.env loaded' : '.env not found'}`);
console.log(`live_authorized_for_this_run: ${liveAuthorized}`);
console.log(`route_count: ${routes.length}`);
for (const route of routes) {
  console.log(`route: ${route.providerId} kind=${route.kind} base_url=${route.baseUrl ? '<SET>' : '<MISSING>'} api_key=${route.apiKey ? '<SET>' : '<MISSING>'} model=${route.model ?? '<MISSING>'}`);
}

if (failures.length) {
  const report = {
    asset_ref: 'FAMILY_MULTI_API_DISTILLATION_RUN_REPORT',
    status: 'CONFIG_FAILED_FAIL_CLOSED',
    generated_at: new Date().toISOString(),
    mode: 'multi_api_gateway_distillation',
    live_authorized_for_this_run: liveAuthorized,
    primary_config: redactedFamilyModelLiveConfig(primaryConfig),
    routes: routes.map((route) => ({
      provider_id: route.providerId,
      kind: route.kind,
      base_url: route.baseUrl ? '<SET>' : '<MISSING>',
      api_key: route.apiKey ? '<SET>' : '<MISSING>',
      model: route.model ?? '<MISSING>',
      timeout_ms: route.timeoutMs,
    })),
    failures,
    external_ai_invoked: false,
    database_schema_change: 'NOT_TOUCHED',
    production_training_authorized: false,
  };
  const { latestPath } = writeReport(report);
  for (const failure of failures) console.error(`FAIL config: ${failure}`);
  console.error(`WROTE ${path.relative(rootDir, latestPath).replace(/\\/g, '/')}`);
  process.exit(1);
}

const gateways = routes.map((cfg) => {
  return cfg.kind === 'openai-compatible'
    ? new OpenAICompatibleAiGateway(cfg)
    : new AnthropicAiGateway(cfg);
});

const gateway = routes.length > 1 ? new RoutingAiGateway(gateways) : gateways[0];

try {
  const request = {
    use_case: 'multi-api-distillation',
    prompt_version: 'v1',
    schema_version: 'v1',
    input: { batchId: argValue('--batch-id') ?? 'test-batch', includeDetails: true },
    output_schema: {},
    input_refs: ['family-220k-review'],
    policy_context: {
      human_confirmation_required: true,
      may_mutate_business_state: false,
    },
  };

  const startedAt = Date.now();
  const result = await gateway.generateStructured(request);
  const report = {
    asset_ref: 'FAMILY_MULTI_API_DISTILLATION_RUN_REPORT',
    status: 'PASS',
    generated_at: new Date().toISOString(),
    latency_ms: Date.now() - startedAt,
    gateway_type: routes.length > 1 ? 'routing' : routes[0]?.kind,
    gateway_config: routes.map((cfg) => ({ provider_id: cfg.providerId, kind: cfg.kind, model: cfg.model, base_url: '<SET>' })),
    external_ai_invoked: true,
    database_schema_change: 'NOT_TOUCHED',
    core_ontology_write_authorized: false,
    production_training_authorized: false,
    output_use: 'review_only_candidate_generation',
    result,
  };
  const { latestPath } = writeReport(report);
  console.log('PASS multi-api-distillation-run:', JSON.stringify(result.output, null, 2));
  console.log(`WROTE ${latestPath}`);
} catch (e) {
  const failure = e instanceof AiGatewayError ? `${e.kind}: ${e.message}` : (e instanceof Error ? e.message : String(e));
  console.error('FAIL multi-api-distillation-run:', failure);
  process.exit(1);
}