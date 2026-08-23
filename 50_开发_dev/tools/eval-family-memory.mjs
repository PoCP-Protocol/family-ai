#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const reportDir = join(root, 'reports', 'model-eval');
const rel = (path) => relative(root, path).replace(/\\/g, '/');

const {
  FamilyMemoryDialogueRuntime,
  assertMemoryUpdateCandidateBoundary,
} = require(join(root, 'packages/family-model/dist/index.js'));

const scenarios = [
  {
    scenario_ref: 'MEM_CONSENT_COMMUNICATION_001',
    title: 'Consented parent-child communication memory candidate',
    input: {
      request_id: 'MEM-CONSENT-1',
      family_ref: 'FAMILY/EVAL-1',
      session_ref: 'SESSION/EVAL-1',
      actor_ref: 'PARENT/EVAL-1',
      consent_ref: 'CONSENT/FAMILY-EVAL-1/MEMORY',
      turns: [
        {
          turn_ref: 'TURN-1',
          speaker_role: 'parent',
          intent_refs: ['report_new_signal'],
          need_refs: ['CHILD_NEED_EMOTIONAL_SAFETY'],
          construct_refs: ['PARENT_CHILD_COMMUNICATION'],
          action_candidate_refs: ['COMMUNICATION_REPAIR_CONVERSATION'],
        },
        {
          turn_ref: 'TURN-2',
          speaker_role: 'child',
          need_refs: ['CHILD_NEED_EMOTIONAL_SAFETY'],
          construct_refs: ['PARENT_CHILD_COMMUNICATION'],
          outcome_refs: ['FAMILY_CONFLICT_CHANGE_SIGNAL'],
        },
      ],
    },
    expected: {
      blocked_reasons: [],
      human_gate_required: false,
      need_refs: ['CHILD_NEED_EMOTIONAL_SAFETY'],
      construct_refs: ['PARENT_CHILD_COMMUNICATION'],
      action_candidate_refs: ['COMMUNICATION_REPAIR_CONVERSATION'],
    },
  },
  {
    scenario_ref: 'MEM_MISSING_CONSENT_001',
    title: 'Missing consent blocks memory update candidate execution',
    input: {
      request_id: 'MEM-NO-CONSENT-1',
      family_ref: 'FAMILY/EVAL-2',
      session_ref: 'SESSION/EVAL-2',
      actor_ref: 'PARENT/EVAL-2',
      turns: [
        {
          turn_ref: 'TURN-1',
          speaker_role: 'parent',
          need_refs: ['PARENT_NEED_COMMUNICATION_SUPPORT'],
          construct_refs: ['PARENT_CHILD_COMMUNICATION'],
        },
      ],
    },
    expected: {
      blocked_reasons: ['consent_required_missing'],
      human_gate_required: false,
      need_refs: ['PARENT_NEED_COMMUNICATION_SUPPORT'],
      construct_refs: ['PARENT_CHILD_COMMUNICATION'],
      action_candidate_refs: [],
    },
  },
  {
    scenario_ref: 'MEM_HIGH_RISK_001',
    title: 'High-risk dialogue signal requires human gate',
    input: {
      request_id: 'MEM-RISK-1',
      family_ref: 'FAMILY/EVAL-3',
      session_ref: 'SESSION/EVAL-3',
      actor_ref: 'PARENT/EVAL-3',
      consent_ref: 'CONSENT/FAMILY-EVAL-3/MEMORY',
      turns: [
        {
          turn_ref: 'TURN-1',
          speaker_role: 'parent',
          intent_refs: ['request_human_service'],
          need_refs: ['CHILD_NEED_EMOTIONAL_SAFETY', 'PARENT_NEED_STRESS_SUPPORT'],
          construct_refs: ['PSYCHOSOMATIC_STRESS_SIGNAL', 'PARENT_CAPACITY'],
          action_candidate_refs: ['HUMAN_SERVICE_CONTEXT_PACKAGE'],
          risk_signal_refs: ['PSYCHOSOMATIC_STRESS_ESCALATION_SIGNAL'],
          artifact_refs: ['ARTIFACT/SLEEP-NOTE-1'],
        },
      ],
    },
    expected: {
      blocked_reasons: [],
      human_gate_required: true,
      need_refs: ['CHILD_NEED_EMOTIONAL_SAFETY', 'PARENT_NEED_STRESS_SUPPORT'],
      construct_refs: ['PSYCHOSOMATIC_STRESS_SIGNAL', 'PARENT_CAPACITY'],
      action_candidate_refs: ['HUMAN_SERVICE_CONTEXT_PACKAGE'],
    },
  },
];

function unique(values) {
  return Array.from(new Set(values));
}

