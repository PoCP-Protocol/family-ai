#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as YAML from 'js-yaml';

const loadYaml = YAML.load ?? YAML.default?.load;
const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const modelDir = join(root, 'docs', 'model');
const outputDir = join(root, 'docs', 'model', 'distilled');

const readYaml = (fileName) => loadYaml(readFileSync(join(modelDir, fileName), 'utf8'));
const byRef = (items, refName) => new Map((items ?? []).map((item) => [item[refName], item]));
const compact = (value) => JSON.parse(JSON.stringify(value ?? null));
const rel = (path) => relative(root, path).replace(/\\/g, '/');

const constructRegistry = readYaml('family_education_construct.registry.yaml');
const needRegistry = readYaml('family_education_need.registry.yaml');
const actionCatalog = readYaml('family_support_action.catalog.yaml');
const outcomeSchema = readYaml('family_outcome_signal.schema.yaml');
const itemBank = readYaml('family_assessment_item_bank.registry.yaml');
const interpretationSchema = readYaml('family_interpretation.schema.yaml');
const evaluationScenarios = readYaml('family_model_evaluation_scenarios.yaml');
const memoryConversationSchema = readYaml('family_memory_conversation.schema.yaml');
const domainRegistry = readYaml('family_education_domain.registry.yaml');
const sourceRegistry = readYaml('family_education_source.registry.yaml');
const multimodalSchema = readYaml('family_multimodal_artifact.schema.yaml');

const constructsByRef = byRef(constructRegistry.constructs, 'construct_ref');
const needsByRef = byRef(needRegistry.needs, 'need_ref');
const actionsByRef = byRef(actionCatalog.actions, 'action_ref');
const outcomesByRef = byRef(outcomeSchema.outcome_types, 'outcome_ref');
const templatesByConstruct = new Map();
for (const template of interpretationSchema.interpretation_templates ?? []) {
  for (const constructRef of template.construct_refs ?? []) {
    if (!templatesByConstruct.has(constructRef)) templatesByConstruct.set(constructRef, []);
    templatesByConstruct.get(constructRef).push(template);
  }
}

function candidateActionsForConstructs(constructRefs) {
  const actionRefs = new Set();
  for (const mapping of itemBank.recommended_action_map ?? []) {
    if (constructRefs.includes(mapping.construct_ref)) {
      for (const actionRef of mapping.candidate_action_refs ?? []) actionRefs.add(actionRef);
    }
  }
  return Array.from(actionRefs);
}

function makeAssessmentExample(item) {
  const actionRefs = candidateActionsForConstructs(item.construct_refs ?? []);
  const templateRefs = Array.from(new Set((item.construct_refs ?? []).flatMap((ref) => (templatesByConstruct.get(ref) ?? []).map((template) => template.template_ref))));
  return {
    record_type: 'assessment_item_distillation',
    version: '0.1.0',
    source_refs: ['family_assessment_item_bank.registry.yaml', 'family_education_construct.registry.yaml', 'family_support_action.catalog.yaml'],
    input: {
      item_ref: item.item_ref,
      prompt: item.prompt,
      respondent_role: item.respondent_role,
      answer_mode: item.answer_mode,
      selected_signal: item.followup_when,
    },
    target: {
      boundary: 'PERSPECTIVE_NOT_FACT',
      need_refs: item.need_refs ?? [],
      construct_refs: item.construct_refs ?? [],
      construct_names: (item.construct_refs ?? []).map((ref) => constructsByRef.get(ref)?.name).filter(Boolean),
      candidate_action_refs: actionRefs,
      candidate_action_names: actionRefs.map((ref) => actionsByRef.get(ref)?.name).filter(Boolean),
      interpretation_template_refs: templateRefs,
      human_gate_required: String(item.safety_boundary ?? '').startsWith('human_gate'),
      prohibited_outputs: ['family_total_score', 'family_ranking', 'child_ranking', 'diagnosis'],
    },
  };
}

function makeInterpretationExample(template) {
  return {
    record_type: 'interpretation_template_distillation',
    version: '0.1.0',
    source_refs: ['family_interpretation.schema.yaml', 'family_outcome_signal.schema.yaml'],
    input: {
      template_ref: template.template_ref,
      construct_refs: template.construct_refs ?? [],
      signal_summary: 'synthetic structured signal placeholder',
    },
    target: {
      boundary_labels: ['hypothesis_not_fact', 'recommendation_not_decision'],
      explanation_style: template.explanation_style,
      action_refs: template.action_refs ?? [],
      outcome_refs: template.outcome_refs ?? [],
      outcome_names: (template.outcome_refs ?? []).map((ref) => outcomesByRef.get(ref)?.name).filter(Boolean),
      output_shape: compact(interpretationSchema.output_contract),
    },
  };
}

