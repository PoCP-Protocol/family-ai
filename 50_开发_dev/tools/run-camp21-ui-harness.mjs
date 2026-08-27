#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const reportDir = join(root, 'reports', 'ui-harness');
const rel = (path) => relative(root, path).replace(/\\/g, '/');

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
    id: 'ui14_baseline_and_cross_page_regression',
    laneRefs: ['UI14_VISUAL_BASELINE_LANE', 'CONTROLLED_COMMERCE_LANE'],
    ...pnpmCommand(['--dir', 'apps/mobile', 'exec', 'vitest', 'run', 'tests/ui14-product-detail-baseline.test.ts', 'tests/ui13-ui18-cross-page-regression.test.ts']),
  },
  {
    id: 'mobile_typecheck',
    laneRefs: ['MOBILE_TYPECHECK_LANE'],
    ...pnpmCommand(['--dir', 'apps/mobile', 'check']),
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
  asset_ref: 'CAMP21_UI_HARNESS_RUN_REPORT',
  version: '0.1.0',
  generated_at: new Date().toISOString(),
  product_ref: 'PRODUCT_PARENT_CHILD_CAMP',
  ui_ref: 'UI-14',
  authorization_boundary: {
    payment_sdk: 'NOT_INVOKED',
    external_order_placement: 'NOT_INVOKED',
    business_runtime_mutation: 'CONTROLLED_INTENT_ONLY',
  },
  harness_reference: {
    mode: 'local_ui_contract_runner',
    note: 'Guards the 21-day parent-child communication camp product detail baseline and controlled commerce intent path.',
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

const reportPath = join(reportDir, 'camp21-ui-harness-run.latest.json');
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(`WROTE ${rel(reportPath)}`);

if (!report.ok) process.exit(1);