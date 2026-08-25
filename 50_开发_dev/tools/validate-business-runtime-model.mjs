import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import * as yaml from 'js-yaml';

const root = process.cwd();
const modelPath = path.join(root, 'governance', 'FAMILY_BUSINESS_RUNTIME_MODEL_V1.yaml');
const uiMatrixPath = path.join(root, 'governance', 'FAMILY_CONSUMER_UI_BASELINE_V1.json');

const model = yaml.load(fs.readFileSync(modelPath, 'utf8'));
const uiMatrix = JSON.parse(fs.readFileSync(uiMatrixPath, 'utf8'));
const errors = [];

function uniqueIndex(items, field, label) {
  const index = new Map();
  for (const item of items ?? []) {
    const value = item?.[field];
    if (!value) errors.push(`${label} missing ${field}`);
    else if (index.has(value)) errors.push(`${label} duplicate ${field}: ${value}`);
    else index.set(value, item);
  }
  return index;
}

const ruleIndex = uniqueIndex(model.global_rules, 'id', 'rule');
const objectIndex = uniqueIndex(model.data_objects, 'id', 'object');
const componentIndex = uniqueIndex(model.application_components, 'id', 'component');
const scenarioIndex = uniqueIndex(model.scenarios, 'id', 'scenario');
const sliceIndex = uniqueIndex(model.runtime_slices, 'id', 'slice');
const actorIndex = uniqueIndex(model.actors, 'id', 'actor');
const uiIds = new Set(uiMatrix.screens.map((screen) => screen.ui_id));
const canonicalLoops = new Set(model.canonical_loops);
const domains = new Set(model.domains);

for (const object of model.data_objects ?? []) {
  if (!domains.has(object.domain)) errors.push(`object ${object.id} unknown domain: ${object.domain}`);
  if (!Array.isArray(object.required_fields) || object.required_fields.length < 3) errors.push(`object ${object.id} requires at least 3 required_fields`);
}

for (const relation of model.relationships ?? []) {
  if (!objectIndex.has(relation.from)) errors.push(`relationship unknown from object: ${relation.from}`);
  if (!objectIndex.has(relation.to)) errors.push(`relationship unknown to object: ${relation.to}`);
  if (!relation.cardinality || !relation.rule) errors.push(`relationship ${relation.from}->${relation.to} missing cardinality/rule`);
}

for (const scenario of model.scenarios ?? []) {
  if (!canonicalLoops.has(scenario.loop)) errors.push(`scenario ${scenario.id} unknown loop: ${scenario.loop}`);
  if (!domains.has(scenario.primary_domain)) errors.push(`scenario ${scenario.id} unknown domain: ${scenario.primary_domain}`);
  for (const actor of scenario.actors ?? []) if (!actorIndex.has(actor)) errors.push(`scenario ${scenario.id} unknown actor: ${actor}`);
  for (const rule of scenario.rules ?? []) if (!ruleIndex.has(rule)) errors.push(`scenario ${scenario.id} unknown rule: ${rule}`);
  for (const object of scenario.objects ?? []) if (!objectIndex.has(object)) errors.push(`scenario ${scenario.id} unknown object: ${object}`);
  for (const component of scenario.components ?? []) if (!componentIndex.has(component)) errors.push(`scenario ${scenario.id} unknown component: ${component}`);
  for (const ui of scenario.ui ?? []) if (!uiIds.has(ui)) errors.push(`scenario ${scenario.id} unknown UI: ${ui}`);
  if (!sliceIndex.has(scenario.release_gate)) errors.push(`scenario ${scenario.id} unknown release gate: ${scenario.release_gate}`);
  if (!scenario.state_flow?.includes('->')) errors.push(`scenario ${scenario.id} missing state flow`);
  if (!scenario.success_outcome) errors.push(`scenario ${scenario.id} missing success outcome`);
}

for (const slice of model.runtime_slices ?? []) {
  for (const scenario of slice.scenarios ?? []) if (!scenarioIndex.has(scenario)) errors.push(`slice ${slice.id} unknown scenario: ${scenario}`);
  if (!slice.runnable_when) errors.push(`slice ${slice.id} missing runnable_when`);
}

const uncoveredUi = [...uiIds].filter((ui) => !(model.scenarios ?? []).some((scenario) => scenario.ui?.includes(ui)));
if (uncoveredUi.length) errors.push(`UI not mapped to business scenario: ${uncoveredUi.join(', ')}`);

console.log('FAMILY_BUSINESS_RUNTIME_MODEL_V1');
console.log(`loops=${model.canonical_loops.length}`);
console.log(`scenarios=${model.scenarios.length}`);
console.log(`objects=${model.data_objects.length}`);
console.log(`relationships=${model.relationships.length}`);
console.log(`components=${model.application_components.length}`);
console.log(`rules=${model.global_rules.length}`);
console.log(`runtime_slices=${model.runtime_slices.length}`);

if (errors.length) {
  console.error(`FAIL: ${errors.length} validation error(s)`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log('PASS: business runtime model references and coverage are valid');
}
