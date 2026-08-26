#!/usr/bin/env node
import { createFamilyEducationAssessmentModelRuntime } from '../../packages/family-model/dist/index.js';
import { AnthropicAiGateway } from '../../packages/ai-gateway/dist/index.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SCENARIOS = [
  { key: 'A_contradictory_signals', label: '场景A:矛盾信号', responses: [
    { item_ref: 'PARENT_CHILD_TALK_INTERRUPTION', response_value: 'RARELY', response_type: 'SINGLE_CHOICE' },
    { item_ref: 'CHILD_WILLINGNESS_TO_TALK', response_value: 'OFTEN', response_type: 'SINGLE_CHOICE' },
    { item_ref: 'DEVICE_RULE_CONFLICT', response_value: 'VERY_OFTEN', response_type: 'SINGLE_CHOICE' },
    { item_ref: 'PARENT_CAPACITY_PRESSURE', response_value: 'OFTEN', response_type: 'SINGLE_CHOICE' },
  ]},
  { key: 'B_boundary_case', label: '场景B:边界情况', responses: [
    { item_ref: 'PARENT_CHILD_TALK_INTERRUPTION', response_value: 'NEVER', response_type: 'SINGLE_CHOICE' },
    { item_ref: 'HOMEWORK_START_DELAY', response_value: 'RARELY', response_type: 'SINGLE_CHOICE' },
    { item_ref: 'SCHOOL_FAMILY_FEEDBACK_LOOP', response_value: 'RARELY', response_type: 'SINGLE_CHOICE' },
  ]},
  { key: 'C_typical_case', label: '场景C:典型情况', responses: [
    { item_ref: 'HOMEWORK_START_DELAY', response_value: 'VERY_OFTEN', response_type: 'SINGLE_CHOICE' },
    { item_ref: 'CHILD_ERROR_REVIEW_PATTERN', response_value: 'RARELY', response_type: 'SINGLE_CHOICE' },
    { item_ref: 'DEVICE_RULE_CONFLICT', response_value: 'OFTEN', response_type: 'SINGLE_CHOICE' },
    { item_ref: 'PARENT_CHILD_TALK_INTERRUPTION', response_value: 'SOMETIMES', response_type: 'SINGLE_CHOICE' },
  ]},
];

function buildInput(scenario, idx) {
  return {
    request_id: `AI_VERIFY_${scenario.key}_${idx}`,
    assessment_session_id: `AI_VERIFY_SESSION_${scenario.key}`,
    tool_ref: 'UI02_FAMILY_ASSESSMENT_V0',
    tool_version: 1,
    family_context_ref: 'AI_VERIFY_FIXTURE_FAMILY_NOT_REAL',
    child_age_stage: 'EARLY_ADOLESCENCE_12_15',
    responses: scenario.responses,
  };
}

async function runOne(runtime, scenario, idx) {
  const input = buildInput(scenario, idx);
  const startedAt = Date.now();
  try {
    const output = await runtime.generateUi02AssessmentGatewayDraft(input);
    return { scenario: scenario.key, label: scenario.label, ok: true, latency_ms: Date.now() - startedAt, output };
  } catch (err) {
    return { scenario: scenario.key, label: scenario.label, ok: false, latency_ms: Date.now() - startedAt, error: { name: err?.name, message: err?.message, kind: err?.kind } };
  }
}

async function main() {
  const results = { live: [] };
  const baseUrl = process.env.ANTHROPIC_BASE_URL;
  const apiKey = process.env.ANTHROPIC_AUTH_TOKEN;
  const model = process.env.FAMILY_MODEL_CC_SWITCH_MODEL || 'claude-opus-4-8';
  const liveGateway = new AnthropicAiGateway({ baseUrl, apiKey, model, timeoutMs: 60000 });
  const liveRuntime = createFamilyEducationAssessmentModelRuntime(liveGateway);
  // 每个场景跑2次,观察稳定性
  for (let round = 0; round < 2; round += 1) {
    for (let i = 0; i < SCENARIOS.length; i += 1) {
      const r = await runOne(liveRuntime, SCENARIOS[i], `${i}_r${round}`);
      results.live.push(r);
      console.log(`[round ${round}] ${SCENARIOS[i].key}: ${r.ok ? 'OK' : 'FAIL:' + r.error?.message} (${r.latency_ms}ms)`);
    }
  }
  writeFileSync(`${__dirname}/ui02-gateway-comparison-result-postfix.json`, JSON.stringify(results, null, 2), 'utf8');
  const okCount = results.live.filter(r => r.ok).length;
  console.log(`\n成功率: ${okCount}/${results.live.length}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
