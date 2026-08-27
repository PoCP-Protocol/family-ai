#!/usr/bin/env node
import { createReadStream, createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const reviewDir = join(root, 'docs', 'model', 'distilled', 'review_batch_v0_1');
const outputDir = join(root, 'docs', 'model', 'distilled', 'subsets_v0_1');
const reviewManifestPath = join(reviewDir, 'manifest.json');
const rel = (path) => relative(root, path).replace(/\\/g, '/');

const subsetSpecs = [
  {
    subset_ref: 'golden_eval_set',
    target_records: Number(process.env.FAMILY_GOLDEN_EVAL_TARGET ?? 1200),
    path: 'family_education_golden_eval_set.v0_1.jsonl',
    eligibility: (record) =>
      record.quality?.risk_route === 'NORMAL_REVIEW' &&
      ['A_REVIEW_FIRST', 'B_REVIEW'].includes(record.quality?.quality_band) &&
      (record.family_mapping?.domain_candidates ?? []).length >= 2,
    governance_status: 'EVAL_CANDIDATE_ONLY',
  },
  {
    subset_ref: 'style_imitation_candidate',
    target_records: Number(process.env.FAMILY_STYLE_CANDIDATE_TARGET ?? 6000),
    path: 'family_education_style_imitation_candidate.v0_1.jsonl',
    eligibility: (record) =>
      record.quality?.risk_route === 'NORMAL_REVIEW' &&
      record.quality?.quality_band === 'A_REVIEW_FIRST' &&
      compact(record.response?.output).length >= 80,
    governance_status: 'STYLE_CANDIDATE_REVIEW_ONLY',
  },
  {
    subset_ref: 'risk_human_gate_set',
    target_records: Number(process.env.FAMILY_RISK_GATE_TARGET ?? 6000),
    path: 'family_education_risk_human_gate_set.v0_1.jsonl',
    eligibility: (record) => record.quality?.risk_route === 'HUMAN_GATE_REVIEW',
    governance_status: 'HUMAN_GATE_REVIEW_ONLY',
  },
  {
    subset_ref: 'training_candidate_if_rights_cleared',
    target_records: Number(process.env.FAMILY_TRAINING_CANDIDATE_TARGET ?? 10000),
    path: 'family_education_training_candidate_if_rights_cleared.v0_1.jsonl',
    eligibility: (record) =>
      record.quality?.risk_route === 'NORMAL_REVIEW' &&
      record.quality?.quality_band === 'A_REVIEW_FIRST' &&
      record.review?.rights_status === 'UNKNOWN' &&
      record.review?.review_status === 'NEEDS_HUMAN_REVIEW',
    governance_status: 'TRAINING_CANDIDATE_BLOCKED_UNTIL_RIGHTS_CLEARED',
  },
];

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function compact(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function makeSubsetRecord(record, subsetRef, subsetNumber) {
  return {
    asset_ref: 'FAMILY_EDUCATION_DISTILLATION_SUBSET_RECORD',
    version: '0.1.0',
    subset_ref: subsetRef,
    subset_record_id: `FAM-EDU-${subsetRef.toUpperCase().replace(/[^A-Z0-9]+/g, '-')}-V0-1-${String(subsetNumber).padStart(5, '0')}`,
    source_review_record_id: record.review_record_id,
    source_record_id: record.source_record_id,
    public_model_name_zh: record.public_model_name_zh,
    migration_status: 'DISTILLED_TO_REVIEW_SUBSET',
    split: record.split,
    source: record.source,
    family_mapping: record.family_mapping,
    prompt: record.prompt,
    response: record.response,
    quality: record.quality,
    review: {
      ...record.review,
      subset_decision: 'PENDING_HUMAN_REVIEW',
      production_training_authorized: false,
      production_retrieval_authorized: false,
    },
    authorization_boundary: record.authorization_boundary,
  };
}

function chooseBalanced(records, target) {
  const byAspect = new Map();
  for (const record of records) {
    const aspect = record.family_mapping?.family_aspect ?? 'unknown';
    if (!byAspect.has(aspect)) byAspect.set(aspect, []);
    byAspect.get(aspect).push(record);
  }

  const selected = [];
  while (selected.length < target) {
    let advanced = false;
    for (const group of byAspect.values()) {
      const next = group.shift();
      if (!next) continue;
      selected.push(next);
      advanced = true;
      if (selected.length >= target) break;
    }
    if (!advanced) break;
  }
  return selected;
}

async function loadReviewRecords(path) {
  const records = [];
  const lines = createInterface({ input: createReadStream(path, { encoding: 'utf8' }), crlfDelay: Infinity });
  for await (const line of lines) {
    if (!line.trim()) continue;
    records.push(JSON.parse(line));
  }
  return records;
}

async function writeSubset(spec, records) {
  const outputPath = join(outputDir, spec.path);
  const selected = chooseBalanced(records.filter(spec.eligibility), spec.target_records);
  const byQuality = {};
  const byRiskRoute = {};
  const byAspect = {};
  const out = createWriteStream(outputPath, { encoding: 'utf8' });

  selected.forEach((record, index) => {
    byQuality[record.quality?.quality_band ?? 'UNKNOWN'] = (byQuality[record.quality?.quality_band ?? 'UNKNOWN'] ?? 0) + 1;
    byRiskRoute[record.quality?.risk_route ?? 'UNKNOWN'] = (byRiskRoute[record.quality?.risk_route ?? 'UNKNOWN'] ?? 0) + 1;
    byAspect[record.family_mapping?.family_aspect ?? 'unknown'] = (byAspect[record.family_mapping?.family_aspect ?? 'unknown'] ?? 0) + 1;
    out.write(`${JSON.stringify(makeSubsetRecord(record, spec.subset_ref, index + 1))}\n`);
  });

  await new Promise((resolve, reject) => {
    out.end(resolve);
    out.on('error', reject);
  });

  return {
    subset_ref: spec.subset_ref,
    path: rel(outputPath),
    target_records: spec.target_records,
    records: selected.length,
    complete: selected.length === spec.target_records,
    governance_status: spec.governance_status,
    quality_bands: byQuality,
    risk_routes: byRiskRoute,
    accepted_by_aspect: byAspect,
  };
}

async function main() {
  if (!existsSync(reviewManifestPath)) throw new Error(`${rel(reviewManifestPath)} missing; run pnpm run distill:family-model-review-batch first`);
  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

  const reviewManifest = readJson(reviewManifestPath);
  const reviewOutput = reviewManifest.output?.path ? join(root, reviewManifest.output.path) : null;
  if (!reviewOutput || !existsSync(reviewOutput)) throw new Error('review batch output missing');

  const records = await loadReviewRecords(reviewOutput);
  const outputs = [];
  for (const spec of subsetSpecs) outputs.push(await writeSubset(spec, records));

  const manifestPath = join(outputDir, 'manifest.json');
  const manifest = {
    asset_ref: 'FAMILY_EDUCATION_DISTILLATION_SUBSET_MANIFEST',
    version: '0.1.0',
    generated_at: new Date().toISOString(),
    source_manifest: rel(reviewManifestPath),
    source_output: rel(reviewOutput),
    source_records: records.length,
    outputs,
    governance: {
      status: 'SUBSET_REVIEW_ONLY',
      rights_status: 'UNKNOWN_UNTIL_REVIEWED',
      evidence_level_ceiling: 'E1',
      production_training_authorized: false,
      production_retrieval_authorized: false,
      database_write_authorized: false,
      core_ontology_write_authorized: false,
      allowed_uses_before_review: ['offline_eval_candidate_review', 'safety_review_queue', 'style_review_queue'],
    },
  };

  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log('=== Family Education Distillation Subsets ===');
  for (const output of outputs) console.log(`WROTE ${output.path} records=${output.records}/${output.target_records} complete=${output.complete}`);
  console.log(`WROTE ${rel(manifestPath)}`);
}

await main();