#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const errors = [];
const assert = (condition, message) => { if (!condition) errors.push(message); };
const read = (p) => fs.readFileSync(p, 'utf8');

const invariantsPath = path.join(root, 'governance', 'FAMILY_ARCHITECTURE_INVARIANTS_V4_1.json');
const matrixPath = path.join(root, 'governance', 'FAMILY_CONSUMER_UI_BASELINE_V1.json');
const canonicalContractPath = path.join(root, 'packages', 'contracts', 'src', 'consumer-ui-baseline.ts');
const growthEpisodeContractPath = path.join(root, 'packages', 'contracts', 'src', 'growth-episode.ts');
const legacyContractPath = path.join(root, 'packages', 'contracts', 'src', 'family-growth-os.ts');
const programPath = path.join(root, 'governance', 'FAMILY_CONSUMER_UI_PROGRAM_V1.yaml');
const subtractiveFreezePath = path.join(root, 'governance', 'FAMILY_SUBTRACTIVE_FREEZE_V1.json');
const aiRuntimeBoundaryPath = path.join(root, 'governance', 'FAMILY_AI_RUNTIME_BOUNDARY_V1.json');
const canonicalUiMapPath = path.join(root, 'governance', 'FAMILY_UI_CANONICAL_MAP_V1.json');
const functionalUiRebaselinePath = path.join(root, 'governance', 'FAMILY_UI_FUNCTIONAL_REALIZATION_REBASELINE_V1.json');
const architecturePath = path.join(root, 'architecture', 'FAMILY_AI_PLATFORM_TECH_ARCHITECTURE_V4_1.md');
const harnessBoundaryPath = path.join(root, 'architecture', 'FAMILY_INTELLIGENCE_OS_HARNESS_BOUNDARY_V0_1.md');
const harnessPackagePath = path.join(root, 'packages', 'harness', 'src', 'index.ts');
const rootPackagePath = path.join(root, 'package.json');

for (const p of [invariantsPath, matrixPath, canonicalContractPath, growthEpisodeContractPath, legacyContractPath, programPath, subtractiveFreezePath, aiRuntimeBoundaryPath, canonicalUiMapPath, functionalUiRebaselinePath, architecturePath, harnessBoundaryPath, harnessPackagePath, rootPackagePath]) {
  assert(fs.existsSync(p), `missing required V4.1 artifact: ${p}`);
}
if (errors.length) finish();

const invariants = JSON.parse(read(invariantsPath));
const matrix = JSON.parse(read(matrixPath));
const subtractiveFreeze = JSON.parse(read(subtractiveFreezePath));
const aiRuntimeBoundary = JSON.parse(read(aiRuntimeBoundaryPath));
const canonicalUiMap = JSON.parse(read(canonicalUiMapPath));
const functionalUiRebaseline = JSON.parse(read(functionalUiRebaselinePath));
const rootPackage = JSON.parse(read(rootPackagePath));
const exactSet = (a, b) => a.length === b.length && a.every((value) => b.includes(value)) && b.every((value) => a.includes(value));

