#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const reportDir = join(root, 'reports', 'model-harness');
const rel = (path) => relative(root, path).replace(/\\/g, '/');
const args = new Set(process.argv.slice(2));
const includeFullDistillation = args.has('--distillation-full') || args.has('--full-distillation');

function pnpmCommand(args) {
  if (process.env.npm_execpath) {
    return {
      command: [process.execPath, [process.env.npm_execpath, ...args]],
      display: ['pnpm', ...args].join(' '),
    };
  }

  return {
    command: ['pnpm', args],
    display: ['pnpm', ...args].join(' '),
  };
}

const commands = [
  {
    id: 'distill_family_model',
    laneRefs: ['DISTILLATION_DATA_LANE'],
    ...pnpmCommand(['run', 'distill:family-model']),
  },
  ...(includeFullDistillation ? [
    {
      id: 'stage_family_model_220k',
      laneRefs: ['DISTILLATION_DATA_LANE'],
      ...pnpmCommand(['run', 'stage:family-model-220k']),
    },
    {
      id: 'distill_family_model_review_batch',
      laneRefs: ['DISTILLATION_DATA_LANE'],
      ...pnpmCommand(['run', 'distill:family-model-review-batch']),
    },
    {
      id: 'distill_family_model_subsets',
      laneRefs: ['DISTILLATION_DATA_LANE'],
      ...pnpmCommand(['run', 'distill:family-model-subsets']),
    },
  ] : []),
  {
    id: 'validate_model_assets',
    laneRefs: ['MODEL_ASSET_BUILD_LANE', 'EVAL_AND_SAFETY_LANE', 'RUNTIME_PLAN_LANE', 'DISTILLATION_DATA_LANE'],
    ...pnpmCommand(['run', 'validate:model-assets']),
  },
  {
    id: 'eval_family_model',
    laneRefs: ['EVAL_AND_SAFETY_LANE'],
    ...pnpmCommand(['run', 'eval:family-model']),
  },
  {
    id: 'eval_family_memory',
    laneRefs: ['EVAL_AND_SAFETY_LANE'],
    ...pnpmCommand(['run', 'eval:family-memory']),
  },
  {
    id: 'plan_family_model_architecture',
    laneRefs: ['RUNTIME_PLAN_LANE'],
    ...pnpmCommand(['run', 'plan:family-model-architecture', '--', '--all']),
  },
];

function runCommand(step) {
  const [bin, args] = step.command;
  const startedAt = new Date().toISOString();
  const result = spawnSync(bin, args, {
    cwd: root,
    encoding: 'utf8',
  });

  return {
    id: step.id,
    lane_refs: step.laneRefs,
    command: step.display,
    started_at: startedAt,
    completed_at: new Date().toISOString(),
    exit_code: result.status,
    signal: result.signal,
    stdout: result.stdout ?? '',
    stderr: result.error ? `${result.error.name}: ${result.error.message}` : (result.stderr ?? ''),
    ok: result.status === 0,
  };
}

mkdirSync(reportDir, { recursive: true });

const report = {
  asset_ref: 'FAMILY_MODEL_HARNESS_RUN_REPORT',
  version: '0.1.0',
  generated_at: new Date().toISOString(),
  authorization_boundary: {
    live_external_ai: 'NOT_INVOKED',
    business_runtime: 'NOT_TOUCHED',
    database_schema_change: 'NOT_TOUCHED',
  },
  harness_reference: {
    mode: 'codex_harness_style_local_runner',
    distillation_mode: includeFullDistillation ? 'full_staging_review_batch_and_subsets' : 'first_party_baseline',
    note: 'Composes Family-owned deterministic validators, distillers, and planners. It does not call external AI under the current gate.',
  },
  steps: [],
};

for (const step of commands) {
  const result = runCommand(step);
  report.steps.push(result);
  const status = result.ok ? 'PASS' : 'FAIL';
  console.log(`${status} ${step.id} :: ${result.command}`);
  if (!result.ok) break;
}

report.ok = report.steps.every((step) => step.ok) && report.steps.length === commands.length;

const reportPath = join(reportDir, 'family-model-harness-run.latest.json');
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(`WROTE ${rel(reportPath)}`);

if (!report.ok) process.exit(1);