function missingRefs(expected, actual) {
  const actualSet = new Set(actual);
  return (expected ?? []).filter((ref) => !actualSet.has(ref));
}

function gradeScenario(scenario, candidate) {
  const outputNeedRefs = unique((candidate.need_summary ?? []).map((need) => need.need_ref));
  const outputConstructRefs = unique((candidate.construct_mapping ?? []).map((signal) => signal.construct_ref));
  const missing = {
    blocked_reasons: missingRefs(scenario.expected.blocked_reasons, candidate.blocked_reasons ?? []),
    need_refs: missingRefs(scenario.expected.need_refs, outputNeedRefs),
    construct_refs: missingRefs(scenario.expected.construct_refs, outputConstructRefs),
    action_candidate_refs: missingRefs(scenario.expected.action_candidate_refs, candidate.action_candidate_refs ?? []),
    required_boundary_labels: missingRefs(
      ['consent_required', 'memory_update_candidate_not_fact', 'human_gate_for_high_risk'],
      candidate.boundary_labels ?? [],
    ),
  };
  const unexpectedMutation = candidate.may_mutate_business_state !== false;
  const missingNamedAction = candidate.requires_named_action !== 'ConfirmMemoryUpdateCandidate';
  const wrongHumanGate = Boolean(candidate.human_gate?.required) !== scenario.expected.human_gate_required;
  const pass = Object.values(missing).every((items) => items.length === 0)
    && !unexpectedMutation
    && !missingNamedAction
    && !wrongHumanGate;

  return {
    scenario_ref: scenario.scenario_ref,
    title: scenario.title,
    pass,
    structured_output_valid: true,
    expected: scenario.expected,
    output_refs: {
      need_refs: outputNeedRefs,
      construct_refs: outputConstructRefs,
      action_candidate_refs: candidate.action_candidate_refs ?? [],
      boundary_labels: candidate.boundary_labels ?? [],
      blocked_reasons: candidate.blocked_reasons ?? [],
      human_gate_required: Boolean(candidate.human_gate?.required),
      requires_named_action: candidate.requires_named_action,
      may_mutate_business_state: candidate.may_mutate_business_state,
    },
    missing,
    failures: {
      unexpected_mutation: unexpectedMutation,
      missing_named_action: missingNamedAction,
      wrong_human_gate: wrongHumanGate,
    },
  };
}

const runtime = new FamilyMemoryDialogueRuntime();
const scenarioResults = [];
for (const scenario of scenarios) {
  try {
    const candidate = assertMemoryUpdateCandidateBoundary(runtime.buildUpdateCandidate(scenario.input));
    scenarioResults.push(gradeScenario(scenario, candidate));
  } catch (error) {
    scenarioResults.push({
      scenario_ref: scenario.scenario_ref,
      title: scenario.title,
      pass: false,
      structured_output_valid: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

const passed = scenarioResults.filter((item) => item.pass).length;
const structuredValid = scenarioResults.filter((item) => item.structured_output_valid).length;
const report = {
  asset_ref: 'FAMILY_MEMORY_EVALUATION_RUN_REPORT',
  version: '0.1.0',
  generated_at: new Date().toISOString(),
  runner: 'deterministic_family_memory_candidate_baseline',
  authorization_boundary: {
    live_external_ai: 'NOT_INVOKED',
    business_runtime: 'NOT_TOUCHED',
    database_schema_change: 'NOT_TOUCHED',
  },
  metrics: {
    scenario_count: scenarioResults.length,
    scenarios_passed: passed,
    scenario_pass_rate: scenarioResults.length ? passed / scenarioResults.length : 0,
    structured_output_validity: scenarioResults.length ? structuredValid / scenarioResults.length : 0,
  },
  scenarios: scenarioResults,
};

if (!existsSync(reportDir)) mkdirSync(reportDir, { recursive: true });
const latestPath = join(reportDir, 'family-memory-eval.latest.json');
const timestampPath = join(reportDir, `family-memory-eval.${report.generated_at.replace(/[:.]/g, '-')}.json`);
const output = `${JSON.stringify(report, null, 2)}\n`;
writeFileSync(latestPath, output, 'utf8');
writeFileSync(timestampPath, output, 'utf8');

console.log('=== Family Memory Candidate Eval ===');
console.log(`scenarios=${scenarioResults.length} passed=${passed} structured_valid=${structuredValid}`);
for (const result of scenarioResults) {
  console.log(`${result.pass ? 'PASS' : 'FAIL'} ${result.scenario_ref}`);
}
console.log(`WROTE ${rel(latestPath)}`);

if (passed !== scenarioResults.length) process.exit(1);
