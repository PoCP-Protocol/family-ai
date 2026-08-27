#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import * as YAML from 'js-yaml';
import {
  loadDotEnv,
  readFamilyModelLiveConfig,
  redactedFamilyModelLiveConfig,
  validateFamilyModelLiveConfig,
} from './family-model-live-config.mjs';

const loadYaml = YAML.load ?? YAML.default?.load;
const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const modelDir = join(root, 'docs', 'model');
const reportDir = join(root, 'reports', 'model-eval');
const envPath = join(root, '.env');
const rel = (path) => relative(root, path).replace(/\\/g, '/');

const {
  FamilyEducationModelRuntime,
  assertInterpretationBoundary,
} = require(join(root, 'packages/family-model/dist/index.js'));
const {
  AiGatewayError,
  createFamilyModelGatewayFromEnv,
} = require(join(root, 'packages/ai-gateway/dist/index.js'));

function argValue(name) {
  const prefix = `${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function requestedRunner() {
  if (process.argv.includes('--live')) return 'live_gateway';
  if (argValue('--runner') === 'live') return 'live_gateway';
  return 'deterministic_family_model_baseline';
}

function readYaml(fileName) {
  return loadYaml(readFileSync(join(modelDir, fileName), 'utf8'));
}

function unique(values) {
  return Array.from(new Set(values));
}

function normalizeExpectedBoundary(label) {
  const aliases = {
    perspective: 'perspective_not_fact',
    context_signal: 'signal_not_diagnosis',
    artifact_signal: 'signal_not_diagnosis',
    human_gate_required: 'human_gate_required',
  };
  return aliases[label] ?? label;
}

function makeScenarioInput(scenario, itemBank) {
  const expectedConstructs = new Set(scenario.expected_construct_refs ?? []);
  const matchedItems = (itemBank.items ?? []).filter((item) => (item.construct_refs ?? []).some((ref) => expectedConstructs.has(ref)));
  return {
    request_id: `EVAL-${scenario.scenario_ref}`,
    assessment_ref: scenario.scenario_ref,
    family_context_ref: 'eval_synthetic_context_no_pii',
    child_age_stage: 'unknown',
    responses: matchedItems.map((item) => ({
      item_ref: item.item_ref,
      answer_ref: item.answer_mode === 'FIVE_POINT_AGREEMENT' ? 'mixed' : 'often',
      answer_label: 'synthetic_eval_signal',
    })),
  };
}

function collectOutputRefs(draft) {
  return {
    constructRefs: unique((draft.construct_signals ?? []).map((signal) => signal.construct_ref)),
    actionRefs: unique((draft.action_candidates ?? []).map((action) => action.action_ref)),
    boundaryLabels: new Set(draft.boundary_labels ?? []),
  };
}

function missingRefs(expected, actual) {
  const actualSet = new Set(actual);
  return (expected ?? []).filter((ref) => !actualSet.has(ref));
}

function findProhibitedOutputLeaks(value, prohibited, path = '$') {
  const leaks = [];
  if (!value || typeof value !== 'object') return leaks;
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      leaks.push(...findProhibitedOutputLeaks(item, prohibited, `${path}[${index}]`));
    });
    return leaks;
  }
  for (const [key, child] of Object.entries(value)) {
    if (key === 'prohibited_outputs') continue;
    if (prohibited.some((entry) => key.toLowerCase() === String(entry).toLowerCase())) leaks.push(`${path}.${key}`);
    if (typeof child === 'string' && prohibited.some((entry) => child.toLowerCase() === String(entry).toLowerCase())) leaks.push(`${path}.${key}`);
    leaks.push(...findProhibitedOutputLeaks(child, prohibited, `${path}.${key}`));
  }
  return leaks;
}

function gradeScenario(scenario, draft, itemBank) {
  const outputRefs = collectOutputRefs(draft);
  const expectedBoundaries = unique((scenario.expected_boundary_labels ?? []).map(normalizeExpectedBoundary));
  const boundaryMissing = expectedBoundaries.filter((label) => label !== 'human_gate_required' && !outputRefs.boundaryLabels.has(label));
  const humanGateMissing = expectedBoundaries.includes('human_gate_required') && draft.human_gate?.required !== true;
  const constructMissing = missingRefs(scenario.expected_construct_refs, outputRefs.constructRefs);
  const actionMissing = missingRefs(scenario.expected_action_refs, outputRefs.actionRefs);
  const prohibitedLeaks = findProhibitedOutputLeaks(draft, scenario.prohibited_outputs ?? []);
  const itemBankCoveredConstructs = unique((itemBank.items ?? []).flatMap((item) => item.construct_refs ?? []));
  const assetCoverageMissing = missingRefs(scenario.expected_construct_refs, itemBankCoveredConstructs);
  const pass = boundaryMissing.length === 0
    && !humanGateMissing
    && constructMissing.length === 0
    && actionMissing.length === 0
    && prohibitedLeaks.length === 0;

  return {
    scenario_ref: scenario.scenario_ref,
    title: scenario.title,
    pass,
    structured_output_valid: true,
    expected_refs: {
      construct_refs: scenario.expected_construct_refs ?? [],
      action_refs: scenario.expected_action_refs ?? [],
      boundary_labels: scenario.expected_boundary_labels ?? [],
    },
    output_refs: {
      construct_refs: outputRefs.constructRefs,
      action_refs: outputRefs.actionRefs,
      boundary_labels: Array.from(outputRefs.boundaryLabels),
      human_gate_required: draft.human_gate?.required === true,
    },
    missing: {
      construct_refs: constructMissing,
      action_refs: actionMissing,
      boundary_labels: boundaryMissing,
      human_gate_required: humanGateMissing,
      prohibited_output_leaks: prohibitedLeaks,
      item_bank_construct_coverage: assetCoverageMissing,
    },
  };
}

const itemBank = readYaml('family_assessment_item_bank.registry.yaml');
const interpretationSchema = readYaml('family_interpretation.schema.yaml');
const scenarios = readYaml('family_model_evaluation_scenarios.yaml');
const runner = requestedRunner();
const liveRequested = runner === 'live_gateway';
const fileEnv = loadDotEnv(envPath);
const env = { ...fileEnv, ...process.env };
const liveAuthorized = process.argv.includes('--live-authorized') || env.FAMILY_MODEL_LIVE_AUTHORIZED === 'true';
const liveConfig = readFamilyModelLiveConfig(env);

function writeReport(report) {
  if (!existsSync(reportDir)) mkdirSync(reportDir, { recursive: true });
  const suffix = liveRequested ? 'live' : 'deterministic';
  const latestPath = join(reportDir, `family-model-eval.${suffix}.latest.json`);
  const legacyLatestPath = join(reportDir, 'family-model-eval.latest.json');
  const timestampPath = join(reportDir, `family-model-eval.${suffix}.${report.generated_at.replace(/[:.]/g, '-')}.json`);
  const output = `${JSON.stringify(report, null, 2)}\n`;
  writeFileSync(latestPath, output, 'utf8');
  writeFileSync(timestampPath, output, 'utf8');
  if (!liveRequested) writeFileSync(legacyLatestPath, output, 'utf8');
  return latestPath;
}

if (liveRequested) {
  const failures = validateFamilyModelLiveConfig(liveConfig, { liveAuthorized });
  if (failures.length) {
    const report = {
      asset_ref: 'FAMILY_MODEL_EVALUATION_RUN_REPORT',
      version: '0.1.0',
      status: 'CONFIG_FAILED',
      generated_at: new Date().toISOString(),
      runner,
      config: redactedFamilyModelLiveConfig(liveConfig),
      failures,
      authorization_boundary: {
        live_external_ai: 'NOT_INVOKED',
        business_runtime: 'NOT_TOUCHED',
        database_schema_change: 'NOT_TOUCHED',
      },
    };
    const latestPath = writeReport(report);
    console.log('=== Family Education Model Eval ===');
    console.log(`runner=${runner}`);
    for (const failure of failures) console.error(`FAIL config: ${failure}`);
    console.log(`WROTE ${rel(latestPath)}`);
    process.exit(1);
  }
}

const gateway = liveRequested
  ? createFamilyModelGatewayFromEnv(env, {
    authorization: {
      liveExternalAiAuthorized: true,
      approvedProviderIds: [liveConfig.providerId],
    },
  })
  : undefined;
const runtime = new FamilyEducationModelRuntime({ itemBank, interpretationSchema, gateway });

const scenarioResults = [];
for (const scenario of scenarios.scenarios ?? []) {
  try {
    const input = makeScenarioInput(scenario, itemBank);
    const draft = assertInterpretationBoundary(liveRequested ? await runtime.generateGatewayDraft(input) : runtime.interpretDeterministically(input));
    scenarioResults.push(gradeScenario(scenario, draft, itemBank));
  } catch (error) {
    scenarioResults.push({
      scenario_ref: scenario.scenario_ref,
      title: scenario.title,
      pass: false,
      structured_output_valid: false,
      error: error instanceof AiGatewayError ? `${error.kind}: ${error.message}` : (error instanceof Error ? error.message : String(error)),
    });
  }
}

const passed = scenarioResults.filter((item) => item.pass).length;
const structuredValid = scenarioResults.filter((item) => item.structured_output_valid).length;
const uniqueAssetGaps = unique(scenarioResults.flatMap((item) => item.missing?.item_bank_construct_coverage ?? []));
const report = {
  asset_ref: 'FAMILY_MODEL_EVALUATION_RUN_REPORT',
  version: '0.1.0',
  generated_at: new Date().toISOString(),
  runner,
  config: liveRequested ? redactedFamilyModelLiveConfig(liveConfig) : undefined,
  authorization_boundary: {
    live_external_ai: liveRequested ? 'INVOKED_AFTER_RUN_AUTHORIZATION' : 'NOT_INVOKED',
    business_runtime: 'NOT_TOUCHED',
    database_schema_change: 'NOT_TOUCHED',
  },
  metrics: {
    scenario_count: scenarioResults.length,
    scenarios_passed: passed,
    scenario_pass_rate: scenarioResults.length ? passed / scenarioResults.length : 0,
    structured_output_validity: scenarioResults.length ? structuredValid / scenarioResults.length : 0,
    item_bank_missing_construct_refs: uniqueAssetGaps,
  },
  scenarios: scenarioResults,
};

const latestPath = writeReport(report);

console.log('=== Family Education Model Eval ===');
console.log(`runner=${runner}`);
console.log(`scenarios=${scenarioResults.length} passed=${passed} structured_valid=${structuredValid}`);
if (uniqueAssetGaps.length) console.log(`asset_gaps=${uniqueAssetGaps.join(',')}`);
for (const result of scenarioResults) {
  console.log(`${result.pass ? 'PASS' : 'FAIL'} ${result.scenario_ref}`);
}
console.log(`WROTE ${rel(latestPath)}`);

if (scenarioResults.some((item) => !item.pass)) process.exit(1);