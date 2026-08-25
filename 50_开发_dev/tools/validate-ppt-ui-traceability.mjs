import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import * as yaml from 'js-yaml';

const root = process.cwd();
const trace = yaml.load(fs.readFileSync(path.join(root, 'governance', 'FAMILY_PPT_UI_DELIVERY_TRACEABILITY_V1.yaml'), 'utf8'));
const runtime = JSON.parse(fs.readFileSync(path.join(root, 'governance', 'FAMILY_CONSUMER_UI_BASELINE_V1.json'), 'utf8'));
const business = yaml.load(fs.readFileSync(path.join(root, 'governance', 'FAMILY_BUSINESS_RUNTIME_MODEL_V1.yaml'), 'utf8'));
const errors = [];

const deckIds = new Set((trace.decks ?? []).map((d) => d.id));
const uiIds = new Set((runtime.screens ?? []).map((s) => s.ui_id));
const scenarioIds = new Set((business.scenarios ?? []).map((s) => s.id));
const sliceIds = new Set((business.runtime_slices ?? []).map((s) => s.id));
const objectiveIds = new Set();
const testIds = new Set();

if (deckIds.size !== 3) errors.push(`expected exactly 3 baseline decks, found ${deckIds.size}`);
if (uiIds.size !== 34) errors.push(`expected exactly 34 baseline UI screens, found ${uiIds.size}`);

for (const deck of trace.decks ?? []) {
  if (!deck.id || !deck.title || !deck.path || !Number.isInteger(deck.slides) || deck.slides < 1) errors.push(`invalid deck entry: ${deck?.id ?? 'unknown'}`);
  if (!fs.existsSync(path.resolve(root, '..', deck.path))) errors.push(`deck source missing: ${deck.path}`);
}

for (const objective of trace.delivery_objectives ?? []) {
  if (!objective.id || objectiveIds.has(objective.id)) errors.push(`missing or duplicate objective id: ${objective?.id}`);
  objectiveIds.add(objective.id);
  if (!(objective.source_slides?.length > 0)) errors.push(`${objective.id} has no PPT source slides`);
  if (!(objective.ui?.length > 0)) errors.push(`${objective.id} has no UI mapping`);
  if (!objective.capability) errors.push(`${objective.id} has no capability definition`);
  for (const ref of objective.source_slides ?? []) {
    const match = /^([^:]+):S(\d+)$/.exec(ref);
    if (!match || !deckIds.has(match[1])) errors.push(`${objective.id} invalid slide ref: ${ref}`);
    else {
      const deck = trace.decks.find((d) => d.id === match[1]);
      if (Number(match[2]) > deck.slides) errors.push(`${objective.id} slide out of range: ${ref}`);
    }
  }
  for (const ui of objective.ui ?? []) if (!uiIds.has(ui)) errors.push(`${objective.id} unknown UI: ${ui}`);
  for (const scenario of objective.scenarios ?? []) if (!scenarioIds.has(scenario)) errors.push(`${objective.id} unknown scenario: ${scenario}`);
  for (const slice of objective.slices ?? []) if (!sliceIds.has(slice)) errors.push(`${objective.id} unknown slice: ${slice}`);
  if (!(objective.acceptance_tests?.length >= 2)) errors.push(`${objective.id} needs at least two acceptance tests`);
  for (const entry of objective.acceptance_tests ?? []) {
    const id = typeof entry === 'string' ? entry.split(':')[0] : Object.keys(entry ?? {})[0];
    if (!/^T-BL\d{2}-[A-Z0-9]+$/.test(id)) errors.push(`${objective.id} invalid test id: ${id}`);
    if (testIds.has(id)) errors.push(`duplicate test id: ${id}`);
    testIds.add(id);
  }
}

const coveredUi = new Set((trace.delivery_objectives ?? []).flatMap((o) => o.ui ?? []));
const uncoveredUi = [...uiIds].filter((ui) => !coveredUi.has(ui));
if (uncoveredUi.length) errors.push(`UI missing PPT delivery trace: ${uncoveredUi.join(', ')}`);
for (const deckId of deckIds) {
  if (!(trace.delivery_objectives ?? []).some((o) => (o.source_slides ?? []).some((ref) => ref.startsWith(`${deckId}:`)))) {
    errors.push(`deck not referenced by any delivery objective: ${deckId}`);
  }
}

console.log('FAMILY_PPT_UI_DELIVERY_TRACEABILITY_V1');
console.log(`decks=${deckIds.size}`);
console.log(`objectives=${objectiveIds.size}`);
console.log(`screens=${uiIds.size}`);
console.log(`acceptance_tests=${testIds.size}`);

if (errors.length) {
  console.error(`FAIL: ${errors.length} validation error(s)`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log('PASS: all 3 PPT baselines and current consumer UI screens are traceable to delivery objectives and tests');
}