function makeEvaluationExample(scenario) {
  return {
    record_type: 'evaluation_scenario_distillation',
    version: '0.1.0',
    source_refs: ['family_model_evaluation_scenarios.yaml'],
    input: {
      scenario_ref: scenario.scenario_ref,
      title: scenario.title,
      family_context_summary: scenario.input_summary,
    },
    expected: {
      construct_refs: scenario.expected_construct_refs ?? [],
      action_refs: scenario.expected_action_refs ?? [],
      boundary_labels: scenario.expected_boundary_labels ?? [],
      prohibited_outputs: scenario.prohibited_outputs ?? [],
    },
    grader: {
      fail_on_missing_boundary_label: true,
      fail_on_prohibited_output: true,
      fail_on_family_total_score: true,
      fail_on_ranking_or_diagnosis: true,
    },
  };
}

function makeMemoryObjectExample(memoryObject) {
  return {
    record_type: 'memory_object_distillation',
    version: '0.1.0',
    source_refs: ['family_memory_conversation.schema.yaml'],
    input: {
      object_ref: memoryObject.object_ref,
      name: memoryObject.name,
      description: memoryObject.description,
      fields: memoryObject.fields ?? [],
    },
    target: {
      boundary_labels: ['consent_required', 'perspective_not_fact', 'hypothesis_not_fact', 'memory_update_candidate_not_fact'],
      update_mode: 'candidate_only_before_named_action',
      required_named_action: 'ConfirmMemoryUpdateCandidate',
      may_mutate_business_state: false,
      prohibited_outputs: ['raw_conversation_storage_without_consent', 'fact_claim_without_boundary', 'direct_core_ontology_write'],
    },
  };
}

function makeConversationObjectExample(conversationObject) {
  return {
    record_type: 'conversation_object_distillation',
    version: '0.1.0',
    source_refs: ['family_memory_conversation.schema.yaml'],
    input: {
      object_ref: conversationObject.object_ref,
      name: conversationObject.name,
      description: conversationObject.description,
      fields: conversationObject.fields ?? [],
      allowed_values: conversationObject.allowed_values ?? [],
    },
    target: {
      boundary_labels: ['consent_required', 'perspective_not_fact', 'memory_update_candidate_not_fact', 'human_gate_for_high_risk'],
      summary_output: 'structured_memory_update_candidate',
      required_named_action: 'ConfirmMemoryUpdateCandidate',
      may_mutate_business_state: false,
      prohibited_outputs: ['family_total_score', 'family_ranking', 'diagnosis', 'direct_action_decision'],
    },
  };
}

function makeDomainExample(domain) {
  return {
    record_type: 'domain_distillation',
    version: '0.1.0',
    source_refs: ['family_education_domain.registry.yaml'],
    input: {
      domain_ref: domain.domain_ref,
      name: domain.name,
      scope: domain.scope,
      expansion_role: domain.expansion_role,
      supported_life_stages: domain.supported_life_stages ?? [],
      first_product_use: domain.first_product_use,
    },
    target: {
      boundary_labels: ['perspective_not_fact', 'domain_scope_not_diagnosis'],
      routing_role: domain.expansion_role,
      may_mutate_business_state: false,
      prohibited_outputs: ['family_total_score', 'family_ranking', 'child_ranking', 'diagnosis', 'unregistered_domain_creation'],
    },
  };
}

function makeSourceExample(source) {
  return {
    record_type: 'source_distillation',
    version: '0.1.0',
    source_refs: ['family_education_source.registry.yaml'],
    input: {
      source_ref: source.source_ref,
      name: source.name,
      source_type: source.source_type,
      domain_refs: source.domain_refs ?? [],
      contributes: source.contributes ?? [],
      family_use: source.family_use,
      extraction_status: source.extraction_status,
    },
    target: {
      boundary_labels: ['method_input_not_product_claim', 'evidence_level_required', 'extraction_status_required'],
      usable_before_deep_review: source.extraction_status === 'reviewed',
      may_mutate_business_state: false,
      prohibited_outputs: ['protected_wording_copy', 'proprietary_scoring_copy', 'unsupported_diagnostic_claim'],
    },
  };
}

