import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import {
  loadDotEnv,
  readFamilyModelLiveConfig,
  validateFamilyModelLiveConfig,
} from './family-model-live-config.mjs';

const require = createRequire(import.meta.url);
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sprintPath = path.join(rootDir, 'CURRENT_SPRINT.md');
const envPath = path.join(rootDir, '.env');

const { AiGatewayError, createFamilyModelGatewayFromEnv } = require(path.join(rootDir, 'packages/ai-gateway/dist/index.js'));
const { FamilyEducationModelRuntime } = require(path.join(rootDir, 'packages/family-model/dist/index.js'));

function isLiveExternalAiAuthorized() {
  const sprint = fs.readFileSync(sprintPath, 'utf8');
  return /LIVE_EXTERNAL_AI\s*=\s*AUTHORIZED/.test(sprint);
}

const fileEnv = loadDotEnv(envPath);
const env = { ...fileEnv, ...process.env };
const liveAuthorized = isLiveExternalAiAuthorized();
const config = readFamilyModelLiveConfig(env);
const envFailures = validateFamilyModelLiveConfig(config, { liveAuthorized });

console.log('=== Family Model Live Smoke ===');
console.log(`env_file: ${fs.existsSync(envPath) ? '.env loaded' : '.env not found'}`);
console.log(`provider_id: ${config.providerId}`);
console.log(`gateway_mode: ${config.mode}`);
console.log(`live_external_ai_authorized: ${liveAuthorized}`);
console.log(`cc_switch_base_url: ${config.baseUrl ? '<SET>' : '<MISSING>'}`);
console.log(`cc_switch_api_key: ${config.apiKey ? '<SET>' : '<MISSING>'}`);
console.log(`cc_switch_model: ${config.model ?? '<MISSING>'}`);

if (!liveAuthorized) {
  console.error('FAIL sprint_authorizes_live_ai: CURRENT_SPRINT.md has LIVE_EXTERNAL_AI=NOT_AUTHORIZED');
  process.exitCode = 1;
} else if (envFailures.length) {
  for (const failure of envFailures) console.error(`FAIL env: ${failure}`);
  process.exitCode = 1;
} else {
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
    ],
    recommended_action_map: [
      { construct_ref: 'parent_child_communication', candidate_action_refs: ['ACTION_LISTEN_FIRST_10_MIN'] },
      { construct_ref: 'learning_self_management', candidate_action_refs: ['ACTION_HOMEWORK_START_RITUAL'] },
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
  const input = {
    request_id: `live-smoke-${Date.now()}`,
    family_context_ref: 'synthetic_family_context_for_live_smoke_only',
    child_age_stage: 'primary_school',
    assessment_ref: 'FAMILY_ASSESSMENT_LIVE_SMOKE_V0',
    responses: [
      { item_ref: 'PARENT_CHILD_TALK_INTERRUPTION', answer_ref: 'often', answer_label: '经常' },
      { item_ref: 'HOMEWORK_START_DELAY', answer_ref: 'sometimes', answer_label: '有时' },
    ],
  };

  try {
    const output = await runtime.generateGatewayDraft(input);
    console.log('PASS live_model_call: cc switch returned a boundary-checked structured draft');
    console.log(JSON.stringify(output, null, 2));
  } catch (error) {
    if (error instanceof AiGatewayError) {
      console.error(`FAIL live_model_call: ${error.kind}: ${error.message}`);
    } else {
      console.error(`FAIL live_model_call: ${error instanceof Error ? error.message : String(error)}`);
    }
    process.exitCode = 1;
  }
}