#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const errors = [];
const assert = (condition, message) => { if (!condition) errors.push(message); };
const read = (p) => fs.readFileSync(p, 'utf8');

const invariantsPath = path.join(root, 'governance', 'FAMILY_ARCHITECTURE_INVARIANTS_V4_1.json');
const matrixPath = path.join(root, 'governance', 'FAMILY_35UI_RUNTIME_MATRIX_V1.json');
const canonicalContractPath = path.join(root, 'packages', 'contracts', 'src', 'family-35ui.ts');
const legacyContractPath = path.join(root, 'packages', 'contracts', 'src', 'family-growth-os.ts');
const programPath = path.join(root, 'governance', 'FAMILY_35UI_PROGRAM_V1.yaml');
const architecturePath = path.join(root, 'architecture', 'FAMILY_AI_PLATFORM_TECH_ARCHITECTURE_V4_1.md');

for (const p of [invariantsPath, matrixPath, canonicalContractPath, legacyContractPath, programPath, architecturePath]) {
  assert(fs.existsSync(p), `missing required V4.1 artifact: ${p}`);
}
if (errors.length) finish();

const invariants = JSON.parse(read(invariantsPath));
const matrix = JSON.parse(read(matrixPath));
const exactSet = (a, b) => a.length === b.length && a.every((value) => b.includes(value)) && b.every((value) => a.includes(value));

assert(invariants.architecture_id === 'FAMILY_AI_PLATFORM_V4_1', 'wrong architecture id');
assert(matrix.architecture_version === 'FAMILY_AI_PLATFORM_V4_1', 'matrix architecture_version must be V4.1');
assert(exactSet(matrix.loops, invariants.canonical_business_loops), 'matrix canonical business loops drift');
assert(exactSet(matrix.domains, invariants.canonical_business_domains), 'matrix canonical business domains drift');
assert(exactSet(matrix.cross_domain_platforms ?? [], invariants.cross_domain_platforms), 'matrix cross-domain platforms drift');

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
assert(!/Family35UiId|Family35BusinessLoop/.test(canonical), 'temporary Family35* aliases must be removed');
for (const loop of invariants.canonical_business_loops) assert(canonical.includes(`'${loop}'`), `canonical loop ${loop} missing`);
for (const domain of invariants.canonical_business_domains) assert(canonical.includes(`'${domain}'`), `canonical domain ${domain} missing`);

const legacy = read(legacyContractPath);
assert(/LegacyFamilySurfaceLoop/.test(legacy), 'legacy surface loop type must be explicitly named');
assert(!/export type FamilyBusinessLoop\b/.test(legacy), 'legacy file must not export canonical FamilyBusinessLoop');
assert(!/export type FamilyUiId\b/.test(legacy), 'legacy file must not export duplicate FamilyUiId');
assert(/LEGACY_FAMILY_SURFACE_LOOPS/.test(legacy), 'legacy loop constant must be explicitly named');
assert(!/export const FAMILY_BUSINESS_LOOPS\b/.test(legacy), 'legacy file must not export canonical FAMILY_BUSINESS_LOOPS');

const program = read(programPath);
assert(program.includes('FAMILY_AI_PLATFORM_TECH_ARCHITECTURE_V4_1.md'), 'program must point to V4.1 SSOT');
assert(program.includes('FAMILY_AI_PLATFORM_V4_1'), 'program architecture id must be V4.1');

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