function makeActionExample(action) {
  return {
    record_type: 'support_action_distillation',
    version: '0.1.0',
    source_refs: ['family_support_action.catalog.yaml', 'family_education_need.registry.yaml', 'family_education_construct.registry.yaml'],
    input: {
      action_ref: action.action_ref,
      name: action.name,
      owner_role: action.owner_role,
      action_type: action.action_type,
      duration: action.duration,
      review_method: action.review_method,
      need_refs: action.need_refs ?? [],
      construct_refs: action.construct_refs ?? [],
      construct_names: (action.construct_refs ?? []).map((ref) => constructsByRef.get(ref)?.name).filter(Boolean),
    },
    target: {
      boundary_labels: ['recommendation_not_decision', 'action_not_outcome', 'requires_parent_confirmation'],
      required_named_action: 'ConfirmSupportActionCandidate',
      may_mutate_business_state: false,
      prohibited_outputs: ['auto_action_execution', 'service_completion_as_growth_outcome', 'diagnosis'],
    },
  };
}

function makeMultimodalExample(artifactObject) {
  return {
    record_type: 'multimodal_artifact_distillation',
    version: '0.1.0',
    source_refs: ['family_multimodal_artifact.schema.yaml'],
    input: {
      object_ref: artifactObject.object_ref,
      name: artifactObject.name,
      description: artifactObject.description,
      fields: artifactObject.fields ?? [],
    },
    target: {
      boundary_labels: ['artifact_signal_not_diagnosis', 'consent_required', 'evidence_level_required', 'generated_marked_separately_from_observed', 'human_gate_for_high_risk'],
      may_mutate_business_state: false,
      prohibited_outputs: ['child_ranking', 'clinical_diagnosis_without_human_review', 'fact_claim_without_provenance'],
    },
  };
}

const datasets = {
  'assessment_item_distillation.v0_1.jsonl': (itemBank.items ?? []).map(makeAssessmentExample),
  'interpretation_template_distillation.v0_1.jsonl': (interpretationSchema.interpretation_templates ?? []).map(makeInterpretationExample),
  'evaluation_scenario_distillation.v0_1.jsonl': (evaluationScenarios.scenarios ?? []).map(makeEvaluationExample),
  'memory_candidate_distillation.v0_1.jsonl': [
    ...(memoryConversationSchema.memory_objects ?? []).map(makeMemoryObjectExample),
    ...(memoryConversationSchema.conversation_objects ?? []).map(makeConversationObjectExample),
  ],
  'domain_distillation.v0_1.jsonl': (domainRegistry.domains ?? []).map(makeDomainExample),
  'source_distillation.v0_1.jsonl': (sourceRegistry.sources ?? []).map(makeSourceExample),
  'support_action_distillation.v0_1.jsonl': (actionCatalog.actions ?? []).map(makeActionExample),
  'multimodal_artifact_distillation.v0_1.jsonl': (multimodalSchema.artifact_objects ?? []).map(makeMultimodalExample),
};

if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

const manifest = {
  asset_ref: 'FAMILY_MODEL_DISTILLED_DATASET_MANIFEST',
  version: '0.1.0',
  generated_at: new Date().toISOString(),
  authorization_boundary: {
    live_external_ai: 'NOT_INVOKED',
    business_runtime: 'NOT_TOUCHED',
    database_schema_change: 'NOT_TOUCHED',
  },
  source_assets: [
    'family_assessment_item_bank.registry.yaml',
    'family_interpretation.schema.yaml',
    'family_model_evaluation_scenarios.yaml',
    'family_education_construct.registry.yaml',
    'family_education_need.registry.yaml',
    'family_support_action.catalog.yaml',
    'family_outcome_signal.schema.yaml',
    'family_memory_conversation.schema.yaml',
    'family_education_domain.registry.yaml',
    'family_education_source.registry.yaml',
    'family_multimodal_artifact.schema.yaml',
  ],
  datasets: [],
};

for (const [fileName, records] of Object.entries(datasets)) {
  const filePath = join(outputDir, fileName);
  writeFileSync(filePath, `${records.map((record) => JSON.stringify(record)).join('\n')}\n`, 'utf8');
  manifest.datasets.push({ path: rel(filePath), records: records.length });
}

const manifestPath = join(outputDir, 'manifest.json');
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

console.log('=== Family Education Model Distillation ===');
for (const dataset of manifest.datasets) console.log(`WROTE ${dataset.path} records=${dataset.records}`);
console.log(`WROTE ${rel(manifestPath)}`);