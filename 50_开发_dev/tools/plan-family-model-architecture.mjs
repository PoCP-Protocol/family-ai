#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import * as YAML from 'js-yaml';

const require = createRequire(import.meta.url);
const loadYaml = YAML.load ?? YAML.default?.load;
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const architecturePath = path.join(rootDir, 'docs/model/family_model_technical_architecture.registry.yaml');
const { FamilyModelTechnicalArchitectureRuntime } = require(path.join(rootDir, 'packages/family-model/dist/index.js'));

const args = process.argv.slice(2);
const flowArg = args.find((arg) => arg.startsWith('--flow='));
const liveArg = args.includes('--live-authorized');
const envArg = args.find((arg) => arg.startsWith('--env-keys='));
const allFlows = args.includes('--all');

const envKeys = envArg
  ? envArg.slice('--env-keys='.length).split(',').map((key) => key.trim()).filter(Boolean)
  : Object.keys(process.env).filter((key) => key.startsWith('FAMILY_MODEL_') || key.startsWith('FPAI_MODEL_'));

function readArchitecture() {
  return loadYaml(fs.readFileSync(architecturePath, 'utf8'));
}

function printUsageAndExit() {
  console.error('Usage: pnpm run plan:family-model-architecture -- --flow=<FLOW_REF> [--live-authorized] [--env-keys=A,B]');
  console.error('   or: pnpm run plan:family-model-architecture -- --all');
  process.exit(1);
}

const architecture = readArchitecture();
const runtime = new FamilyModelTechnicalArchitectureRuntime(architecture);

if (!allFlows && !flowArg) printUsageAndExit();

const flowRefs = allFlows
  ? architecture.architecture_flows.map((flow) => flow.flow_ref)
  : [flowArg.slice('--flow='.length)];

const plans = flowRefs.map((flow_ref) => runtime.planFlow({
  flow_ref,
  live_external_ai_authorized: liveArg,
  available_env_keys: envKeys,
}));

console.log(JSON.stringify({
  generated_at: new Date().toISOString(),
  architecture_asset_ref: architecture.asset_ref,
  architecture_id: architecture.architecture_id,
  live_authorized_input: liveArg,
  available_env_keys: envKeys.map((key) => key.includes('KEY') ? `${key}:<REDACTED>` : key),
  plans,
}, null, 2));