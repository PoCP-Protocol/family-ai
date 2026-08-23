#!/usr/bin/env node
import { createReadStream, createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const outputDir = join(root, 'docs', 'model', 'distilled', '220k_staging');
const rel = (path) => relative(root, path).replace(/\\/g, '/');

const targetRecords = Number(process.env.FAMILY_220K_TARGET ?? 220000);
const maxInvalidPerSource = Number(process.env.FAMILY_220K_MAX_INVALID_PER_SOURCE ?? 25);

const manifests = [
  {
    package_id: 'bole-family-education',
    source_system: 'bole-ai',
    manifest_path: join(root, 'integrations', 'sources', 'bole-ai', 'distillation', 'MANIFEST.json'),
  },
  {
    package_id: 'joysoul-aisoul',
    source_system: 'joysoul-via-aisoul-bole-ai-search',
    manifest_path: join(root, 'integrations', 'sources', 'bole-ai', 'joysoul', 'MANIFEST.json'),
  },
];

const sourcePlan = [
  { package_id: 'bole-family-education', file: 'family_edu_train_mix.jsonl', quota: 9999, family_aspect: 'family_education_core_sft' },
  { package_id: 'bole-family-education', file: 'family_edu_sft.jsonl', quota: 6322, family_aspect: 'family_education_core_sft' },
  { package_id: 'bole-family-education', file: 'short_video_signals_ingested.jsonl', quota: 0, family_aspect: 'family_pain_signal' },
  { package_id: 'joysoul-aisoul', file: 'joysoul_train_ready_v2.gold.clean.jsonl', quota: 52000, family_aspect: 'broad_parent_child_dialogue' },
  { package_id: 'joysoul-aisoul', file: 'joysoul_exemplar_bank.jsonl', quota: 42000, family_aspect: 'exemplar_response_candidate' },
  { package_id: 'joysoul-aisoul', file: 'joysoul_distill_api.jsonl', quota: 39679, family_aspect: 'distilled_instruction_response' },
  { package_id: 'joysoul-aisoul', file: 'joysoul_distill_multilang.jsonl', quota: 18000, family_aspect: 'multilingual_family_expression' },
  { package_id: 'joysoul-aisoul', file: 'joysoul_distill_recX_v4sft.jsonl', quota: 16000, family_aspect: 'recommendation_style_candidate' },
  { package_id: 'joysoul-aisoul', file: 'joysoul_ft_v4_sft.jsonl', quota: 14000, family_aspect: 'chat_sft_candidate' },
  { package_id: 'joysoul-aisoul', file: 'joysoul_ft_review.jsonl', quota: 9000, family_aspect: 'reviewed_chat_candidate' },
  { package_id: 'joysoul-aisoul', file: 'joysoul_ft_legalclean.jsonl', quota: 5000, family_aspect: 'legalclean_chat_candidate' },
  { package_id: 'joysoul-aisoul', file: 'joysoul_needs_expert_v2.jsonl', quota: 5000, family_aspect: 'expert_review_needed' },
  { package_id: 'joysoul-aisoul', file: 'joysoul_distill_fleet_scenexp.jsonl', quota: 3000, family_aspect: 'scenario_explanation_candidate' },
];

const totalQuota = sourcePlan.reduce((sum, source) => sum + source.quota, 0);
if (totalQuota !== targetRecords) {
  throw new Error(`sourcePlan quota ${totalQuota} does not match target ${targetRecords}`);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function loadSourceIndex() {
  const index = new Map();
  for (const manifestRef of manifests) {
    const manifest = readJson(manifestRef.manifest_path);
    for (const source of manifest.files ?? []) {
      index.set(`${manifestRef.package_id}:${source.file}`, {
        ...source,
        package_id: manifestRef.package_id,
        source_system: manifestRef.source_system,
        manifest_path: manifestRef.manifest_path,
        governance: manifest.governance ?? {},
      });
    }
  }
  return index;
}

function sourcePathFor(source) {
  if (source.sourcePath && existsSync(source.sourcePath)) return source.sourcePath;
  const stagedPath = join(root, 'integrations', 'sources', 'bole-ai', source.package_id === 'joysoul-aisoul' ? 'joysoul' : 'distillation', source.file);
  if (existsSync(stagedPath)) return stagedPath;
  return null;
}

function compactText(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  return JSON.stringify(value);
}

function normalizeMessages(messages) {
  if (!Array.isArray(messages)) return null;
  const user = messages.find((message) => message?.role === 'user')?.content ?? messages[0]?.content ?? '';
  const assistant = [...messages].reverse().find((message) => message?.role === 'assistant')?.content ?? messages.at(-1)?.content ?? '';
  return {
    instruction: 'Respond to the family education conversation in the 法咪莉校长 style after review.',
    input: compactText(user),
    output: compactText(assistant),
    messages: messages.map((message) => ({ role: message?.role ?? 'unknown', content: compactText(message?.content) })),
  };
}

function normalizeRecord(raw) {
  if (Array.isArray(raw?.messages)) return normalizeMessages(raw.messages);
  if (typeof raw?.q === 'string' || typeof raw?.a === 'string') {
    return {
      instruction: 'Answer the family education question after Family review.',
      input: compactText(raw.q),
      output: compactText(raw.a),
      rationale: compactText(raw.rat),
    };
  }
  if (typeof raw?.text === 'string' || typeof raw?.snippet === 'string') {
    return {
      instruction: 'Classify and rewrite this family education source signal as a candidate scenario.',
      input: compactText(raw.text ?? raw.snippet),
      output: compactText(raw.absorb ?? raw.title ?? raw.videoTitle ?? ''),
    };
  }
  return {
    instruction: compactText(raw?.instruction),
    input: compactText(raw?.input),
    output: compactText(raw?.output),
    rationale: compactText(raw?.rationale),
  };
}

function inferDomainCandidates(normalized, sourcePlanItem) {
  const text = `${normalized.instruction} ${normalized.input} ${normalized.output}`;
  const candidates = new Set([sourcePlanItem.family_aspect]);
  if (/作业|学习|成绩|考试|school|homework/i.test(text)) candidates.add('learning_and_school');
  if (/情绪|哭|焦虑|压力|emotion|anxiety/i.test(text)) candidates.add('emotion_and_regulation');
  if (/沟通|冲突|亲子|parent|child|关系/i.test(text)) candidates.add('parent_child_relationship');
  if (/手机|游戏|屏幕|video|screen|game/i.test(text)) candidates.add('digital_habit_and_media');
  if (/青春|青春期|叛逆|teen|adolescent/i.test(text)) candidates.add('adolescent_development');
  if (/安全|风险|伤害|自杀|暴力|abuse|harm/i.test(text)) candidates.add('high_risk_human_gate');
  return [...candidates];
}

function splitFor(recordNumber) {
  const bucket = recordNumber % 20;
  if (bucket === 0) return 'test';
  if (bucket === 1) return 'validation';
  return 'train_candidate';
}

function hasUsefulText(normalized) {
  return compactText(normalized.input).length > 0 && compactText(normalized.output).length > 0;
}

function makeStagingRecord({ raw, normalized, source, sourcePath, sourcePlanItem, sourceLine, recordNumber }) {
  return {
    asset_ref: 'FAMILY_EDUCATION_220K_DISTILLATION_STAGING_RECORD',
    version: '0.1.0',
    record_id: `FAM-EDU-220K-STAGE-${String(recordNumber).padStart(6, '0')}`,
    split: splitFor(recordNumber),
    public_model_name_zh: '法咪莉校长',
    migration_status: 'CANDIDATE_STAGED_FOR_REVIEW',
    source: {
      package_id: source.package_id,
      source_system: source.source_system,
      file: source.file,
      source_path: sourcePath,
      source_line: sourceLine,
      source_sha256: source.sha256,
      source_manifest: rel(source.manifest_path),
      source_keys: source.keys ?? [],
      rights_status: 'UNKNOWN',
      evidence_level: 'E1',
      review_status: 'NEEDS_HUMAN_REVIEW',
    },
    family_mapping: {
      family_aspect: sourcePlanItem.family_aspect,
      domain_candidates: inferDomainCandidates(normalized, sourcePlanItem),
      task_type: Array.isArray(raw?.messages) ? 'chat_messages' : raw?.q ? 'qa_pair' : raw?.text || raw?.snippet ? 'source_signal' : 'instruction_response',
      allowed_current_use: ['offline_analysis', 'deduplication', 'human_review_queue', 'eval_candidate'],
      forbidden_current_use: ['production_training', 'production_retrieval', 'core_ontology_write', 'family_database_write'],
    },
    prompt: {
      instruction: normalized.instruction,
      input: normalized.input,
    },
    response: {
      output: normalized.output,
      rationale: normalized.rationale ?? '',
      messages: normalized.messages ?? undefined,
    },
    safety: {
      personal_data_risk: 'UNVERIFIED',
      minor_data_risk: 'UNVERIFIED',
      high_risk_requires_human_gate: inferDomainCandidates(normalized, sourcePlanItem).includes('high_risk_human_gate'),
      model_gateway_required_for_future_live_ai: true,
    },
    authorization_boundary: {
      live_external_ai: 'NOT_INVOKED',
      business_runtime: 'NOT_TOUCHED',
      database_schema_change: 'NOT_TOUCHED',
      core_ontology_mutation: 'NOT_TOUCHED',
    },
  };
}

async function* readJsonl(path) {
  const stream = createReadStream(path, { encoding: 'utf8' });
  const lines = createInterface({ input: stream, crlfDelay: Infinity });
  let lineNumber = 0;
  for await (const line of lines) {
    lineNumber += 1;
    if (!line.trim()) continue;
    yield { line, lineNumber };
  }
}

async function stageSource({ sourcePlanItem, source, outStream, manifest }) {
  const path = sourcePathFor(source);
  const sourceSummary = {
    package_id: source.package_id,
    file: source.file,
    source_path: path,
    quota: sourcePlanItem.quota,
    staged: 0,
    skipped_invalid_json: 0,
    skipped_not_useful: 0,
    status: 'PENDING',
  };

  if (!path) {
    sourceSummary.status = 'SOURCE_MISSING';
    manifest.sources.push(sourceSummary);
    return;
  }

  let invalidSamples = 0;
  for await (const { line, lineNumber } of readJsonl(path)) {
    if (sourceSummary.staged >= sourcePlanItem.quota) break;

    let raw;
    try {
      raw = JSON.parse(line);
    } catch {
      sourceSummary.skipped_invalid_json += 1;
      invalidSamples += 1;
      if (invalidSamples > maxInvalidPerSource) break;
      continue;
    }

    const normalized = normalizeRecord(raw);
    if (!hasUsefulText(normalized)) {
      sourceSummary.skipped_not_useful += 1;
      continue;
    }

    const recordNumber = manifest.total_records + 1;
    const stagedRecord = makeStagingRecord({ raw, normalized, source, sourcePath: path, sourcePlanItem, sourceLine: lineNumber, recordNumber });
    outStream.write(`${JSON.stringify(stagedRecord)}\n`);
    sourceSummary.staged += 1;
    manifest.total_records += 1;
    manifest.splits[stagedRecord.split] += 1;
  }

  sourceSummary.status = sourceSummary.staged === sourcePlanItem.quota ? 'COMPLETE' : 'PARTIAL';
  manifest.sources.push(sourceSummary);
}

if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

const sourceIndex = loadSourceIndex();
const outputPath = join(outputDir, 'family_education_220k_staging.v0_1.jsonl');
const manifestPath = join(outputDir, 'manifest.json');
const outStream = createWriteStream(outputPath, { encoding: 'utf8' });
const manifest = {
  asset_ref: 'FAMILY_EDUCATION_220K_DISTILLATION_STAGING_MANIFEST',
  version: '0.1.0',
  generated_at: new Date().toISOString(),
  target_records: targetRecords,
  total_records: 0,
  public_model_name_zh: '法咪莉校长',
  purpose: 'Stage Bole.ai and JoySoul distilled family-education data for Family review, deduplication, eval construction, and later training-readiness decisions.',
  governance: {
    status: 'STAGING_ONLY',
    rights_status: 'UNKNOWN_UNTIL_REVIEWED',
    evidence_level_ceiling: 'E1',
    production_training_authorized: false,
    production_retrieval_authorized: false,
    database_write_authorized: false,
    core_ontology_write_authorized: false,
  },
  source_plan: sourcePlan,
  splits: { train_candidate: 0, validation: 0, test: 0 },
  sources: [],
};

for (const sourcePlanItem of sourcePlan) {
  const source = sourceIndex.get(`${sourcePlanItem.package_id}:${sourcePlanItem.file}`);
  if (!source) {
    manifest.sources.push({ ...sourcePlanItem, status: 'NOT_IN_MANIFEST', staged: 0 });
    continue;
  }
  await stageSource({ sourcePlanItem, source, outStream, manifest });
}

await new Promise((resolve, reject) => {
  outStream.end(resolve);
  outStream.on('error', reject);
});
manifest.outputs = [{ path: rel(outputPath), records: manifest.total_records }];
manifest.complete = manifest.total_records === targetRecords;
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

console.log('=== Family Education 220K Staging Corpus ===');
console.log(`TARGET ${targetRecords}`);
console.log(`WROTE ${rel(outputPath)} records=${manifest.total_records}`);
console.log(`WROTE ${rel(manifestPath)}`);
for (const source of manifest.sources) {
  console.log(`${source.status} ${source.package_id}/${source.file} staged=${source.staged ?? 0} quota=${source.quota ?? '-'}`);
}

if (!manifest.complete) process.exit(1);