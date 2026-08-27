#!/usr/bin/env node
import { createReadStream, existsSync, readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as YAML from 'js-yaml';

const loadYaml = YAML.load ?? YAML.default?.load;
const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const modelDir = join(root, 'docs', 'model');
const manifestPath = join(modelDir, 'family_education_model_foundation.manifest.yaml');

const results = [];
const record = (area, ok, detail) => results.push({ area, ok, detail });
const rel = (path) => relative(root, path).replace(/\\/g, '/');

function readYaml(path) {
  return loadYaml(readFileSync(path, 'utf8'));
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function readJsonl(path) {
  return readFileSync(path, 'utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));
}

async function inspectJsonl(path) {
  const lines = createInterface({ input: createReadStream(path, { encoding: 'utf8' }), crlfDelay: Infinity });
  let count = 0;
  let first = null;
  let last = null;
  for await (const line of lines) {
    if (!line.trim()) continue;
    count += 1;
    if (!first) first = JSON.parse(line);
    last = JSON.parse(line);
  }
  return { count, first, last };
}

function toRefSet(items, field) {
  return new Set((items ?? []).map((item) => item?.[field]).filter(Boolean));
}

function assertKnownRefs(area, owner, refs, knownRefs) {
  for (const ref of refs ?? []) {
    record(area, knownRefs.has(ref), `${owner} -> ${ref}`);
  }
}

function loadModelYaml(fileName, expectedAssetRef) {
  const path = join(modelDir, fileName);
  if (!existsSync(path)) {
    record('ModelAsset', false, `${fileName} missing`);
    return null;
  }
  try {
    const doc = readYaml(path);
    record('ModelAsset', doc?.asset_ref === expectedAssetRef, `${fileName} asset_ref=${doc?.asset_ref ?? '-'}`);
    return doc;
  } catch (error) {
    record('ModelAsset', false, `${fileName} :: ${error.message.split('\n')[0]}`);
    return null;
  }
}

if (!existsSync(manifestPath)) {
  record('Manifest', false, `${rel(manifestPath)} missing`);
} else {
  try {
    const manifest = readYaml(manifestPath);
    record('Manifest', manifest?.asset_ref === 'FAMILY_EDUCATION_MODEL_FOUNDATION_MANIFEST', `${rel(manifestPath)} asset_ref=${manifest?.asset_ref ?? '-'}`);

    for (const asset of manifest.foundation_assets ?? []) {
      const assetPath = join(modelDir, asset.path);
      if (!existsSync(assetPath)) {
        record('FoundationAsset', false, `${asset.asset_ref} -> ${asset.path} missing`);
        continue;
      }

      try {
        const doc = readYaml(assetPath);
        const ok = !!doc && typeof doc === 'object';
        const declaredRef = doc.asset_ref ?? doc.catalog_ref ?? doc.schema_ref ?? '-';
        record('FoundationAsset', ok, `${asset.asset_ref} -> ${asset.path} declared=${declaredRef}`);
      } catch (error) {
        record('FoundationAsset', false, `${asset.asset_ref} -> ${asset.path} :: ${error.message.split('\n')[0]}`);
      }
    }
  } catch (error) {
    record('Manifest', false, `${rel(manifestPath)} :: ${error.message.split('\n')[0]}`);
  }
}

const manifest = existsSync(manifestPath) ? readYaml(manifestPath) : null;
const foundationAssetRefs = new Set([
  'FAMILY_EDUCATION_MODEL_FOUNDATION_MANIFEST',
  ...((manifest?.foundation_assets ?? []).map((asset) => asset.asset_ref).filter(Boolean)),
  ...((manifest?.next_foundation_assets ?? []).map((asset) => asset.asset_ref).filter(Boolean)),
]);

const authorizationRegistryPath = join(root, 'governance', 'AUTHORIZATION_REGISTRY.yaml');
const authorizationRegistry = existsSync(authorizationRegistryPath) ? readYaml(authorizationRegistryPath) : null;
const authorizationById = new Map((authorizationRegistry?.capabilities ?? []).map((capability) => [capability.capability_id, capability]));

function capabilityFromRef(authorizationRef) {
  const capabilityId = String(authorizationRef ?? '').split('#')[1];
  return capabilityId ? authorizationById.get(capabilityId) : null;
}

function isInternalRuntimeAuthorized(boundary) {
  if (boundary?.business_runtime === 'NOT_AUTHORIZED') return true;
  const capability = capabilityFromRef(boundary?.authorization_ref);
  return boundary?.business_runtime === 'AUTHORIZED'
    && capability?.runtime_authorized === true
    && capability?.pilot_authorized === false
    && capability?.production_authorized === false
    && capability?.constraints?.db_schema_change_authorized === false
    && capability?.constraints?.canonical_state_mutation_by_model_authorized === false;
}

function isInternalLiveAiAuthorized(boundary) {
  if (boundary?.live_external_ai === 'NOT_AUTHORIZED') return true;
  const capability = capabilityFromRef(boundary?.authorization_ref);
  return boundary?.live_external_ai === 'AUTHORIZED'
    && capability?.live_external_call_authorized === true
    && capability?.pilot_authorized === false
    && capability?.production_authorized === false
    && capability?.constraints?.direct_provider_call_authorized === false
    && capability?.constraints?.client_direct_model_call_authorized === false
    && capability?.constraints?.real_keys_in_repo_authorized === false;
}

function isFlowLiveCapabilityControlled(boundary, flowContract) {
  if (boundary?.live_external_ai === 'NOT_AUTHORIZED') return true;
  const capability = capabilityFromRef(boundary?.authorization_ref);
  if (!isInternalLiveAiAuthorized(boundary)) return false;
  if ((capability?.scope?.flow_refs ?? []).includes(flowContract.flow_ref)) return true;
  return flowContract.requires_consent === true
    && flowContract.may_mutate_business_state === false
    && (flowContract.required_boundary_labels ?? []).length > 0
    && (flowContract.candidate_events_after_authorization ?? []).includes('FamilyModelHumanReviewRequested');
}

const componentPath = join(modelDir, 'family_model_component.registry.yaml');
let componentRefs = new Set();
if (existsSync(componentPath)) {
  try {
    const registry = readYaml(componentPath);
    const requiredFields = registry?.component_contract?.required_fields ?? [];
    const components = registry?.registered_components ?? [];
    componentRefs = new Set(components.map((component) => component.component_ref));

    record('ComponentRegistry', requiredFields.length > 0, `required_fields=${requiredFields.length}`);
    record('ComponentRegistry', components.length > 0, `registered_components=${components.length}`);

    for (const component of components) {
      const missing = requiredFields.filter((field) => !(field in component));
      record('ComponentContract', missing.length === 0, `${component.component_ref ?? '<missing-ref>'} missing=${missing.join(',') || '-'}`);

      for (const dependencyRef of component.dependency_refs ?? []) {
        record('ComponentDependency', componentRefs.has(dependencyRef), `${component.component_ref} -> ${dependencyRef}`);
      }
    }
  } catch (error) {
    record('ComponentRegistry', false, `${rel(componentPath)} :: ${error.message.split('\n')[0]}`);
  }
} else {
  record('ComponentRegistry', false, `${rel(componentPath)} missing`);
}

const technicalArchitecturePath = join(modelDir, 'family_model_technical_architecture.registry.yaml');
const uiBindingPath = join(modelDir, 'family_ui_model_binding.registry.yaml');
let technicalArchitectureFlowRefs = new Set();
if (existsSync(technicalArchitecturePath)) {
  try {
    const architecture = readYaml(technicalArchitecturePath);
    const layers = architecture?.architecture_layers ?? [];
    const layerRefs = new Set(layers.map((layer) => layer.layer_ref).filter(Boolean));
    const flows = architecture?.architecture_flows ?? [];
    technicalArchitectureFlowRefs = new Set(flows.map((flow) => flow.flow_ref).filter(Boolean));
    const gatewayProfiles = architecture?.model_gateway_profiles ?? [];

    record('TechnicalArchitecture', architecture?.asset_ref === 'FAMILY_MODEL_TECHNICAL_ARCHITECTURE_REGISTRY', `asset_ref=${architecture?.asset_ref ?? '-'}`);
    record('TechnicalArchitecture', !!architecture?.architecture_id, `architecture_id=${architecture?.architecture_id ?? '-'}`);
    record('TechnicalArchitecture', layers.length > 0, `architecture_layers=${layers.length}`);
    record('TechnicalArchitecture', layerRefs.size === layers.length, `unique_layers=${layerRefs.size}`);
    record('TechnicalArchitectureBoundary', isInternalRuntimeAuthorized(architecture?.runtime_boundary), `business_runtime=${architecture?.runtime_boundary?.business_runtime ?? '-'}`);
    record('TechnicalArchitectureBoundary', isInternalLiveAiAuthorized(architecture?.runtime_boundary), `live_external_ai=${architecture?.runtime_boundary?.live_external_ai ?? '-'}`);

    for (const layer of layers) {
      record('TechnicalArchitectureLayer', !!layer.layer_ref && !!layer.layer_kind && !!layer.owned_by, `${layer.layer_ref ?? '<missing-ref>'} required_fields`);
      record('TechnicalArchitectureLayerMutation', layer.may_mutate_business_state === false, `${layer.layer_ref} may_mutate_business_state=${layer.may_mutate_business_state}`);
      assertKnownRefs('TechnicalArchitectureLayerComponentRef', layer.layer_ref, layer.component_refs, componentRefs);
    }

    for (const profile of gatewayProfiles) {
      record('TechnicalArchitectureGatewayProfile', !!profile.profile_ref && !!profile.provider_kind && !!profile.provider_id, `${profile.profile_ref ?? '<missing-ref>'} required_fields`);
      if (profile.provider_id === 'anthropic-cc-switch') {
        record('TechnicalArchitectureGatewayProfile', profile.live_external_ai_required === true, `${profile.profile_ref} live_external_ai_required=${profile.live_external_ai_required}`);
        record('TechnicalArchitectureGatewayProfile', (profile.required_env ?? []).includes('FAMILY_MODEL_CC_SWITCH_API_KEY'), `${profile.profile_ref} requires API key env`);
      }
    }

    for (const flow of flows) {
      record('TechnicalArchitectureFlow', !!flow.flow_ref && !!flow.flow_kind, `${flow.flow_ref ?? '<missing-ref>'} required_fields`);
      record('TechnicalArchitectureFlowMutation', flow.may_mutate_business_state === false, `${flow.flow_ref} may_mutate_business_state=${flow.may_mutate_business_state}`);
      assertKnownRefs('TechnicalArchitectureFlowLayerRef', flow.flow_ref, flow.ordered_layer_refs, layerRefs);
      record('TechnicalArchitectureFlowBoundary', (flow.required_boundary_labels ?? []).length > 0, `${flow.flow_ref} required_boundary_labels=${flow.required_boundary_labels?.length ?? 0}`);
    }
  } catch (error) {
    record('TechnicalArchitecture', false, `${rel(technicalArchitecturePath)} :: ${error.message.split('\n')[0]}`);
  }
} else {
  record('TechnicalArchitecture', false, `${rel(technicalArchitecturePath)} missing`);
}

const runtimeIntegrationContractPath = join(modelDir, 'family_model_runtime_integration.contract.yaml');
if (existsSync(runtimeIntegrationContractPath)) {
  try {
    const contract = readYaml(runtimeIntegrationContractPath);
    const flowContracts = contract?.governed_flow_contracts ?? [];
    const forbiddenPaths = new Set(contract?.forbidden_integration_paths ?? []);
    const knownUiRefs = existsSync(uiBindingPath)
      ? new Set((readYaml(uiBindingPath)?.registered_ui_bindings ?? []).map((binding) => binding.ui_id).filter(Boolean))
      : new Set();

    record('RuntimeIntegrationContract', contract?.asset_ref === 'FAMILY_MODEL_RUNTIME_INTEGRATION_CONTRACT', `asset_ref=${contract?.asset_ref ?? '-'}`);
    record('RuntimeIntegrationContractBoundary', isInternalRuntimeAuthorized(contract?.current_authorization_boundary), `business_runtime=${contract?.current_authorization_boundary?.business_runtime ?? '-'}`);
    record('RuntimeIntegrationContractBoundary', isInternalLiveAiAuthorized(contract?.current_authorization_boundary), `live_external_ai=${contract?.current_authorization_boundary?.live_external_ai ?? '-'}`);
    record('RuntimeIntegrationContractRuntime', contract?.canonical_runtime?.planner === 'FamilyModelTechnicalArchitectureRuntime', `planner=${contract?.canonical_runtime?.planner ?? '-'}`);
    record('RuntimeIntegrationContractRuntime', contract?.canonical_runtime?.gateway_package === '@family/ai-gateway', `gateway_package=${contract?.canonical_runtime?.gateway_package ?? '-'}`);
    record('RuntimeIntegrationContractFlow', flowContracts.length > 0, `governed_flow_contracts=${flowContracts.length}`);

    for (const flowContract of flowContracts) {
      record('RuntimeIntegrationContractFlowRef', technicalArchitectureFlowRefs.has(flowContract.flow_ref), `${flowContract.flow_ref}`);
      record('RuntimeIntegrationContractFlowMutation', flowContract.may_mutate_business_state === false, `${flowContract.flow_ref} may_mutate_business_state=${flowContract.may_mutate_business_state}`);
      record('RuntimeIntegrationContractFlowBoundary', (flowContract.required_boundary_labels ?? []).length > 0, `${flowContract.flow_ref} required_boundary_labels=${flowContract.required_boundary_labels?.length ?? 0}`);
      assertKnownRefs('RuntimeIntegrationContractSurfaceRef', flowContract.flow_ref, flowContract.surface_refs, knownUiRefs);
      for (const eventName of flowContract.candidate_events_after_authorization ?? []) {
        record('RuntimeIntegrationContractEventName', /^[A-Z][A-Za-z0-9]+$/.test(eventName), `${flowContract.flow_ref} -> ${eventName}`);
      }
      if (flowContract.may_call_live_external_ai_after_authorization === true) {
        record('RuntimeIntegrationContractLiveGate', isFlowLiveCapabilityControlled(contract?.current_authorization_boundary, flowContract), `${flowContract.flow_ref} live capability controlled`);
      }
    }

    for (const forbiddenPath of ['client_direct_provider_call', 'business_module_direct_provider_sdk', 'model_free_text_to_core_ontology_write', 'draft_to_canonical_state_without_named_action']) {
      record('RuntimeIntegrationContractForbiddenPath', forbiddenPaths.has(forbiddenPath), forbiddenPath);
    }
  } catch (error) {
    record('RuntimeIntegrationContract', false, `${rel(runtimeIntegrationContractPath)} :: ${error.message.split('\n')[0]}`);
  }
} else {
  record('RuntimeIntegrationContract', false, `${rel(runtimeIntegrationContractPath)} missing`);
}

if (existsSync(uiBindingPath)) {
  try {
    const registry = readYaml(uiBindingPath);
    const bindings = registry?.registered_ui_bindings ?? [];
    const uiIds = bindings.map((binding) => binding.ui_id);
    const uniqueUiIds = new Set(uiIds);
    const expectedUiIds = Array.from({ length: 35 }, (_, index) => `UI-${String(index + 1).padStart(2, '0')}`);

    record('UiModelBinding', registry?.asset_ref === 'FAMILY_UI_MODEL_BINDING_REGISTRY', `asset_ref=${registry?.asset_ref ?? '-'}`);
    record('UiModelBinding', bindings.length === 35, `registered_ui_bindings=${bindings.length}`);
    record('UiModelBinding', uniqueUiIds.size === 35, `unique_ui_ids=${uniqueUiIds.size}`);

    for (const uiId of expectedUiIds) {
      record('UiModelBindingCoverage', uniqueUiIds.has(uiId), uiId);
    }

    for (const binding of bindings) {
      for (const componentRef of binding.primary_model_components ?? []) {
        record('UiModelBindingComponent', componentRefs.has(componentRef), `${binding.ui_id} -> ${componentRef}`);
      }
    }
  } catch (error) {
    record('UiModelBinding', false, `${rel(uiBindingPath)} :: ${error.message.split('\n')[0]}`);
  }
} else {
  record('UiModelBinding', false, `${rel(uiBindingPath)} missing`);
}

const constructRegistry = loadModelYaml('family_education_construct.registry.yaml', 'FAMILY_EDUCATION_CONSTRUCT_REGISTRY');
const sourceRegistry = loadModelYaml('family_education_source.registry.yaml', 'FAMILY_EDUCATION_SOURCE_REGISTRY');
const needRegistry = loadModelYaml('family_education_need.registry.yaml', 'FAMILY_EDUCATION_NEED_REGISTRY');
const actionCatalog = loadModelYaml('family_support_action.catalog.yaml', 'FAMILY_SUPPORT_ACTION_CATALOG');
const outcomeSchema = loadModelYaml('family_outcome_signal.schema.yaml', 'FAMILY_OUTCOME_SIGNAL_SCHEMA');
const itemBank = loadModelYaml('family_assessment_item_bank.registry.yaml', 'FAMILY_ASSESSMENT_ITEM_BANK_REGISTRY');
const interpretationSchema = loadModelYaml('family_interpretation.schema.yaml', 'FAMILY_INTERPRETATION_SCHEMA');
const evaluationScenarios = loadModelYaml('family_model_evaluation_scenarios.yaml', 'FAMILY_MODEL_EVALUATION_SCENARIOS');
const ui02AssessmentSlice = loadModelYaml('family_ui02_assessment_model_slice.yaml', 'FAMILY_UI02_ASSESSMENT_MODEL_SLICE');
const ui02ResearchCards = loadModelYaml('family_ui02_assessment_research_cards.yaml', 'FAMILY_UI02_ASSESSMENT_RESEARCH_CARDS');

const constructRefs = toRefSet(constructRegistry?.constructs, 'construct_ref');
const sourceRefs = toRefSet(sourceRegistry?.sources, 'source_ref');
const needRefs = toRefSet(needRegistry?.needs, 'need_ref');
const actionRefs = toRefSet(actionCatalog?.actions, 'action_ref');
const outcomeRefs = toRefSet(outcomeSchema?.outcome_types, 'outcome_ref');
let assessmentItemRefs = new Set();
let ui02ThemeRefs = new Set();

if (itemBank) {
  const itemRefs = toRefSet(itemBank.items, 'item_ref');
  assessmentItemRefs = itemRefs;
  record('AssessmentItemBank', (itemBank.items ?? []).length > 0, `items=${itemBank.items?.length ?? 0}`);
  for (const item of itemBank.items ?? []) {
    record('AssessmentItemBankItem', !!item.item_ref && !!item.prompt && !!item.answer_mode, `${item.item_ref ?? '<missing-ref>'} required_fields`);
    assertKnownRefs('AssessmentItemConstructRef', item.item_ref, item.construct_refs, constructRefs);
    assertKnownRefs('AssessmentItemNeedRef', item.item_ref, item.need_refs, needRefs);
  }
  for (const mapping of itemBank.recommended_action_map ?? []) {
    record('AssessmentActionMapConstructRef', constructRefs.has(mapping.construct_ref), `${mapping.construct_ref}`);
    assertKnownRefs('AssessmentActionMapActionRef', mapping.construct_ref, mapping.candidate_action_refs, actionRefs);
  }
  record('AssessmentItemBank', itemRefs.size === (itemBank.items?.length ?? 0), `unique_items=${itemRefs.size}`);
}

if (interpretationSchema) {
  record('InterpretationSchema', (interpretationSchema.interpretation_templates ?? []).length > 0, `templates=${interpretationSchema.interpretation_templates?.length ?? 0}`);
  const prohibited = new Set(interpretationSchema.output_contract?.prohibited_outputs ?? []);
  for (const required of ['family_total_score', 'family_ranking', 'child_ranking', 'medical_diagnosis', 'psychiatric_diagnosis']) {
    record('InterpretationSafetyRule', prohibited.has(required), required);
  }
  for (const template of interpretationSchema.interpretation_templates ?? []) {
    record('InterpretationTemplate', !!template.template_ref && !!template.explanation_style, `${template.template_ref ?? '<missing-ref>'} required_fields`);
    assertKnownRefs('InterpretationTemplateConstructRef', template.template_ref, template.construct_refs, constructRefs);
    assertKnownRefs('InterpretationTemplateActionRef', template.template_ref, template.action_refs, actionRefs);
    assertKnownRefs('InterpretationTemplateOutcomeRef', template.template_ref, template.outcome_refs, outcomeRefs);
  }
}

if (evaluationScenarios) {
  record('EvaluationScenarioSet', (evaluationScenarios.scenarios ?? []).length > 0, `scenarios=${evaluationScenarios.scenarios?.length ?? 0}`);
  for (const scenario of evaluationScenarios.scenarios ?? []) {
    record('EvaluationScenario', !!scenario.scenario_ref && !!scenario.input_summary, `${scenario.scenario_ref ?? '<missing-ref>'} required_fields`);
    record('EvaluationScenarioSafety', (scenario.prohibited_outputs ?? []).length > 0, `${scenario.scenario_ref} prohibited_outputs=${scenario.prohibited_outputs?.length ?? 0}`);
    assertKnownRefs('EvaluationScenarioConstructRef', scenario.scenario_ref, scenario.expected_construct_refs, constructRefs);
    assertKnownRefs('EvaluationScenarioActionRef', scenario.scenario_ref, scenario.expected_action_refs, actionRefs);
  }
}

if (ui02AssessmentSlice) {
  const themes = ui02AssessmentSlice.five_theme_model ?? [];
  const themeRefs = new Set(themes.map((theme) => theme.theme_ref).filter(Boolean));
  ui02ThemeRefs = themeRefs;
  const requiredThemeRefs = ['LEARNING_HABITS', 'EMOTION_REGULATION', 'PARENT_CHILD_COMMUNICATION', 'DEVICE_USE_CONTEXT', 'SELF_REGULATION'];
  const prohibitedOutputs = new Set(ui02AssessmentSlice.governance_boundaries?.prohibited_outputs ?? []);
  const requiredResultSections = new Set(ui02AssessmentSlice.free_result_contract?.required_sections ?? []);

  record('Ui02AssessmentSlice', ui02AssessmentSlice.slice_position?.slice_ref === 'UI02_FREE_FAMILY_ASSESSMENT_V0', `slice_ref=${ui02AssessmentSlice.slice_position?.slice_ref ?? '-'}`);
  record('Ui02AssessmentSlice', themes.length === 5, `five_theme_model=${themes.length}`);
  record('Ui02AssessmentSliceBoundary', ui02AssessmentSlice.governance_boundaries?.truth_boundary === 'parent_perspective_not_fact', `truth_boundary=${ui02AssessmentSlice.governance_boundaries?.truth_boundary ?? '-'}`);
  record('Ui02AssessmentSliceBoundary', ui02AssessmentSlice.governance_boundaries?.action_boundary === 'recommendation_not_decision_not_action', `action_boundary=${ui02AssessmentSlice.governance_boundaries?.action_boundary ?? '-'}`);

  for (const themeRef of requiredThemeRefs) {
    record('Ui02AssessmentSliceThemeCoverage', themeRefs.has(themeRef), themeRef);
  }

  for (const theme of themes) {
    record('Ui02AssessmentSliceTheme', !!theme.theme_ref && !!theme.title_zh && !!theme.family_question, `${theme.theme_ref ?? '<missing-ref>'} required_fields`);
    record('Ui02AssessmentSliceThemeItemCount', (theme.item_refs ?? []).length === 3, `${theme.theme_ref} item_refs=${theme.item_refs?.length ?? 0}`);
    record('Ui02AssessmentSliceThemeTemplate', !!theme.interpretation_template_ref, `${theme.theme_ref} interpretation_template_ref=${theme.interpretation_template_ref ?? '-'}`);
    assertKnownRefs('Ui02AssessmentSliceConstructRef', theme.theme_ref, theme.construct_refs, constructRefs);
    assertKnownRefs('Ui02AssessmentSliceNeedRef', theme.theme_ref, theme.need_refs, needRefs);
    assertKnownRefs('Ui02AssessmentSliceItemRef', theme.theme_ref, theme.item_refs, assessmentItemRefs);
    assertKnownRefs('Ui02AssessmentSliceActionRef', theme.theme_ref, theme.candidate_action_refs, actionRefs);
  }

  for (const prohibitedOutput of ['family_total_score', 'family_ranking', 'child_ranking', 'medical_diagnosis', 'psychiatric_diagnosis', 'causal_claim_without_outcome']) {
    record('Ui02AssessmentSliceProhibitedOutput', prohibitedOutputs.has(prohibitedOutput), prohibitedOutput);
  }

  for (const section of ['selected_family_focus', 'parent_observed_signals', 'careful_need_summary', 'low_risk_next_step_candidate', 'boundary_statement']) {
    record('Ui02AssessmentSliceResultSection', requiredResultSections.has(section), section);
  }
}

if (ui02ResearchCards) {
  const cards = ui02ResearchCards.research_cards ?? [];
  const cardThemeRefs = new Set(cards.map((card) => card.theme_ref).filter(Boolean));
  const requiredThemeRefs = ['LEARNING_HABITS', 'EMOTION_REGULATION', 'PARENT_CHILD_COMMUNICATION', 'DEVICE_USE_CONTEXT', 'SELF_REGULATION'];

  record('Ui02ResearchCards', ui02ResearchCards.evidence_governance?.decisive_claim_allowed === false, `decisive_claim_allowed=${ui02ResearchCards.evidence_governance?.decisive_claim_allowed}`);
  record('Ui02ResearchCards', cards.length === 5, `research_cards=${cards.length}`);

  for (const themeRef of requiredThemeRefs) {
    record('Ui02ResearchCardCoverage', cardThemeRefs.has(themeRef), themeRef);
  }

  for (const card of cards) {
    record('Ui02ResearchCard', !!card.card_ref && !!card.theme_ref && !!card.title_zh, `${card.card_ref ?? '<missing-ref>'} required_fields`);
    record('Ui02ResearchCardThemeRef', ui02ThemeRefs.has(card.theme_ref), `${card.card_ref} -> ${card.theme_ref}`);
    record('Ui02ResearchCardEvidenceGate', card.conclusion_allowed === false, `${card.card_ref} conclusion_allowed=${card.conclusion_allowed}`);
    record('Ui02ResearchCardEvidenceStatus', card.evidence_status === 'pending_deep_review', `${card.card_ref} evidence_status=${card.evidence_status ?? '-'}`);
    record('Ui02ResearchCardSourceCount', (card.source_refs ?? []).length > 0, `${card.card_ref} source_refs=${card.source_refs?.length ?? 0}`);
    record('Ui02ResearchCardUseBoundary', (card.not_usable_now_for ?? []).length > 0, `${card.card_ref} not_usable_now_for=${card.not_usable_now_for?.length ?? 0}`);
    record('Ui02ResearchCardCopyBoundary', typeof card.product_copy_boundary === 'string' && card.product_copy_boundary.length > 20, `${card.card_ref} product_copy_boundary`);
    assertKnownRefs('Ui02ResearchCardConstructRef', card.card_ref, card.construct_refs, constructRefs);
    assertKnownRefs('Ui02ResearchCardSourceRef', card.card_ref, card.source_refs, sourceRefs);
  }
}

const distilledDir = join(modelDir, 'distilled');
const distilledManifestPath = join(distilledDir, 'manifest.json');
if (existsSync(distilledManifestPath)) {
  try {
    const distilledManifest = readJson(distilledManifestPath);
    record('DistilledDatasetManifest', distilledManifest.asset_ref === 'FAMILY_MODEL_DISTILLED_DATASET_MANIFEST', `asset_ref=${distilledManifest.asset_ref ?? '-'}`);
    for (const dataset of distilledManifest.datasets ?? []) {
      const datasetPath = join(root, dataset.path);
      if (!existsSync(datasetPath)) {
        record('DistilledDataset', false, `${dataset.path} missing`);
        continue;
      }
      const rows = readJsonl(datasetPath);
      record('DistilledDataset', rows.length === dataset.records, `${dataset.path} records=${rows.length}/${dataset.records}`);
      for (const row of rows) {
        record('DistilledDatasetRow', !!row.record_type && !!row.version, `${dataset.path} ${row.record_type ?? '<missing-type>'}`);
      }
    }
  } catch (error) {
    record('DistilledDatasetManifest', false, `${rel(distilledManifestPath)} :: ${error.message.split('\n')[0]}`);
  }
} else {
  record('DistilledDatasetManifest', false, `${rel(distilledManifestPath)} missing; run pnpm run distill:family-model`);
}

const staging220kManifestPath = join(distilledDir, '220k_staging', 'manifest.json');
if (existsSync(staging220kManifestPath)) {
  try {
    const stagingManifest = readJson(staging220kManifestPath);
    record('Staging220kManifest', stagingManifest.asset_ref === 'FAMILY_EDUCATION_220K_DISTILLATION_STAGING_MANIFEST', `asset_ref=${stagingManifest.asset_ref ?? '-'}`);
    record('Staging220kManifest', stagingManifest.total_records === 220000 && stagingManifest.complete === true, `records=${stagingManifest.total_records}/${stagingManifest.target_records} complete=${stagingManifest.complete}`);
    record('Staging220kGovernance', stagingManifest.governance?.status === 'STAGING_ONLY', `status=${stagingManifest.governance?.status ?? '-'}`);
    record('Staging220kGovernance', stagingManifest.governance?.production_training_authorized === false, 'production_training_authorized=false');
    record('Staging220kGovernance', stagingManifest.governance?.database_write_authorized === false, 'database_write_authorized=false');
    for (const output of stagingManifest.outputs ?? []) {
      const outputPath = join(root, output.path);
      if (!existsSync(outputPath)) {
        record('Staging220kOutput', false, `${output.path} missing`);
        continue;
      }
      const inspection = await inspectJsonl(outputPath);
      record('Staging220kOutput', inspection.count === output.records, `${output.path} records=${inspection.count}/${output.records}`);
      for (const [edge, row] of [['first', inspection.first], ['last', inspection.last]]) {
        record('Staging220kRow', row?.asset_ref === 'FAMILY_EDUCATION_220K_DISTILLATION_STAGING_RECORD', `${edge} asset_ref=${row?.asset_ref ?? '-'}`);
        record('Staging220kRow', row?.migration_status === 'CANDIDATE_STAGED_FOR_REVIEW', `${edge} migration_status=${row?.migration_status ?? '-'}`);
        record('Staging220kRow', row?.source?.review_status === 'NEEDS_HUMAN_REVIEW', `${edge} review_status=${row?.source?.review_status ?? '-'}`);
      }
    }
  } catch (error) {
    record('Staging220kManifest', false, `${rel(staging220kManifestPath)} :: ${error.message.split('\n')[0]}`);
  }
}

const reviewBatchManifestPath = join(distilledDir, 'review_batch_v0_1', 'manifest.json');
if (existsSync(reviewBatchManifestPath)) {
  try {
    const reviewManifest = readJson(reviewBatchManifestPath);
    record('ReviewBatchManifest', reviewManifest.asset_ref === 'FAMILY_EDUCATION_DISTILLATION_REVIEW_BATCH_MANIFEST', `asset_ref=${reviewManifest.asset_ref ?? '-'}`);
    record('ReviewBatchManifest', reviewManifest.total_records === 22000 && reviewManifest.complete === true, `records=${reviewManifest.total_records}/${reviewManifest.target_records} complete=${reviewManifest.complete}`);
    record('ReviewBatchGovernance', reviewManifest.governance?.status === 'REVIEW_BATCH_ONLY', `status=${reviewManifest.governance?.status ?? '-'}`);
    record('ReviewBatchGovernance', reviewManifest.governance?.production_training_authorized === false, 'production_training_authorized=false');
    const outputPath = reviewManifest.output?.path ? join(root, reviewManifest.output.path) : null;
    if (!outputPath || !existsSync(outputPath)) {
      record('ReviewBatchOutput', false, `${reviewManifest.output?.path ?? '<missing-output>'} missing`);
    } else {
      const inspection = await inspectJsonl(outputPath);
      record('ReviewBatchOutput', inspection.count === reviewManifest.output.records, `${reviewManifest.output.path} records=${inspection.count}/${reviewManifest.output.records}`);
      for (const [edge, row] of [['first', inspection.first], ['last', inspection.last]]) {
        record('ReviewBatchRow', row?.asset_ref === 'FAMILY_EDUCATION_DISTILLATION_REVIEW_BATCH_RECORD', `${edge} asset_ref=${row?.asset_ref ?? '-'}`);
        record('ReviewBatchRow', row?.migration_status === 'DISTILLED_FOR_HUMAN_REVIEW', `${edge} migration_status=${row?.migration_status ?? '-'}`);
        record('ReviewBatchRow', row?.review?.review_status === 'NEEDS_HUMAN_REVIEW', `${edge} review_status=${row?.review?.review_status ?? '-'}`);
      }
    }
  } catch (error) {
    record('ReviewBatchManifest', false, `${rel(reviewBatchManifestPath)} :: ${error.message.split('\n')[0]}`);
  }
}

const subsetManifestPath = join(distilledDir, 'subsets_v0_1', 'manifest.json');
if (existsSync(subsetManifestPath)) {
  try {
    const subsetManifest = readJson(subsetManifestPath);
    record('SubsetManifest', subsetManifest.asset_ref === 'FAMILY_EDUCATION_DISTILLATION_SUBSET_MANIFEST', `asset_ref=${subsetManifest.asset_ref ?? '-'}`);
    record('SubsetGovernance', subsetManifest.governance?.status === 'SUBSET_REVIEW_ONLY', `status=${subsetManifest.governance?.status ?? '-'}`);
    record('SubsetGovernance', subsetManifest.governance?.production_training_authorized === false, 'production_training_authorized=false');
    record('SubsetGovernance', subsetManifest.governance?.production_retrieval_authorized === false, 'production_retrieval_authorized=false');
    record('SubsetGovernance', subsetManifest.governance?.database_write_authorized === false, 'database_write_authorized=false');
    record('SubsetGovernance', subsetManifest.governance?.core_ontology_write_authorized === false, 'core_ontology_write_authorized=false');
    for (const output of subsetManifest.outputs ?? []) {
      const outputPath = join(root, output.path);
      if (!existsSync(outputPath)) {
        record('SubsetOutput', false, `${output.path} missing`);
        continue;
      }
      const inspection = await inspectJsonl(outputPath);
      record('SubsetOutput', inspection.count === output.records, `${output.subset_ref} records=${inspection.count}/${output.records}`);
      record('SubsetOutput', output.records <= output.target_records, `${output.subset_ref} target=${output.records}/${output.target_records}`);
      for (const [edge, row] of [['first', inspection.first], ['last', inspection.last]]) {
        record('SubsetRow', row?.asset_ref === 'FAMILY_EDUCATION_DISTILLATION_SUBSET_RECORD', `${output.subset_ref} ${edge} asset_ref=${row?.asset_ref ?? '-'}`);
        record('SubsetRow', row?.migration_status === 'DISTILLED_TO_REVIEW_SUBSET', `${output.subset_ref} ${edge} migration_status=${row?.migration_status ?? '-'}`);
        record('SubsetRow', row?.subset_ref === output.subset_ref, `${output.subset_ref} ${edge} subset_ref=${row?.subset_ref ?? '-'}`);
        record('SubsetRow', row?.source?.review_status === 'NEEDS_HUMAN_REVIEW', `${output.subset_ref} ${edge} review_status=${row?.source?.review_status ?? '-'}`);
        record('SubsetRow', (row?.family_mapping?.forbidden_current_use ?? []).includes('production_training'), `${output.subset_ref} ${edge} production_training forbidden`);
        record('SubsetRow', (row?.family_mapping?.forbidden_current_use ?? []).includes('production_retrieval'), `${output.subset_ref} ${edge} production_retrieval forbidden`);
      }
    }
  } catch (error) {
    record('SubsetManifest', false, `${rel(subsetManifestPath)} :: ${error.message.split('\n')[0]}`);
  }
}

const multiApiReportPath = join(root, 'reports', 'multi-api-distillation', 'multi-api-distillation-run.latest.json');
if (existsSync(multiApiReportPath)) {
  try {
    const report = readJson(multiApiReportPath);
    record('MultiApiDistillationReport', report.asset_ref === 'FAMILY_MULTI_API_DISTILLATION_RUN_REPORT', `asset_ref=${report.asset_ref ?? '-'}`);
    record('MultiApiDistillationReport', ['CONFIG_FAILED_FAIL_CLOSED', 'PASS'].includes(report.status), `status=${report.status ?? '-'}`);
    record('MultiApiDistillationBoundary', report.database_schema_change === 'NOT_TOUCHED', `database_schema_change=${report.database_schema_change ?? '-'}`);
    record('MultiApiDistillationBoundary', report.production_training_authorized === false, 'production_training_authorized=false');
    if (report.status === 'CONFIG_FAILED_FAIL_CLOSED') {
      record('MultiApiDistillationBoundary', report.external_ai_invoked === false, `external_ai_invoked=${report.external_ai_invoked}`);
      record('MultiApiDistillationReport', (report.failures ?? []).length > 0, `failures=${report.failures?.length ?? 0}`);
    } else {
      record('MultiApiDistillationBoundary', report.external_ai_invoked === true, `external_ai_invoked=${report.external_ai_invoked}`);
      record('MultiApiDistillationReport', report.output_use === 'review_only_candidate_generation', `output_use=${report.output_use ?? '-'}`);
    }
  } catch (error) {
    record('MultiApiDistillationReport', false, `${rel(multiApiReportPath)} :: ${error.message.split('\n')[0]}`);
  }
}

const harnessIntegrationPath = join(modelDir, 'family_model_harness.integration.yaml');
if (existsSync(harnessIntegrationPath)) {
  try {
    const harness = readYaml(harnessIntegrationPath);
    const lanes = harness?.harness_lanes ?? [];
    const toolEntrypoints = harness?.tool_entrypoints ?? [];
    const familyOwnedSourceAssets = harness?.family_owned_source_assets ?? [];

    record('HarnessIntegration', harness?.asset_ref === 'FAMILY_MODEL_HARNESS_INTEGRATION', `asset_ref=${harness?.asset_ref ?? '-'}`);
    record('HarnessIntegrationBoundary', harness?.current_authorization_boundary?.business_runtime === 'NOT_AUTHORIZED', `business_runtime=${harness?.current_authorization_boundary?.business_runtime ?? '-'}`);
    record('HarnessIntegrationBoundary', harness?.current_authorization_boundary?.live_external_ai === 'NOT_AUTHORIZED', `live_external_ai=${harness?.current_authorization_boundary?.live_external_ai ?? '-'}`);
    record('HarnessIntegrationLane', lanes.length > 0, `harness_lanes=${lanes.length}`);
    record('HarnessIntegrationTool', toolEntrypoints.length > 0, `tool_entrypoints=${toolEntrypoints.length}`);
    assertKnownRefs('HarnessIntegrationSourceAsset', 'family_owned_source_assets', familyOwnedSourceAssets, foundationAssetRefs);

    const laneRefs = new Set(lanes.map((lane) => lane.lane_ref).filter(Boolean));
    for (const lane of lanes) {
      record('HarnessIntegrationLane', !!lane.lane_ref && !!lane.role, `${lane.lane_ref ?? '<missing-ref>'} required_fields`);
      record('HarnessIntegrationLaneGate', (lane.required_gates ?? []).length > 0, `${lane.lane_ref} required_gates=${lane.required_gates?.length ?? 0}`);
      assertKnownRefs('HarnessIntegrationLaneInputAsset', lane.lane_ref, lane.input_asset_refs, foundationAssetRefs);
    }

    for (const entrypoint of toolEntrypoints) {
      record('HarnessIntegrationToolCommand', typeof entrypoint.command === 'string' && entrypoint.command.startsWith('pnpm '), `${entrypoint.command ?? '<missing-command>'}`);
      assertKnownRefs('HarnessIntegrationToolLane', entrypoint.command, entrypoint.lane_refs, laneRefs);
      if (entrypoint.command === 'pnpm run smoke:family-model-live') {
        record('HarnessIntegrationLiveSmokeGate', entrypoint.current_gate_allowed === false, `${entrypoint.command} current_gate_allowed=${entrypoint.current_gate_allowed}`);
        record('HarnessIntegrationLiveSmokeGate', (entrypoint.blocked_until ?? []).includes('LIVE_EXTERNAL_AI=AUTHORIZED'), `${entrypoint.command} blocked_until live auth`);
      }
      if (entrypoint.command === 'pnpm run distill:family-model-multi-api -- --live-authorized') {
        record('HarnessIntegrationMultiApiGate', entrypoint.current_gate_allowed === false, `${entrypoint.command} current_gate_allowed=${entrypoint.current_gate_allowed}`);
        record('HarnessIntegrationMultiApiGate', (entrypoint.blocked_until ?? []).includes('LIVE_EXTERNAL_AI=AUTHORIZED'), `${entrypoint.command} blocked_until live auth`);
        record('HarnessIntegrationMultiApiGate', (entrypoint.output_reports ?? []).includes('reports/multi-api-distillation/multi-api-distillation-run.latest.json'), `${entrypoint.command} output report registered`);
      }
    }
  } catch (error) {
    record('HarnessIntegration', false, `${rel(harnessIntegrationPath)} :: ${error.message.split('\n')[0]}`);
  }
} else {
  record('HarnessIntegration', false, `${rel(harnessIntegrationPath)} missing`);
}

const byArea = new Map();
for (const result of results) {
  if (!byArea.has(result.area)) byArea.set(result.area, { ok: 0, fail: 0, fails: [] });
  const summary = byArea.get(result.area);
  if (result.ok) summary.ok += 1;
  else {
    summary.fail += 1;
    summary.fails.push(result.detail);
  }
}

console.log('=== Family Education Model Foundation Validation ===');
let failed = false;
for (const [area, summary] of byArea.entries()) {
  console.log(`${summary.fail === 0 ? 'PASS' : 'FAIL'}  ${area}: ok=${summary.ok} fail=${summary.fail}`);
  for (const detail of summary.fails) {
    console.log(`      x ${detail}`);
    failed = true;
  }
}

console.log(`\nTotal checks: ${results.length}; failed: ${results.filter((result) => !result.ok).length}`);
process.exit(failed ? 1 : 0);