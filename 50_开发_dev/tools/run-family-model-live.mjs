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
const reportDir = path.join(rootDir, 'reports', 'model-live');

const {
  AiGatewayError,
  createFamilyModelGatewayFromEnv,
} = require(path.join(rootDir, 'packages/ai-gateway/dist/index.js'));
const { FamilyEducationModelRuntime } = require(path.join(rootDir, 'packages/family-model/dist/index.js'));

function argValue(name) {
  const prefix = `${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function loadInput(defaultInput) {
  const inputJson = argValue('--input-json');
  if (!inputJson) return defaultInput;
  const inputPath = path.resolve(process.cwd(), inputJson);
  return JSON.parse(fs.readFileSync(inputPath, 'utf8'));
}

function writeReport(report) {
  fs.mkdirSync(reportDir, { recursive: true });
  const latestPath = path.join(reportDir, 'family-model-live-run.latest.json');
  const timestampPath = path.join(reportDir, `family-model-live-run.${report.generated_at.replace(/[:.]/g, '-')}.json`);
  const text = `${JSON.stringify(report, null, 2)}\n`;
  fs.writeFileSync(latestPath, text, 'utf8');
  fs.writeFileSync(timestampPath, text, 'utf8');
  return { latestPath, timestampPath };
}

const fileEnv = loadDotEnv(envPath);
const env = { ...fileEnv, ...process.env };
const liveAuthorized = process.argv.includes('--live-authorized') || env.FAMILY_MODEL_LIVE_AUTHORIZED === 'true';
const config = readFamilyModelLiveConfig(env);
const failures = validateFamilyModelLiveConfig(config, { liveAuthorized });

console.log('=== Family Model Live Run ===');
console.log(`env_file: ${fs.existsSync(envPath) ? '.env loaded' : '.env not found'}`);
console.log(`provider_id: ${config.providerId}`);
console.log(`gateway_mode: ${config.mode}`);
console.log(`live_authorized_for_this_run: ${liveAuthorized}`);
console.log(`base_url: ${config.baseUrl ? '<SET>' : '<MISSING>'}`);
console.log(`api_key: ${config.apiKey ? '<SET>' : '<MISSING>'}`);
console.log(`model: ${config.model ?? '<MISSING>'}`);

if (failures.length) {
  const report = {
    asset_ref: 'FAMILY_MODEL_LIVE_RUN_REPORT',
    status: 'CONFIG_FAILED',
    generated_at: new Date().toISOString(),
    config: redactedFamilyModelLiveConfig(config),
    failures,
  };
  const paths = writeReport(report);
  for (const failure of failures) console.error(`FAIL config: ${failure}`);
  console.error(`WROTE ${path.relative(rootDir, paths.latestPath).replace(/\\/g, '/')}`);
  process.exit(1);
}

const assessmentRef = argValue('--assessment-ref') ?? 'FAMILY_ASSESSMENT_REAL_MODEL_RUN_V0';
const itemBank = {
  asset_ref: 'FAMILY_ASSESSMENT_ITEM_BANK_REGISTRY',
  items: [
    {
      item_ref: 'PARENT_CHILD_TALK_INTERRUPTION',
      prompt: '亲子沟通中,孩子表达时是否经常被打断?',
      construct_refs: ['parent_child_communication'],
      need_refs: ['child_being_heard_need'],
    },
    {
      item_ref: 'HOMEWORK_START_DELAY',
      prompt: '孩子开始作业前是否常常拖延?',
      construct_refs: ['learning_self_management'],
      need_refs: ['learning_structure_need'],
    },
    {
      item_ref: 'PARENT_EMOTION_ESCALATION',
      prompt: '家庭讨论学习问题时,父母情绪是否容易升级?',
      construct_refs: ['family_emotion_regulation'],
      need_refs: ['safe_dialogue_need'],
      safety_boundary: ['human_gate'],
    },
  ],
  recommended_action_map: [
    { construct_ref: 'parent_child_communication', candidate_action_refs: ['ACTION_LISTEN_FIRST_10_MIN'] },
    { construct_ref: 'learning_self_management', candidate_action_refs: ['ACTION_HOMEWORK_START_RITUAL'] },
    { construct_ref: 'family_emotion_regulation', candidate_action_refs: ['ACTION_PAUSE_AND_REPAIR_DIALOGUE'] },
  ],
};
const interpretationSchema = {
  asset_ref: 'FAMILY_INTERPRETATION_SCHEMA',
  interpretation_templates: [],
};

const gateway = createFamilyModelGatewayFromEnv(env, {
  authorization: {
    liveExternalAiAuthorized: true,
    approvedProviderIds: [config.providerId],
  },
});
const runtime = new FamilyEducationModelRuntime({ itemBank, interpretationSchema, gateway });
const input = loadInput({
  request_id: `real-model-${Date.now()}`,
  family_context_ref: 'local_real_model_run_context_no_pii',
  child_age_stage: argValue('--age-stage') ?? 'primary_school',
  assessment_ref: assessmentRef,
  responses: [
    { item_ref: 'PARENT_CHILD_TALK_INTERRUPTION', answer_ref: 'often', answer_label: '经常' },
    { item_ref: 'HOMEWORK_START_DELAY', answer_ref: 'sometimes', answer_label: '有时' },
    { item_ref: 'PARENT_EMOTION_ESCALATION', answer_ref: 'sometimes', answer_label: '有时' },
  ],
});

try {
  const startedAt = Date.now();
  const output = await runtime.generateGatewayDraft(input);
  const report = {
    asset_ref: 'FAMILY_MODEL_LIVE_RUN_REPORT',
    status: 'PASS',
    generated_at: new Date().toISOString(),
    latency_ms: Date.now() - startedAt,
    config: redactedFamilyModelLiveConfig(config),
    input_refs: [input.assessment_ref, input.family_context_ref],
    output,
  };
  const paths = writeReport(report);
  console.log('PASS real_model_call: external model returned a boundary-checked Family draft');
  console.log(JSON.stringify({
    provider_id: config.providerId,
    assessment_ref: assessmentRef,
    report_path: path.relative(rootDir, paths.latestPath).replace(/\\/g, '/'),
    output,
  }, null, 2));
} catch (error) {
  const failure = error instanceof AiGatewayError ? `${error.kind}: ${error.message}` : (error instanceof Error ? error.message : String(error));
  const report = {
    asset_ref: 'FAMILY_MODEL_LIVE_RUN_REPORT',
    status: 'FAILED',
    generated_at: new Date().toISOString(),
    config: redactedFamilyModelLiveConfig(config),
    input_refs: [input.assessment_ref, input.family_context_ref],
    failure,
  };
  const paths = writeReport(report);
  if (error instanceof AiGatewayError) {
    console.error(`FAIL real_model_call: ${error.kind}: ${error.message}`);
  } else {
    console.error(`FAIL real_model_call: ${error instanceof Error ? error.message : String(error)}`);
  }
  console.error(`WROTE ${path.relative(rootDir, paths.latestPath).replace(/\\/g, '/')}`);
  process.exit(1);
}