assert(invariants.architecture_id === 'FAMILY_AI_PLATFORM_V4_1', 'wrong architecture id');
assert(matrix.architecture_version === 'FAMILY_AI_PLATFORM_V4_1', 'matrix architecture_version must be V4.1');
assert(subtractiveFreeze.architecture_id === 'FAMILY_AI_PLATFORM_V4_1', 'subtractive freeze architecture_id must be V4.1');
assert(subtractiveFreeze.status === 'ACTIVE', 'subtractive freeze must be ACTIVE');
assert(aiRuntimeBoundary.architecture_id === 'FAMILY_AI_PLATFORM_V4_1', 'AI runtime boundary architecture_id must be V4.1');
assert(aiRuntimeBoundary.status === 'ACTIVE', 'AI runtime boundary must be ACTIVE');
assert(aiRuntimeBoundary.allowed_live_external_ai?.status === 'FAMILY_API_MODEL_GATEWAY_ONLY', 'AI runtime must only allow live external AI through Family API Model Gateway');
assert(canonicalUiMap.architecture_id === 'FAMILY_AI_PLATFORM_V4_1', 'UI canonical map architecture_id must be V4.1');
assert(canonicalUiMap.status === 'ACTIVE', 'UI canonical map must be ACTIVE');
assert(canonicalUiMap.numbering_decision?.ui35_status === 'DELETED_DUPLICATE_PRODUCT_SURFACE', 'UI canonical map must preserve UI-35 deletion decision');
assert(functionalUiRebaseline.architecture_id === 'FAMILY_AI_PLATFORM_V4_1', 'UI functional rebaseline architecture_id must be V4.1');
assert(functionalUiRebaseline.status === 'ACTIVE', 'UI functional rebaseline must be ACTIVE');
assert((functionalUiRebaseline.screen_depths ?? []).length === 34, 'UI functional rebaseline must track all 34 screens');
assert(exactSet(matrix.loops, invariants.canonical_business_loops), 'matrix canonical business loops drift');
assert(exactSet(matrix.domains, invariants.canonical_business_domains), 'matrix canonical business domains drift');
assert(exactSet(matrix.cross_domain_platforms ?? [], invariants.cross_domain_platforms), 'matrix cross-domain platforms drift');

const allowedRootScripts = new Set(subtractiveFreeze.allowed_runtime_entrypoints ?? []);
const frozenRootScripts = new Set((subtractiveFreeze.frozen_root_scripts ?? []).map((entry) => entry.name));
const forbiddenRootScripts = new Set(subtractiveFreeze.forbidden_root_scripts ?? []);
const forbiddenRootScriptPrefixes = subtractiveFreeze.forbidden_root_script_prefixes ?? [];
for (const name of Object.keys(rootPackage.scripts ?? {})) {
  assert(allowedRootScripts.has(name), `root script is not in the V4.1 subtractive allowlist: ${name}`);
  assert(!frozenRootScripts.has(name), `frozen root script is still exposed: ${name}`);
  assert(!forbiddenRootScripts.has(name), `forbidden root script is still exposed: ${name}`);
  for (const prefix of forbiddenRootScriptPrefixes) {
    assert(!name.startsWith(prefix), `forbidden root script prefix is still exposed: ${name}`);
  }
}

for (const screen of matrix.screens) {
  assert(invariants.canonical_business_loops.includes(screen.loop), `${screen.ui_id}: non-canonical business loop`);
  assert(invariants.canonical_business_domains.includes(screen.primary_domain), `${screen.ui_id}: non-canonical primary domain`);
  for (const domain of screen.supporting_domains ?? []) {
    assert(invariants.canonical_business_domains.includes(domain), `${screen.ui_id}: non-canonical supporting domain ${domain}`);
  }
  for (const platform of screen.platform_dependencies ?? []) {
    assert(invariants.cross_domain_platforms.includes(platform), `${screen.ui_id}: invalid platform dependency ${platform}`);
  }
  assert(!(screen.supporting_domains ?? []).includes('FAMILY_CONTEXT'), `${screen.ui_id}: FAMILY_CONTEXT cannot remain a domain`);
  assert(screen.primary_domain !== 'FAMILY_CONTEXT', `${screen.ui_id}: FAMILY_CONTEXT cannot be primary domain`);
  assert(screen.primary_domain !== 'RESOURCE_COMMERCE', `${screen.ui_id}: RESOURCE_COMMERCE must be split`);
  assert(!(screen.supporting_domains ?? []).includes('RESOURCE_COMMERCE'), `${screen.ui_id}: RESOURCE_COMMERCE must be split`);
  if ((screen.ai_use_cases ?? []).length > 0) {
    assert(screen.target_ai_control_plane === 'FAMILY_AI_CONTROL_PLANE', `${screen.ui_id}: target AI control plane drift`);
    assert(['FAMILY_LLM_GATEWAY', 'NONE'].includes(screen.runtime_ai_adapter), `${screen.ui_id}: invalid runtime AI adapter`);
  } else {
    assert(screen.target_ai_control_plane === 'NONE', `${screen.ui_id}: non-AI screen target plane must be NONE`);
  }
}

