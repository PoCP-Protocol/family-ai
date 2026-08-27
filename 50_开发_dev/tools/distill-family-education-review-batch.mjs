#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const stagingDir = join(root, 'docs', 'model', 'distilled', '220k_staging');
const outputDir = join(root, 'docs', 'model', 'distilled', 'review_batch_v0_1');
const stagingManifestPath = join(stagingDir, 'manifest.json');
const targetRecords = Number(process.env.FAMILY_REVIEW_BATCH_TARGET ?? 22000);
const rel = (path) => relative(root, path).replace(/\\/g, '/');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function stableHash(value) {
  return createHash('sha256').update(value).digest('hex');
}

function compact(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function textFingerprint(record) {
  return stableHash(`${compact(record.prompt?.instruction)}\n${compact(record.prompt?.input)}\n${compact(record.response?.output)}`.toLowerCase());
}

function containsAny(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}

function riskSignals(record) {
  const text = `${record.prompt?.input ?? ''} ${record.response?.output ?? ''}`;
  const risks = [];
  if (containsAny(text, [/自杀|轻生|自残|suicide|self[- ]?harm/i])) risks.push('self_harm');
  if (containsAny(text, [/暴力|殴打|虐待|打死|abuse|violence/i])) risks.push('violence_or_abuse');
  if (containsAny(text, [/诊断|抑郁症|焦虑症|ADHD|孤独症|autism|diagnos/i])) risks.push('clinical_claim');
  if (containsAny(text, [/监控|偷看|定位|窃听|secretly|spy/i])) risks.push('surveillance_or_privacy');
  if (containsAny(text, [/保证|包好|彻底解决|100%|立刻见效/i])) risks.push('overclaim');
  if (record.safety?.high_risk_requires_human_gate) risks.push('source_high_risk_human_gate');
  return [...new Set(risks)];
}

function qualityAssessment(record) {
  const input = compact(record.prompt?.input);
  const output = compact(record.response?.output);
  const instruction = compact(record.prompt?.instruction);
  const risks = riskSignals(record);
  let score = 0;
  const flags = [];

  if (instruction.length >= 20) score += 10;
  else flags.push('short_instruction');
  if (input.length >= 12 && input.length <= 2000) score += 25;
  else flags.push('input_length_out_of_range');
  if (output.length >= 30 && output.length <= 4000) score += 35;
  else flags.push('output_length_out_of_range');
  if ((record.family_mapping?.domain_candidates ?? []).length > 1) score += 10;
  if (record.source?.source_line > 0) score += 5;
  if (record.response?.rationale) score += 5;
  if (risks.length === 0) score += 10;
  else score -= Math.min(20, risks.length * 5);

  const normalizedScore = Math.max(0, Math.min(100, score));
  return {
    score: normalizedScore,
    quality_band: normalizedScore >= 80 ? 'A_REVIEW_FIRST' : normalizedScore >= 65 ? 'B_REVIEW' : 'C_REVIEW_LATER',
    risk_route: risks.length > 0 ? 'HUMAN_GATE_REVIEW' : 'NORMAL_REVIEW',
    risk_signals: risks,
    flags,
  };
}

function quotaByAspect(stagingManifest) {
  const quotas = new Map();
  for (const source of stagingManifest.source_plan ?? []) {
    const quota = Math.round((source.quota / stagingManifest.target_records) * targetRecords);
    quotas.set(source.family_aspect, (quotas.get(source.family_aspect) ?? 0) + quota);
  }
  const total = [...quotas.values()].reduce((sum, quota) => sum + quota, 0);
  if (total !== targetRecords) {
    const largest = [...quotas.entries()].sort((a, b) => b[1] - a[1])[0];
    quotas.set(largest[0], largest[1] + targetRecords - total);
  }
  return quotas;
}

function shouldKeep({ record, quotas, acceptedByAspect, seen }) {
  const aspect = record.family_mapping?.family_aspect ?? 'unknown';
  if ((acceptedByAspect.get(aspect) ?? 0) >= (quotas.get(aspect) ?? 0)) return false;
  const fingerprint = textFingerprint(record);
  if (seen.has(fingerprint)) return false;
  const quality = qualityAssessment(record);
  if (quality.score < 55) return false;
  return { aspect, fingerprint, quality };
}

function makeReviewRecord(record, reviewNumber, quality) {
  return {
    asset_ref: 'FAMILY_EDUCATION_DISTILLATION_REVIEW_BATCH_RECORD',
    version: '0.1.0',
    review_record_id: `FAM-EDU-REVIEW-V0-1-${String(reviewNumber).padStart(5, '0')}`,
    source_record_id: record.record_id,
    public_model_name_zh: record.public_model_name_zh,
    migration_status: 'DISTILLED_FOR_HUMAN_REVIEW',
    split: record.split,
    source: record.source,
    family_mapping: record.family_mapping,
    prompt: record.prompt,
    response: record.response,
    quality,
    review: {
      review_status: 'NEEDS_HUMAN_REVIEW',
      rights_status: 'UNKNOWN',
      evidence_level: 'E1',
      reviewer_decision: 'PENDING',
      eligible_after_review: ['eval_candidate', 'style_candidate', 'training_candidate_if_rights_cleared'],
    },
    authorization_boundary: record.authorization_boundary,
  };
}

async function main() {
  if (!existsSync(stagingManifestPath)) throw new Error(`${rel(stagingManifestPath)} missing; run pnpm run stage:family-model-220k first`);
  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

  const stagingManifest = readJson(stagingManifestPath);
  const stagingOutput = stagingManifest.outputs?.[0]?.path ? join(root, stagingManifest.outputs[0].path) : null;
  if (!stagingOutput || !existsSync(stagingOutput)) throw new Error('staging output missing');

  const quotas = quotaByAspect(stagingManifest);
  const acceptedByAspect = new Map([...quotas.keys()].map((aspect) => [aspect, 0]));
  const qualityBands = { A_REVIEW_FIRST: 0, B_REVIEW: 0, C_REVIEW_LATER: 0 };
  const riskRoutes = { NORMAL_REVIEW: 0, HUMAN_GATE_REVIEW: 0 };
  const seen = new Set();

  const outputPath = join(outputDir, 'family_education_review_batch.v0_1.jsonl');
  const manifestPath = join(outputDir, 'manifest.json');
  const out = createWriteStream(outputPath, { encoding: 'utf8' });

  let scanned = 0;
  let accepted = 0;
  let skippedDuplicateOrQuota = 0;
  let skippedLowQuality = 0;
  const lines = createInterface({ input: createReadStream(stagingOutput, { encoding: 'utf8' }), crlfDelay: Infinity });

  for await (const line of lines) {
    if (!line.trim()) continue;
    scanned += 1;
    const record = JSON.parse(line);
    const keep = shouldKeep({ record, quotas, acceptedByAspect, seen });
    if (!keep) {
      skippedDuplicateOrQuota += 1;
      continue;
    }
    if (keep.quality.score < 55) {
      skippedLowQuality += 1;
      continue;
    }

    seen.add(keep.fingerprint);
    accepted += 1;
    acceptedByAspect.set(keep.aspect, (acceptedByAspect.get(keep.aspect) ?? 0) + 1);
    qualityBands[keep.quality.quality_band] += 1;
    riskRoutes[keep.quality.risk_route] += 1;
    out.write(`${JSON.stringify(makeReviewRecord(record, accepted, keep.quality))}\n`);
    if (accepted >= targetRecords) break;
  }

  await new Promise((resolve, reject) => {
    out.end(resolve);
    out.on('error', reject);
  });

  const manifest = {
    asset_ref: 'FAMILY_EDUCATION_DISTILLATION_REVIEW_BATCH_MANIFEST',
    version: '0.1.0',
    generated_at: new Date().toISOString(),
    target_records: targetRecords,
    total_records: accepted,
    complete: accepted === targetRecords,
    source_manifest: rel(stagingManifestPath),
    source_output: rel(stagingOutput),
    output: { path: rel(outputPath), records: accepted },
    scanned_records: scanned,
    skipped_duplicate_or_quota: skippedDuplicateOrQuota,
    skipped_low_quality: skippedLowQuality,
    quotas_by_aspect: Object.fromEntries(quotas),
    accepted_by_aspect: Object.fromEntries(acceptedByAspect),
    quality_bands: qualityBands,
    risk_routes: riskRoutes,
    governance: {
      status: 'REVIEW_BATCH_ONLY',
      rights_status: 'UNKNOWN_UNTIL_REVIEWED',
      evidence_level_ceiling: 'E1',
      production_training_authorized: false,
      production_retrieval_authorized: false,
      database_write_authorized: false,
      core_ontology_write_authorized: false,
    },
  };

  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log('=== Family Education Review Batch Distillation ===');
  console.log(`TARGET ${targetRecords}`);
  console.log(`SCANNED ${scanned}`);
  console.log(`WROTE ${rel(outputPath)} records=${accepted}`);
  console.log(`WROTE ${rel(manifestPath)}`);
  for (const [aspect, quota] of quotas) console.log(`${aspect} accepted=${acceptedByAspect.get(aspect) ?? 0} quota=${quota}`);
  if (!manifest.complete) process.exit(1);
}

await main();