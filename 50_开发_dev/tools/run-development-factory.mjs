#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const reportDir = join(root, 'reports', 'factory');
const rel = (path) => relative(root, path).replace(/\\/g, '/');
const cli = parseArgs(process.argv.slice(2));
const uiOnly = Boolean(cli.uiOnly);
const manifestPath = join(root, cli.manifest ?? 'factory', 'development-factory.manifest.json');

function pnpmCommand(commandArgs) {
  if (process.env.npm_execpath) {
    return {
      command: [process.execPath, [process.env.npm_execpath, ...commandArgs]],
      display: ['pnpm', ...commandArgs].join(' '),
    };
  }

  return {
    command: ['pnpm', commandArgs],
    display: ['pnpm', ...commandArgs].join(' '),
  };
}

function nodeCommand(commandArgs) {
  return {
    command: [process.execPath, commandArgs],
    display: ['node', ...commandArgs].join(' '),
  };
}

function parseArgs(argv) {
  const options = { target: undefined, manifest: undefined, lane: undefined, uiOnly: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--ui-only') options.uiOnly = true;
    else if (arg === '--target') options.target = argv[++index];
    else if (arg.startsWith('--target=')) options.target = arg.slice('--target='.length);
    else if (arg === '--manifest') options.manifest = argv[++index];
    else if (arg.startsWith('--manifest=')) options.manifest = arg.slice('--manifest='.length);
    else if (arg === '--lane') options.lane = argv[++index];
    else if (arg.startsWith('--lane=')) options.lane = arg.slice('--lane='.length);
  }
  return options;
}

function readManifest() {
  if (!existsSync(manifestPath)) {
    throw new Error(`Factory manifest not found: ${rel(manifestPath)}`);
  }
  return JSON.parse(readFileSync(manifestPath, 'utf8'));
}

function resolveTarget(manifest) {
  const targetId = cli.target ?? manifest.default_target;
  const target = manifest.targets.find((candidate) => candidate.id === targetId);
  if (!target) {
    const available = manifest.targets.map((candidate) => candidate.id).join(', ');
    throw new Error(`Unknown factory target '${targetId}'. Available targets: ${available}`);
  }
  return target;
}

function expandCommand(step) {
  if (step.command_kind === 'pnpm') return pnpmCommand(step.args);
  if (step.command_kind === 'node') return nodeCommand(step.args);
  if (step.command_kind === 'shell') return { command: [step.command, step.args ?? []], display: [step.command, ...(step.args ?? [])].join(' ') };
  return {};
}

function selectSteps(target) {
  return target.steps
    .filter((step) => !uiOnly || step.required_for_ui_only !== false)
    .filter((step) => !cli.lane || step.lane_refs?.includes(cli.lane))
    .map((step) => ({ ...step, ...expandCommand(step) }));
}

function runCommand(step) {
  const [bin, commandArgs] = step.command;
  const startedAt = new Date().toISOString();
  const result = spawnSync(bin, commandArgs, {
    cwd: root,
    encoding: 'utf8',
  });

  return {
    id: step.id,
    lane_refs: step.lane_refs,
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

function forbiddenTextScan(step) {
  const startedAt = new Date().toISOString();
  const files = step.files ?? [];
  const forbiddenPatterns = (step.patterns ?? []).map((pattern) => new RegExp(pattern.source, pattern.flags ?? ''));
  const findings = [];

  for (const file of files) {
    const fullPath = join(root, file);
    if (!existsSync(fullPath)) continue;
    const source = readFileSync(fullPath, 'utf8');
    for (const pattern of forbiddenPatterns) {
      if (pattern.test(source)) findings.push({ file, pattern: String(pattern) });
    }
  }

  return {
    id: step.id,
    lane_refs: step.lane_refs,
    command: 'internal forbidden effect scan',
    started_at: startedAt,
    completed_at: new Date().toISOString(),
    findings,
    ok: findings.length === 0,
  };
}

function browserEvidenceCheck(step) {
  const startedAt = new Date().toISOString();
  const evidencePath = join(root, step.evidence_file);
  if (!existsSync(evidencePath)) {
    return {
      id: step.id,
      lane_refs: step.lane_refs,
      command: `browser evidence check ${step.evidence_file}`,
      started_at: startedAt,
      completed_at: new Date().toISOString(),
      missing_evidence_file: step.evidence_file,
      ok: false,
    };
  }

  const evidence = JSON.parse(readFileSync(evidencePath, 'utf8'));
  const visibleText = (evidence.visible_text ?? []).join('\n');
  const missing_text = (step.required_text ?? []).filter((text) => !visibleText.includes(text));

  return {
    id: step.id,
    lane_refs: step.lane_refs,
    command: `browser evidence check ${step.evidence_file}`,
    started_at: startedAt,
    completed_at: new Date().toISOString(),
    evidence_file: step.evidence_file,
    evidence_url: evidence.url,
    missing_text,
    warnings: evidence.console_warnings ?? [],
    ok: missing_text.length === 0,
  };
}

function runStep(step) {
  if (step.check === 'forbiddenTextScan') return forbiddenTextScan(step);
  if (step.check === 'browserEvidenceCheck') return browserEvidenceCheck(step);
  return runCommand(step);
}

function writeMarkdownReport(report, reportPath) {
  const lines = [
    `# ${report.factory_ref}`,
    '',
    `- generated_at: ${report.generated_at}`,
    `- target_id: ${report.target_id}`,
    `- feature_ref: ${report.feature_ref}`,
    `- ui_ref: ${report.ui_ref}`,
    `- backend_ref: ${report.backend_ref}`,
    `- verdict: ${report.ok ? 'PASS' : 'FAIL'}`,
    '',
    '## Steps',
    '',
    ...report.steps.map((step) => `- ${step.ok ? 'PASS' : 'FAIL'} ${step.id}: ${step.command}`),
    '',
    '## Boundaries',
    '',
    ...report.boundaries.forbidden_effects.map((effect) => `- forbidden: ${effect}`),
    ...report.boundaries.allowed_mutations.map((mutation) => `- allowed: ${mutation}`),
  ];
  writeFileSync(reportPath, `${lines.join('\n')}\n`, 'utf8');
}

mkdirSync(reportDir, { recursive: true });

const manifest = readManifest();
const target = resolveTarget(manifest);
const steps = selectSteps(target);

const report = {
  asset_ref: 'DEVELOPMENT_FACTORY_RUN_REPORT',
  version: '0.2.0',
  generated_at: new Date().toISOString(),
  manifest_ref: manifest.factory_ref,
  target_id: target.id,
  mode: uiOnly ? 'ui_only' : 'fullstack',
  ...target,
  steps_planned: steps.map((step) => step.id),
  steps: [],
};

for (const step of steps) {
  const result = runStep(step);
  report.steps.push(result);
  const status = result.ok ? 'PASS' : 'FAIL';
  console.log(`${status} ${step.id} :: ${result.command}`);
  if (!result.ok) break;
}

report.ok = report.steps.every((step) => step.ok) && report.steps.length === steps.length;

const reportBase = target.report_base ?? target.id;
const jsonPath = join(reportDir, `${reportBase}.latest.json`);
const mdPath = join(reportDir, `${reportBase}.latest.md`);
writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
writeMarkdownReport(report, mdPath);
console.log(`WROTE ${rel(jsonPath)}`);
console.log(`WROTE ${rel(mdPath)}`);

if (!report.ok) process.exit(1);