const canonical = read(canonicalContractPath);
assert(/export type FamilyUiId\b/.test(canonical), 'canonical FamilyUiId missing');
assert(/export type FamilyBusinessLoop\b/.test(canonical), 'canonical FamilyBusinessLoop missing');
assert(!/Familylegacy UIId|Family35BusinessLoop/.test(canonical), 'temporary Family35* aliases must be removed');
for (const loop of invariants.canonical_business_loops) assert(canonical.includes(`'${loop}'`), `canonical loop ${loop} missing`);
for (const domain of invariants.canonical_business_domains) assert(canonical.includes(`'${domain}'`), `canonical domain ${domain} missing`);

const growthEpisode = read(growthEpisodeContractPath);
for (const required of [
  'export interface GrowthEpisodeDto',
  'PROGRAM',
  'JOURNEY',
  'AI_GUIDED',
  'HUMAN_SERVICE',
  'HYBRID',
  'GROWTH_EPISODE_IS_SUPPORT_PROCESS_NOT_OUTCOME',
  'EPISODE_STATE_CHANGES_REQUIRE_NAMED_ACTION',
  'OUTCOME_OBSERVATION_REQUIRED_BEFORE_COMPLETION_CLAIM',
]) {
  assert(growthEpisode.includes(required), `GrowthEpisode contract missing marker: ${required}`);
}
assert(!/family_total_score|family_ranking/i.test(growthEpisode), 'GrowthEpisode contract must not introduce score/ranking semantics');

const legacy = read(legacyContractPath);
assert(/LegacyFamilySurfaceLoop/.test(legacy), 'legacy surface loop type must be explicitly named');
assert(!/export type FamilyBusinessLoop\b/.test(legacy), 'legacy file must not export canonical FamilyBusinessLoop');
assert(!/export type FamilyUiId\b/.test(legacy), 'legacy file must not export duplicate FamilyUiId');
assert(/LEGACY_FAMILY_SURFACE_LOOPS/.test(legacy), 'legacy loop constant must be explicitly named');
assert(!/export const FAMILY_BUSINESS_LOOPS\b/.test(legacy), 'legacy file must not export canonical FAMILY_BUSINESS_LOOPS');

const program = read(programPath);
assert(program.includes('FAMILY_AI_PLATFORM_TECH_ARCHITECTURE_V4_1.md'), 'program must point to V4.1 SSOT');
assert(program.includes('FAMILY_AI_PLATFORM_V4_1'), 'program architecture id must be V4.1');

const architecture = read(architecturePath);
const harnessBoundary = read(harnessBoundaryPath);
const harnessPackage = read(harnessPackagePath);
for (const required of ['FamilyHarnessAdapter', 'Codex App Server JSON-RPC', 'NO_AGENT_DIRECT_DATABASE_WRITE']) {
  assert(architecture.includes(required), `V4.1 architecture missing harness boundary marker: ${required}`);
  assert(harnessBoundary.includes(required), `harness boundary contract missing marker: ${required}`);
}
for (const tool of ['get_family_context', 'get_family_now', 'propose_growth_action', 'request_human_review']) {
  assert(harnessPackage.includes(tool), `harness package missing allowed tool: ${tool}`);
}
for (const forbidden of ['execute_sql', 'write_growth_profile', 'generic_patch_core_object']) {
  assert(harnessPackage.includes(forbidden), `harness package missing forbidden tool guard: ${forbidden}`);
}

console.log('FAMILY_AI_PLATFORM_V4_1_ARCHITECTURE_GATE');
console.log(`screens=${matrix.screens.length}`);
console.log(`loops=${matrix.loops.join(',')}`);
console.log(`domains=${matrix.domains.join(',')}`);
console.log(`platforms=${(matrix.cross_domain_platforms ?? []).join(',')}`);
finish();

function finish() {
  if (errors.length) {
    console.error(`FAIL: ${errors.length} V4.1 architecture error(s)`);
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log('PASS: FAMILY_AI_PLATFORM_V4_1 architecture contract');
}
