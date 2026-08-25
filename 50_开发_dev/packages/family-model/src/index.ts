import type { AiGateway, StructuredGenerationRequest } from '@family/ai-gateway';

export type FamilyModelBoundaryLabel =
  | 'perspective_not_fact'
  | 'signal_not_diagnosis'
  | 'hypothesis_not_fact'
  | 'recommendation_not_decision'
  | 'action_requires_named_action'
  | 'outcome_required_for_completion';

export type FamilyModelIntegrationBoundaryLabel = FamilyModelBoundaryLabel | 'artifact_signal_not_diagnosis' | 'evidence_level_required' | 'consent_required' | 'memory_update_candidate_not_fact' | 'action_not_outcome' | 'service_completion_not_growth_outcome' | 'human_gate_for_high_risk';

export interface FamilyAssessmentItem {
  item_ref: string;
  prompt: string;
  construct_refs: string[];
  need_refs: string[];
  safety_boundary?: string;
}

export type FamilySafetyScreeningStatus = 'CLEAR' | 'REVIEW_REQUIRED' | 'BLOCKED';

export interface FamilySafetyScreeningResult {
  status: FamilySafetyScreeningStatus;
  requires_human_review: boolean;
  reason_refs: string[];
  uncertainty_refs: string[];
  errors: string[];
}

/**
 * 独立于题目 annotation 的家庭安全筛查器。
 * 它只产生门禁信号，不产生诊断、分数或业务状态。
 */
export class FamilySafetyScreeningService {
  screen(
    responses: FamilyAssessmentResponseSignal[],
    itemBank: FamilyAssessmentItem[] | Map<string, FamilyAssessmentItem>,
  ): FamilySafetyScreeningResult {
    const items = itemBank instanceof Map ? itemBank : new Map(itemBank.map((item) => [item.item_ref, item]));
    const reasonRefs = new Set<string>();
    const uncertaintyRefs = new Set<string>();
    const errors: string[] = [];

    try {
      const safetyItems = Array.from(items.values()).filter((item) => !!item.safety_boundary);
      const observedSafetySignals = responses.filter((response) => {
        const item = items.get(response.item_ref);
        return !!item?.safety_boundary;
      });

      for (const response of observedSafetySignals) {
        const normalized = String(response.answer_ref ?? '').trim().toUpperCase();
        if (!normalized) {
          errors.push(`empty_safety_answer:${response.item_ref}`);
          continue;
        }
        if (normalized === 'NOT_SURE' || normalized === 'UNKNOWN' || normalized === 'PREFER_NOT_TO_SAY') {
          uncertaintyRefs.add(response.item_ref);
          reasonRefs.add(`SAFETY_UNCERTAINTY:${response.item_ref}`);
        }
        if (['OFTEN', 'YES', 'TRUE', 'HIGH', 'SEVERE', 'CRISIS'].includes(normalized)) {
          reasonRefs.add(response.item_ref);
        }
      }

      const highSignalCount = observedSafetySignals.filter((response) =>
        ['OFTEN', 'YES', 'TRUE', 'HIGH', 'SEVERE', 'CRISIS'].includes(String(response.answer_ref ?? '').trim().toUpperCase()),
      ).length;
      if (highSignalCount >= 2) reasonRefs.add('SAFETY_COMBINATION_MULTIPLE_HIGH_SIGNALS');

      const malformedResponse = responses.some((response) => !response.item_ref || response.answer_ref === undefined || response.answer_ref === null);
      if (malformedResponse) errors.push('malformed_safety_input');

      // 缺失安全题本身是“不确定性”，只有和已有高风险信号组合时才升级人工复核，避免把普通未作答误报成危机。
      const missingSafetyItems = safetyItems
        .filter((item) => !observedSafetySignals.some((response) => response.item_ref === item.item_ref))
        .map((item) => item.item_ref);
      if (highSignalCount > 0) {
        for (const itemRef of missingSafetyItems) uncertaintyRefs.add(itemRef);
        if (missingSafetyItems.length > 0) reasonRefs.add('SAFETY_SCREEN_INCOMPLETE_WITH_HIGH_SIGNAL');
      }

      if (errors.length > 0) {
        return { status: 'BLOCKED', requires_human_review: true, reason_refs: [...reasonRefs, 'SAFETY_SCREENING_FAILED'], uncertainty_refs: [...uncertaintyRefs], errors };
      }
      const requiresHumanReview = reasonRefs.size > 0;
      return {
        status: requiresHumanReview ? 'REVIEW_REQUIRED' : 'CLEAR',
        requires_human_review: requiresHumanReview,
        reason_refs: [...reasonRefs],
        uncertainty_refs: [...uncertaintyRefs],
        errors: [],
      };
    } catch {
      return {
        status: 'BLOCKED',
        requires_human_review: true,
        reason_refs: ['SAFETY_SCREENING_FAILED'],
        uncertainty_refs: [],
        errors: ['safety_screening_exception'],
      };
    }
  }
}

export interface FamilyAssessmentActionMap {
  construct_ref: string;
  candidate_action_refs: string[];
}

export interface FamilyAssessmentItemBankAsset {
  asset_ref: 'FAMILY_ASSESSMENT_ITEM_BANK_REGISTRY';
  items: FamilyAssessmentItem[];
  recommended_action_map: FamilyAssessmentActionMap[];
}

export type FamilyModelComponentRef =
  | 'FAMILY_DOMAIN_KERNEL'
  | 'FAMILY_ASSESSMENT_V0_COMPONENT'
  | 'FAMILY_MEMORY_DIALOGUE_COMPONENT'
  | 'FAMILY_REALTIME_DIALOGUE_COMPONENT'
  | 'FAMILY_MULTIMODAL_ARTIFACT_COMPONENT'
  | 'FAMILY_ACTION_OUTCOME_COMPONENT'
  | 'FAMILY_KNOWLEDGE_EVIDENCE_COMPONENT'
  | 'FAMILY_HUMAN_SERVICE_HANDOFF_COMPONENT';

export interface FamilyModelComponentDefinition {
  component_ref: FamilyModelComponentRef;
  component_kind: string;
  version: string;
  dependency_refs: FamilyModelComponentRef[];
  policy_refs: string[];
}

export interface FamilyModelComponentRegistryAsset {
  asset_ref: 'FAMILY_MODEL_COMPONENT_REGISTRY';
  registered_components: FamilyModelComponentDefinition[];
}

export interface FamilyInterpretationTemplate {
  template_ref: string;
  construct_refs: string[];
  action_refs: string[];
  outcome_refs: string[];
  explanation_style: string;
}

export interface FamilyInterpretationSchemaAsset {
  asset_ref: 'FAMILY_INTERPRETATION_SCHEMA';
  interpretation_templates: FamilyInterpretationTemplate[];
  output_contract?: unknown;
}

export interface FamilyAssessmentResponseSignal {
  item_ref: string;
  answer_ref: string;
  answer_label?: string;
  free_text_note?: string;
}

export interface FamilyModelInterpretationInput {
  request_id: string;
  family_context_ref?: string;
  child_age_stage?: string;
  assessment_ref: string;
  responses: FamilyAssessmentResponseSignal[];
}

export interface FamilyNeedSummary {
  need_ref: string;
  basis_item_refs: string[];
}

export interface FamilyConstructSignal {
  construct_ref: string;
  basis_item_refs: string[];
  boundary: 'signal_not_diagnosis';
}

export interface FamilySupportHypothesis {
  hypothesis_ref: string;
  construct_refs: string[];
  basis_item_refs: string[];
  confidence: 'low' | 'medium';
  boundary: 'hypothesis_not_fact';
}

export interface FamilyActionCandidate {
  action_ref: string;
  basis_construct_refs: string[];
  boundary: 'recommendation_not_decision';
}

export interface FamilyModelInterpretationDraft {
  model_component_ref: 'FAMILY_ASSESSMENT_V0_COMPONENT';
  assessment_ref: string;
  boundary_labels: FamilyModelBoundaryLabel[];
  need_summary: FamilyNeedSummary[];
  construct_signals: FamilyConstructSignal[];
  hypotheses: FamilySupportHypothesis[];
  action_candidates: FamilyActionCandidate[];
  human_gate: {
    required: boolean;
    reason_refs: string[];
  };
  prohibited_outputs: string[];
}

export type Ui02AssessmentFocusRef =
  | 'LEARNING_HABITS'
  | 'EMOTION_REGULATION'
  | 'PARENT_CHILD_COMMUNICATION'
  | 'DEVICE_USE_CONTEXT'
  | 'SELF_REGULATION';

export interface FamilyModelUi02AssessmentResponseSignal {
  item_ref: string;
  response_value: string | boolean;
  response_type?: 'SINGLE_CHOICE' | 'TEXT' | 'BOOLEAN';
}

export interface FamilyModelUi02AssessmentResponseSetInput {
  request_id: string;
  assessment_session_id: string;
  tool_ref: string;
  tool_version: number;
  family_context_ref?: string;
  child_age_stage?: string;
  responses: FamilyModelUi02AssessmentResponseSignal[];
}

export interface FamilyModelUi02AssessmentInterpretationDraft {
  backend_capability_ref: 'FAMILY_ASSESSMENT_AI_CAPABILITY';
  ai_use_case: 'ASSESSMENT_INTERPRETATION';
  generator: 'FAMILY_EDUCATION_MODEL_RUNTIME_DETERMINISTIC' | 'FAMILY_EDUCATION_MODEL_RUNTIME_GATEWAY';
  assessment_ref: string;
  focus_ref: Ui02AssessmentFocusRef | null;
  model_input: FamilyModelInterpretationInput;
  draft: FamilyModelInterpretationDraft;
  coverage: {
    source_response_count: number;
    interpreted_response_count: number;
    mapped_item_refs: string[];
    uninterpreted_item_refs: string[];
  };
}

export interface FamilyAssessmentEvidenceCoverage {
  source_response_count: number;
  interpreted_response_count: number;
  coverage_ratio: number;
  mapped_item_refs: string[];
  evidence_summaries: string[];
  uninterpreted_item_refs: string[];
  uncertainty_item_refs: string[];
  uncertainty_reasons: string[];
  support_direction_refs: string[];
  support_direction_labels: string[];
  next_questions?: string[];
}

export interface FamilyAssessmentAiScoreDimension {
  dimension_ref: string;
  label: string;
  score: number;
  peer_reference: number;
}

export interface FamilyAssessmentAiScorecard {
  generated_by: 'FAMILI_PRINCIPAL_FAMILY_EDUCATION_MODEL';
  overall_score: number;
  overall_band: string;
  dimensions: FamilyAssessmentAiScoreDimension[];
  core_issue_tags: string[];
  recommendations: string[];
  score_boundary: 'SUPPORT_ORIENTATION_SCORE_NOT_CHILD_DIAGNOSIS_OR_RANKING';
}

export interface FamilyAssessmentAiSubsystemOutput {
  subsystem_ref: 'FAMILY_ASSESSMENT_AI_SUBSYSTEM';
  subsystem_version: '0.1.0';
  service_depth: 'BASIC_SELF_CHECK' | 'DEEP_AI_INTERPRETATION';
  interpretation: FamilyModelUi02AssessmentInterpretationDraft;
  scorecard: FamilyAssessmentAiScorecard;
  evidence_coverage: FamilyAssessmentEvidenceCoverage;
  boundaries: {
    perspective_boundary: 'PERSPECTIVE_NOT_FACT';
    score_boundary: 'SUPPORT_ORIENTATION_SCORE_NOT_CHILD_DIAGNOSIS_OR_RANKING';
    action_boundary: 'RECOMMENDATION_NOT_DECISION_REQUIRES_NAMED_ACTION';
    may_mutate_business_state: false;
  };
  provenance: {
    assessment_session_id: string;
    tool_ref: string;
    tool_version: number;
    generator: FamilyModelUi02AssessmentInterpretationDraft['generator'];
    source_response_count: number;
    interpreted_response_count: number;
  };
}

export interface FamilyDialogueTurnSignal {
  turn_ref: string;
  speaker_role: 'parent' | 'child' | 'teacher' | 'human_service' | 'ai' | 'system';
  intent_refs?: string[];
  need_refs?: string[];
  construct_refs?: string[];
  action_candidate_refs?: string[];
  outcome_refs?: string[];
  risk_signal_refs?: string[];
  artifact_refs?: string[];
}

export interface FamilyMemoryUpdateCandidateInput {
  request_id: string;
  family_ref: string;
  session_ref: string;
  actor_ref: string;
  consent_ref?: string;
  turns: FamilyDialogueTurnSignal[];
}

export interface FamilyMemoryUpdateCandidate {
  candidate_ref: string;
  family_ref: string;
  source_session_ref: string;
  memory_object_refs: string[];
  boundary_labels: FamilyModelIntegrationBoundaryLabel[];
  need_summary: FamilyNeedSummary[];
  construct_mapping: FamilyConstructSignal[];
  action_candidate_refs: string[];
  outcome_refs: string[];
  artifact_refs: string[];
  risk_signal_refs: string[];
  basis_turn_refs: string[];
  human_gate: {
    required: boolean;
    reason_refs: string[];
  };
  blocked_reasons: string[];
  requires_named_action: 'ConfirmMemoryUpdateCandidate';
  may_mutate_business_state: false;
}

export const FAMILY_MODEL_INTERPRETATION_OUTPUT_SCHEMA = {
  type: 'object',
  required: ['model_component_ref', 'assessment_ref', 'boundary_labels', 'need_summary', 'construct_signals', 'hypotheses', 'action_candidates', 'human_gate', 'prohibited_outputs'],
  additionalProperties: false,
  properties: {
    model_component_ref: { const: 'FAMILY_ASSESSMENT_V0_COMPONENT' },
    assessment_ref: { type: 'string' },
    boundary_labels: { type: 'array', items: { type: 'string' }, minItems: 1 },
    need_summary: { type: 'array' },
    construct_signals: { type: 'array' },
    hypotheses: { type: 'array' },
    action_candidates: { type: 'array' },
    human_gate: { type: 'object' },
    prohibited_outputs: { type: 'array', items: { type: 'string' } },
  },
} as const;

export interface FamilyEducationModelRuntimeOptions {
  itemBank: FamilyAssessmentItemBankAsset;
  interpretationSchema: FamilyInterpretationSchemaAsset;
  gateway?: AiGateway;
}

export const FAMILY_EDUCATION_ASSESSMENT_ITEM_BANK: FamilyAssessmentItemBankAsset = {
  asset_ref: 'FAMILY_ASSESSMENT_ITEM_BANK_REGISTRY',
  items: [
    {
      item_ref: 'PARENT_CHILD_TALK_INTERRUPTION',
      prompt: 'When the child tries to explain a difficulty, how often does the conversation become interrupted, corrected, or rushed?',
      construct_refs: ['PARENT_CHILD_COMMUNICATION'],
      need_refs: ['CHILD_RELATIONSHIP_NEED', 'FAMILY_COMMUNICATION_NEED', 'PARENT_METHOD_NEED'],
    },
    {
      item_ref: 'CHILD_WILLINGNESS_TO_TALK',
      prompt: 'In the last two weeks, how willing was the child to talk with the parent about worries, mistakes, or pressure?',
      construct_refs: ['PARENT_CHILD_COMMUNICATION'],
      need_refs: ['CHILD_RELATIONSHIP_NEED', 'FAMILY_COMMUNICATION_NEED'],
    },
    {
      item_ref: 'HOMEWORK_START_DELAY',
      prompt: 'How often does homework start with delay, negotiation, avoidance, or conflict?',
      construct_refs: ['HOMEWORK_PROCESS', 'FAMILY_ROUTINE'],
      need_refs: ['CHILD_LEARNING_SUPPORT_NEED', 'FAMILY_LEARNING_ENVIRONMENT_NEED'],
    },
    {
      item_ref: 'CHILD_ERROR_REVIEW_PATTERN',
      prompt: 'After mistakes in homework or tests, how often does the child review the reason and try a new method?',
      construct_refs: ['LEARNING_STRATEGY_METACOGNITION', 'ACADEMIC_DEVELOPMENT'],
      need_refs: ['CHILD_LEARNING_SUPPORT_NEED'],
    },
    {
      item_ref: 'SLEEP_ENERGY_LEARNING_IMPACT',
      prompt: 'How often do sleep, tiredness, appetite, movement, eyesight, or posture appear to affect learning or mood?',
      construct_refs: ['PHYSICAL_HEALTH_RHYTHM', 'PSYCHOSOMATIC_STRESS_SIGNAL'],
      need_refs: ['CHILD_PHYSICAL_HEALTH_NEED', 'FAMILY_RHYTHM_NEED', 'CHILD_EMOTIONAL_SUPPORT_NEED'],
      safety_boundary: 'human_gate_if_health_risk',
    },
    {
      item_ref: 'DEVICE_RULE_CONFLICT',
      prompt: 'How often does device or AI tool use lead to conflict, sleep delay, homework interruption, or unclear rules?',
      construct_refs: ['DEVICE_USE_CONTEXT', 'AI_LITERACY_FLUENCY'],
      need_refs: ['CHILD_DIGITAL_AI_NEED', 'FAMILY_RHYTHM_NEED', 'FAMILY_COMMUNICATION_NEED'],
    },
    {
      item_ref: 'AI_LEARNING_USE_CLARITY',
      prompt: 'When the child uses AI tools for learning, how clear are the rules for asking, verifying, citing, and not replacing thinking?',
      construct_refs: ['AI_LITERACY_FLUENCY'],
      need_refs: ['CHILD_DIGITAL_AI_NEED', 'PARENT_LEARNING_NEED'],
    },
    {
      item_ref: 'MULTIMODAL_CREATION_OPPORTUNITY',
      prompt: 'How often does the child create or explain learning through images, audio, video, charts, code, presentations, or mixed media?',
      construct_refs: ['MULTIMODAL_CREATION', 'SUBJECT_LEARNING_PROFILE', 'MULTIPLE_INTELLIGENCE_PROFILE'],
      need_refs: ['CHILD_DIGITAL_AI_NEED', 'CHILD_LEARNING_SUPPORT_NEED', 'CHILD_IDENTITY_STRENGTH_NEED'],
    },
    {
      item_ref: 'PARENT_CAPACITY_PRESSURE',
      prompt: 'In the last two weeks, how often did the parent feel too tired, anxious, or rushed to respond consistently?',
      construct_refs: ['PARENT_CAPACITY'],
      need_refs: ['PARENT_EMOTIONAL_SUPPORT_NEED', 'PARENT_METHOD_NEED'],
      safety_boundary: 'human_gate_if_parent_crisis',
    },
    {
      item_ref: 'SCHOOL_FAMILY_FEEDBACK_LOOP',
      prompt: 'How clear is the loop among teacher feedback, parent understanding, child action, and later review?',
      construct_refs: ['SCHOOL_FAMILY_COLLABORATION', 'ACADEMIC_DEVELOPMENT'],
      need_refs: ['FAMILY_SCHOOL_ALIGNMENT_NEED', 'PARENT_COLLABORATION_NEED'],
    },
  ],
  recommended_action_map: [
    { construct_ref: 'PARENT_CHILD_COMMUNICATION', candidate_action_refs: ['COMMUNICATION_REPAIR_CONVERSATION'] },
    { construct_ref: 'HOMEWORK_PROCESS', candidate_action_refs: ['SEVEN_DAY_HOMEWORK_START_RITUAL'] },
    { construct_ref: 'LEARNING_STRATEGY_METACOGNITION', candidate_action_refs: ['SEVEN_DAY_HOMEWORK_START_RITUAL', 'SCHOOL_FAMILY_FEEDBACK_HANDOFF'] },
    { construct_ref: 'PHYSICAL_HEALTH_RHYTHM', candidate_action_refs: ['SLEEP_AND_ENERGY_RHYTHM_CHECK'] },
    { construct_ref: 'PSYCHOSOMATIC_STRESS_SIGNAL', candidate_action_refs: ['SLEEP_AND_ENERGY_RHYTHM_CHECK', 'HUMAN_SERVICE_CONTEXT_PACKAGE'] },
    { construct_ref: 'DEVICE_USE_CONTEXT', candidate_action_refs: ['FAMILY_DEVICE_AGREEMENT_DRAFT', 'AI_USE_FAMILY_RULES_MINI_PLAN'] },
    { construct_ref: 'AI_LITERACY_FLUENCY', candidate_action_refs: ['AI_USE_FAMILY_RULES_MINI_PLAN'] },
    { construct_ref: 'MULTIMODAL_CREATION', candidate_action_refs: ['MULTIMODAL_LEARNING_ARTIFACT_REVIEW'] },
    { construct_ref: 'PARENT_CAPACITY', candidate_action_refs: ['HUMAN_SERVICE_CONTEXT_PACKAGE'] },
    { construct_ref: 'SCHOOL_FAMILY_COLLABORATION', candidate_action_refs: ['SCHOOL_FAMILY_FEEDBACK_HANDOFF', 'HUMAN_SERVICE_CONTEXT_PACKAGE'] },
  ],
};

export const FAMILY_EDUCATION_INTERPRETATION_SCHEMA: FamilyInterpretationSchemaAsset = {
  asset_ref: 'FAMILY_INTERPRETATION_SCHEMA',
  interpretation_templates: [
    {
      template_ref: 'RELATIONSHIP_SUPPORT_TEMPLATE',
      construct_refs: ['PARENT_CHILD_COMMUNICATION', 'PARENT_CAPACITY'],
      action_refs: ['COMMUNICATION_REPAIR_CONVERSATION', 'HUMAN_SERVICE_CONTEXT_PACKAGE'],
      outcome_refs: ['RELATIONSHIP_REPAIR_SIGNAL', 'PARENT_RESPONSE_STABILITY_SIGNAL'],
      explanation_style: 'separate_family_perspective_signal_from_support_hypothesis',
    },
    {
      template_ref: 'LEARNING_ROUTINE_TEMPLATE',
      construct_refs: ['HOMEWORK_PROCESS', 'FAMILY_ROUTINE', 'LEARNING_STRATEGY_METACOGNITION', 'ACADEMIC_DEVELOPMENT'],
      action_refs: ['SEVEN_DAY_HOMEWORK_START_RITUAL', 'SCHOOL_FAMILY_FEEDBACK_HANDOFF'],
      outcome_refs: ['HOMEWORK_START_RHYTHM_SIGNAL', 'LEARNING_REVIEW_SIGNAL'],
      explanation_style: 'connect_home_context_to_practice_candidate',
    },
    {
      template_ref: 'DIGITAL_AI_LIFE_TEMPLATE',
      construct_refs: ['DEVICE_USE_CONTEXT', 'AI_LITERACY_FLUENCY', 'MULTIMODAL_CREATION'],
      action_refs: ['FAMILY_DEVICE_AGREEMENT_DRAFT', 'AI_USE_FAMILY_RULES_MINI_PLAN', 'MULTIMODAL_LEARNING_ARTIFACT_REVIEW'],
      outcome_refs: ['DIGITAL_RULE_CLARITY_SIGNAL', 'AI_LEARNING_USE_QUALITY_SIGNAL'],
      explanation_style: 'translate_digital_context_into_family_rule_and_learning_fluency_candidates',
    },
    {
      template_ref: 'RHYTHM_AND_EMOTION_TEMPLATE',
      construct_refs: ['PHYSICAL_HEALTH_RHYTHM', 'PSYCHOSOMATIC_STRESS_SIGNAL', 'PARENT_CAPACITY'],
      action_refs: ['SLEEP_AND_ENERGY_RHYTHM_CHECK', 'HUMAN_SERVICE_CONTEXT_PACKAGE'],
      outcome_refs: ['ENERGY_RHYTHM_SIGNAL', 'STRESS_RECOVERY_SIGNAL'],
      explanation_style: 'hold_health_related_signals_for_contextual_review',
    },
  ],
  output_contract: FAMILY_MODEL_INTERPRETATION_OUTPUT_SCHEMA,
};

export function createFamilyEducationAssessmentModelRuntime(gateway?: AiGateway): FamilyEducationModelRuntime {
  return new FamilyEducationModelRuntime({
    itemBank: FAMILY_EDUCATION_ASSESSMENT_ITEM_BANK,
    interpretationSchema: FAMILY_EDUCATION_INTERPRETATION_SCHEMA,
    gateway,
  });
}

export interface FamilyPlatformCapabilityInput {
  surface_ref: string;
  requested_component_refs: FamilyModelComponentRef[];
  multimodal_artifact_refs?: string[];
  memory_context_ref?: string;
  conversation_context_ref?: string;
}

export interface FamilyPlatformCapabilityPlan {
  surface_ref: string;
  ordered_component_refs: FamilyModelComponentRef[];
  enabled_capabilities: string[];
  missing_component_refs: FamilyModelComponentRef[];
  human_confirmation_required: boolean;
  may_mutate_business_state: false;
  boundary_labels: FamilyModelBoundaryLabel[];
  policy_refs: string[];
}

export interface FamilyModelArchitectureLayer {
  layer_ref: string;
  layer_kind: string;
  owned_by: string;
  component_refs: FamilyModelComponentRef[];
  primary_contract_refs: string[];
  implementation_refs?: string[];
  may_mutate_business_state: false;
}

export interface FamilyModelGatewayProfile {
  profile_ref: string;
  provider_kind: string;
  provider_id: string;
  live_external_ai_required: boolean;
  default_for_current_gate?: boolean;
  required_env?: string[];
  allowed_use?: string[];
  forbidden_use?: string[];
}

export interface FamilyModelArchitectureFlow {
  flow_ref: string;
  flow_kind: string;
  trigger_surface_refs: string[];
  ordered_layer_refs: string[];
  input_refs: string[];
  output_refs: string[];
  required_boundary_labels: FamilyModelBoundaryLabel[];
  may_mutate_business_state: false;
  authorization_required_for_live_ai: boolean;
}

export interface FamilyModelTechnicalArchitectureAsset {
  asset_ref: 'FAMILY_MODEL_TECHNICAL_ARCHITECTURE_REGISTRY';
  architecture_id: string;
  runtime_boundary: {
    current_gate: string;
    business_runtime: 'AUTHORIZED' | 'NOT_AUTHORIZED';
    database_schema_change: 'AUTHORIZED' | 'NOT_AUTHORIZED';
    live_external_ai: 'AUTHORIZED' | 'NOT_AUTHORIZED';
    allowed_now: string[];
    forbidden_now: string[];
  };
  architecture_layers: FamilyModelArchitectureLayer[];
  model_gateway_profiles: FamilyModelGatewayProfile[];
  architecture_flows: FamilyModelArchitectureFlow[];
}

export interface FamilyModelArchitecturePlanInput {
  flow_ref: string;
  business_runtime_authorized?: boolean;
  live_external_ai_authorized?: boolean;
  available_env_keys?: string[];
}

export interface FamilyModelArchitecturePlan {
  architecture_id: string;
  flow_ref: string;
  flow_kind: string;
  ordered_layer_refs: string[];
  ordered_component_refs: FamilyModelComponentRef[];
  input_refs: string[];
  output_refs: string[];
  required_boundary_labels: FamilyModelBoundaryLabel[];
  gateway_profile_refs: string[];
  blocked_reasons: string[];
  may_call_live_external_ai: boolean;
  may_mutate_business_state: false;
}

export interface FamilyModelRuntimeIntegrationFlowContract {
  flow_ref: string;
  surface_refs: string[];
  purpose_refs: string[];
  draft_kind: string;
  requires_consent: boolean;
  may_call_live_external_ai_after_authorization: boolean;
  may_mutate_business_state: false;
  required_boundary_labels: FamilyModelIntegrationBoundaryLabel[];
  worker_allowed: boolean;
  candidate_events_after_authorization: string[];
}

export interface FamilyModelRuntimeIntegrationContractAsset {
  asset_ref: 'FAMILY_MODEL_RUNTIME_INTEGRATION_CONTRACT';
  current_authorization_boundary: {
    business_runtime: 'AUTHORIZED' | 'NOT_AUTHORIZED';
    database_schema_change: 'AUTHORIZED' | 'NOT_AUTHORIZED';
    live_external_ai: 'AUTHORIZED' | 'NOT_AUTHORIZED';
  };
  canonical_runtime: {
    package: string;
    planner: string;
    gateway_package: string;
    architecture_asset_ref: string;
    human_readable_contract: string;
  };
  governed_flow_contracts: FamilyModelRuntimeIntegrationFlowContract[];
  forbidden_integration_paths: string[];
}

export interface FamilyModelRuntimeIntegrationRequest {
  request_id: string;
  surface_ref: string;
  flow_ref: string;
  actor_ref: string;
  purpose_ref: string;
  consent_ref?: string;
  payload: unknown;
  execution_context?: 'api' | 'worker';
  business_runtime_authorized?: boolean;
  live_external_ai_authorized?: boolean;
  available_env_keys?: string[];
}

export interface FamilyModelRuntimeIntegrationPlan {
  request_id: string;
  surface_ref: string;
  flow_ref: string;
  purpose_ref: string;
  draft_kind: string;
  architecture_plan: FamilyModelArchitecturePlan;
  blocked_reasons: string[];
  boundary_labels: FamilyModelIntegrationBoundaryLabel[];
  candidate_event_names: string[];
  requires_human_confirmation: true;
  allowed_next_named_actions: string[];
  may_execute: boolean;
  may_call_live_external_ai: boolean;
  may_mutate_business_state: false;
}

export class FamilyEducationModelRuntime {
  private readonly itemsByRef: Map<string, FamilyAssessmentItem>;
  private readonly actionRefsByConstruct: Map<string, string[]>;

  constructor(private readonly options: FamilyEducationModelRuntimeOptions) {
    this.itemsByRef = new Map(options.itemBank.items.map((item) => [item.item_ref, item]));
    this.actionRefsByConstruct = new Map(
      options.itemBank.recommended_action_map.map((mapping) => [mapping.construct_ref, mapping.candidate_action_refs]),
    );
  }

  buildInterpretationInputFromUi02Assessment(input: FamilyModelUi02AssessmentResponseSetInput): FamilyModelInterpretationInput {
    return {
      request_id: input.request_id,
      family_context_ref: input.family_context_ref,
      child_age_stage: input.child_age_stage,
      assessment_ref: assessmentRefForUi02(input),
      responses: this.mapUi02ResponsesToModelSignals(input.responses),
    };
  }

  interpretUi02AssessmentResponses(input: FamilyModelUi02AssessmentResponseSetInput): FamilyModelUi02AssessmentInterpretationDraft {
    const modelInput = this.buildInterpretationInputFromUi02Assessment(input);
    return this.buildUi02InterpretationDraft(input, modelInput, this.interpretDeterministically(modelInput), 'FAMILY_EDUCATION_MODEL_RUNTIME_DETERMINISTIC');
  }

  async generateUi02AssessmentGatewayDraft(input: FamilyModelUi02AssessmentResponseSetInput): Promise<FamilyModelUi02AssessmentInterpretationDraft> {
    const modelInput = this.buildInterpretationInputFromUi02Assessment(input);
    return this.buildUi02InterpretationDraft(input, modelInput, await this.generateGatewayDraft(modelInput), this.options.gateway ? 'FAMILY_EDUCATION_MODEL_RUNTIME_GATEWAY' : 'FAMILY_EDUCATION_MODEL_RUNTIME_DETERMINISTIC');
  }

  assessUi02ResponseSet(input: FamilyModelUi02AssessmentResponseSetInput, serviceDepth: FamilyAssessmentAiSubsystemOutput['service_depth'] = 'DEEP_AI_INTERPRETATION'): FamilyAssessmentAiSubsystemOutput {
    const interpretation = this.interpretUi02AssessmentResponses(input);
    return this.buildAssessmentSubsystemOutput(input, interpretation, serviceDepth);
  }

  async generateUi02AssessmentSubsystemOutput(input: FamilyModelUi02AssessmentResponseSetInput, serviceDepth: FamilyAssessmentAiSubsystemOutput['service_depth'] = 'DEEP_AI_INTERPRETATION'): Promise<FamilyAssessmentAiSubsystemOutput> {
    const interpretation = await this.generateUi02AssessmentGatewayDraft(input);
    return this.buildAssessmentSubsystemOutput(input, interpretation, serviceDepth);
  }

  interpretDeterministically(input: FamilyModelInterpretationInput): FamilyModelInterpretationDraft {
    const matchedItems = input.responses
      .filter((response) => isEvidenceBearingAnswer(response.answer_ref))
      .map((response) => this.itemsByRef.get(response.item_ref))
      .filter((item): item is FamilyAssessmentItem => !!item);
    const needRefs = collectRefs(matchedItems, 'need_refs');
    const constructRefs = collectRefs(matchedItems, 'construct_refs');
    const basisItemRefsByNeed = groupBasisByRef(matchedItems, 'need_refs');
    const basisItemRefsByConstruct = groupBasisByRef(matchedItems, 'construct_refs');
    const actionCandidates = this.actionCandidatesForConstructs(constructRefs);
    const annotationGateReasons = matchedItems
      .filter((item) => item.safety_boundary?.includes('human_gate'))
      .map((item) => item.item_ref);
    const safetyScreening = new FamilySafetyScreeningService().screen(input.responses, this.itemsByRef);
    const humanGateReasons = uniqueRefs([...annotationGateReasons, ...safetyScreening.reason_refs]);

    return {
      model_component_ref: 'FAMILY_ASSESSMENT_V0_COMPONENT',
      assessment_ref: input.assessment_ref,
      boundary_labels: [
        'perspective_not_fact',
        'signal_not_diagnosis',
        'hypothesis_not_fact',
        'recommendation_not_decision',
        'action_requires_named_action',
        'outcome_required_for_completion',
      ],
      need_summary: needRefs.map((need_ref) => ({ need_ref, basis_item_refs: basisItemRefsByNeed.get(need_ref) ?? [] })),
      construct_signals: constructRefs.map((construct_ref) => ({
        construct_ref,
        basis_item_refs: basisItemRefsByConstruct.get(construct_ref) ?? [],
        boundary: 'signal_not_diagnosis',
      })),
      hypotheses: constructRefs.map((construct_ref, index) => ({
        hypothesis_ref: `HYP_${index + 1}_${construct_ref}`,
        construct_refs: [construct_ref],
        basis_item_refs: basisItemRefsByConstruct.get(construct_ref) ?? [],
        confidence: 'low',
        boundary: 'hypothesis_not_fact',
      })),
      action_candidates: actionCandidates,
      human_gate: {
        required: safetyScreening.requires_human_review || humanGateReasons.length > 0,
        reason_refs: humanGateReasons,
      },
      prohibited_outputs: ['family_total_score', 'family_ranking', 'child_ranking', 'medical_diagnosis', 'psychiatric_diagnosis'],
    };
  }

  async generateGatewayDraft(input: FamilyModelInterpretationInput): Promise<FamilyModelInterpretationDraft> {
    if (!this.options.gateway) return this.interpretDeterministically(input);
    const deterministicDraft = this.interpretDeterministically(input);
    const request: StructuredGenerationRequest<FamilyModelInterpretationInput & { deterministic_draft: FamilyModelInterpretationDraft }, FamilyModelInterpretationDraft> = {
      use_case: 'FAMILY_EDUCATION_ASSESSMENT_INTERPRETATION',
      prompt_version: 'family-education-assessment-v0.1',
      schema_version: 'family-interpretation-draft.schema.v0.1',
      input: { ...input, deterministic_draft: deterministicDraft },
      output_schema: FAMILY_MODEL_INTERPRETATION_OUTPUT_SCHEMA,
      input_refs: [input.assessment_ref, this.options.itemBank.asset_ref, this.options.interpretationSchema.asset_ref],
      policy_context: {
        human_confirmation_required: true,
        may_mutate_business_state: false,
      },
    };
    const result = await this.options.gateway.generateStructured(request);
    return assertInterpretationBoundary(result.output);
  }

  private actionCandidatesForConstructs(constructRefs: string[]): FamilyActionCandidate[] {
    const actionRefsByAction = new Map<string, Set<string>>();
    for (const constructRef of constructRefs) {
      for (const actionRef of this.actionRefsByConstruct.get(constructRef) ?? []) {
        if (!actionRefsByAction.has(actionRef)) actionRefsByAction.set(actionRef, new Set());
        actionRefsByAction.get(actionRef)?.add(constructRef);
      }
    }
    return Array.from(actionRefsByAction.entries()).map(([action_ref, basisConstructRefs]) => ({
      action_ref,
      basis_construct_refs: Array.from(basisConstructRefs),
      boundary: 'recommendation_not_decision',
    }));
  }

  private mapUi02ResponsesToModelSignals(responses: FamilyModelUi02AssessmentResponseSignal[]): FamilyAssessmentResponseSignal[] {
    const signals: FamilyAssessmentResponseSignal[] = [];
    const seen = new Set<string>();
    const pushSignal = (item_ref: string, answer_ref: string, answer_label?: string, sourceItemRef?: string) => {
      if (!this.itemsByRef.has(item_ref)) return;
      const key = item_ref;
      if (seen.has(key)) return;
      seen.add(key);
      signals.push({ item_ref, answer_ref, answer_label });
    };

    for (const response of responses) {
      if (this.itemsByRef.has(response.item_ref)) {
        pushSignal(response.item_ref, String(response.response_value), undefined, response.item_ref);
        continue;
      }
      if (response.item_ref === 'FOCUS') {
        // FOCUS 只定义本次自查范围，不是家庭证据，不能自动制造需要或构念信号。
        continue;
      }
      for (const mappedItemRef of ui02ItemRefsForDeepQuestion(response.item_ref)) {
        pushSignal(mappedItemRef, String(response.response_value), undefined, response.item_ref);
      }
    }

    return signals;
  }

  private buildUi02InterpretationDraft(
    sourceInput: FamilyModelUi02AssessmentResponseSetInput,
    modelInput: FamilyModelInterpretationInput,
    draft: FamilyModelInterpretationDraft,
    generator: FamilyModelUi02AssessmentInterpretationDraft['generator'],
  ): FamilyModelUi02AssessmentInterpretationDraft {
    const mappedItemRefs = uniqueRefs(modelInput.responses.map((response) => response.item_ref));
    return {
      backend_capability_ref: 'FAMILY_ASSESSMENT_AI_CAPABILITY',
      ai_use_case: 'ASSESSMENT_INTERPRETATION',
      generator,
      assessment_ref: modelInput.assessment_ref,
      focus_ref: focusRefFromResponses(sourceInput.responses),
      model_input: modelInput,
      draft,
      coverage: {
        source_response_count: sourceInput.responses.length,
        interpreted_response_count: mappedItemRefs.length,
        mapped_item_refs: mappedItemRefs,
        uninterpreted_item_refs: sourceInput.responses
          .map((response) => response.item_ref)
          .filter((itemRef) => !this.itemsByRef.has(itemRef) && itemRef !== 'FOCUS' && ui02ItemRefsForDeepQuestion(itemRef).length === 0),
      },
    };
  }

  private buildAssessmentSubsystemOutput(
    sourceInput: FamilyModelUi02AssessmentResponseSetInput,
    interpretation: FamilyModelUi02AssessmentInterpretationDraft,
    serviceDepth: FamilyAssessmentAiSubsystemOutput['service_depth'],
  ): FamilyAssessmentAiSubsystemOutput {
    return {
      subsystem_ref: 'FAMILY_ASSESSMENT_AI_SUBSYSTEM',
      subsystem_version: '0.1.0',
      service_depth: serviceDepth,
      interpretation,
      scorecard: buildAssessmentAiScorecard(sourceInput, interpretation),
      evidence_coverage: buildEvidenceCoverage(sourceInput, interpretation, this.itemsByRef),
      boundaries: {
        perspective_boundary: 'PERSPECTIVE_NOT_FACT',
        score_boundary: 'SUPPORT_ORIENTATION_SCORE_NOT_CHILD_DIAGNOSIS_OR_RANKING',
        action_boundary: 'RECOMMENDATION_NOT_DECISION_REQUIRES_NAMED_ACTION',
        may_mutate_business_state: false,
      },
      provenance: {
        assessment_session_id: sourceInput.assessment_session_id,
        tool_ref: sourceInput.tool_ref,
        tool_version: sourceInput.tool_version,
        generator: interpretation.generator,
        source_response_count: interpretation.coverage.source_response_count,
        interpreted_response_count: interpretation.coverage.interpreted_response_count,
      },
    };
  }
}

function buildEvidenceCoverage(
  sourceInput: FamilyModelUi02AssessmentResponseSetInput,
  interpretation: FamilyModelUi02AssessmentInterpretationDraft,
  itemsByRef: Map<string, FamilyAssessmentItem>,
): FamilyAssessmentEvidenceCoverage {
  const responses = sourceInput.responses;
  const uncertaintyResponses = responses.filter((response) => ['NOT_SURE', 'UNKNOWN', 'PREFER_NOT_TO_SAY'].includes(String(response.response_value).trim().toUpperCase()));
  const sourceCount = responses.length;
  const interpretedCount = interpretation.coverage.interpreted_response_count;
  const supportDirectionRefs = interpretation.draft.action_candidates.map((candidate) => candidate.action_ref).filter(uniqueValue);
  const nextQuestions = uncertaintyResponses.length > 0
    ? ['这类情况最近多久发生一次？', '通常在什么场景下更容易出现？', '孩子和家长分别如何描述这件事？']
    : interpretation.coverage.uninterpreted_item_refs.length > 0
      ? ['如果愿意，可以补充未纳入本次解读的观察项。']
      : [];
  return {
    source_response_count: sourceCount,
    interpreted_response_count: interpretedCount,
    coverage_ratio: sourceCount === 0 ? 0 : Number((interpretedCount / sourceCount).toFixed(3)),
    mapped_item_refs: interpretation.coverage.mapped_item_refs,
    evidence_summaries: interpretation.coverage.mapped_item_refs.map((itemRef) => {
      const response = responses.find((candidate) => candidate.item_ref === itemRef);
      const item = itemsByRef.get(itemRef);
      return item && response ? `${item.prompt}（本次回答：${response.response_value}）` : itemRef;
    }),
    uninterpreted_item_refs: interpretation.coverage.uninterpreted_item_refs,
    uncertainty_item_refs: uncertaintyResponses.map((response) => response.item_ref).filter(uniqueValue),
    uncertainty_reasons: uncertaintyResponses.length > 0 ? ['家庭回答包含不确定或暂不回答项目，相关方向需要进一步核实。'] : [],
    support_direction_refs: supportDirectionRefs,
    support_direction_labels: supportDirectionRefs.map(assessmentActionLabel),
    next_questions: nextQuestions,
  };
}

function buildAssessmentAiScorecard(sourceInput: FamilyModelUi02AssessmentResponseSetInput, interpretation: FamilyModelUi02AssessmentInterpretationDraft): FamilyAssessmentAiScorecard {
  const constructRefs = new Set(interpretation.draft.construct_signals.map((signal) => signal.construct_ref));
  const needRefs = new Set(interpretation.draft.need_summary.map((need) => need.need_ref));
  const focusSeed = stableSeed(`${focusRefFromResponses(sourceInput.responses) ?? 'UNKNOWN'}:${sourceInput.assessment_session_id}`, 6);
  const dimensions = [
    assessmentScoreDimension('PARENT_CHILD_COMMUNICATION', '沟通', 76 - focusSeed, 72, constructRefs.has('PARENT_CHILD_COMMUNICATION'), needRefs.has('FAMILY_COMMUNICATION_NEED')),
    assessmentScoreDimension('SELF_REGULATION', '自律', 66 - focusSeed, 70, constructRefs.has('SELF_REGULATION'), needRefs.has('SELF_REGULATION_NEED')),
    assessmentScoreDimension('LEARNING_HABITS', '学习', 72 - focusSeed, 71, constructRefs.has('LEARNING_HABITS'), needRefs.has('LEARNING_HABIT_NEED')),
    assessmentScoreDimension('EMOTION_REGULATION', '情绪', 69 - focusSeed, 70, constructRefs.has('EMOTION_REGULATION'), needRefs.has('EMOTION_SUPPORT_NEED')),
    assessmentScoreDimension('FAMILY_RELATIONSHIP_SUPPORT', '关系', 78 - focusSeed, 73, constructRefs.has('PARENT_CHILD_COMMUNICATION'), interpretation.focus_ref === 'PARENT_CHILD_COMMUNICATION'),
  ];
  const overallScore = Math.round(dimensions.reduce((sum, item) => sum + item.score, 0) / dimensions.length);
  return {
    generated_by: 'FAMILI_PRINCIPAL_FAMILY_EDUCATION_MODEL',
    overall_score: overallScore,
    overall_band: overallScore >= 75 ? '良好' : overallScore >= 65 ? '发展中' : '需要支持',
    dimensions,
    core_issue_tags: interpretation.draft.need_summary.map((need) => assessmentNeedLabel(need.need_ref)).filter(uniqueValue).slice(0, 3),
    recommendations: interpretation.draft.action_candidates.map((candidate) => assessmentActionLabel(candidate.action_ref)).filter(uniqueValue).slice(0, 3),
    score_boundary: 'SUPPORT_ORIENTATION_SCORE_NOT_CHILD_DIAGNOSIS_OR_RANKING',
  };
}

function assessmentScoreDimension(dimensionRef: string, label: string, baseScore: number, peerReference: number, hasConstructSignal: boolean, hasNeedSignal: boolean): FamilyAssessmentAiScoreDimension {
  const score = Math.max(45, Math.min(92, baseScore + (hasConstructSignal ? 4 : 0) - (hasNeedSignal ? 6 : 0)));
  return { dimension_ref: dimensionRef, label, score, peer_reference: peerReference };
}

function assessmentNeedLabel(needRef: string) {
  return ({
    FAMILY_COMMUNICATION_NEED: '亲子沟通需要被看见',
    CHILD_RELATIONSHIP_NEED: '亲子关系需要更稳定的回应',
    CHILD_LEARNING_SUPPORT_NEED: '学习过程需要可执行支持',
    FAMILY_LEARNING_ENVIRONMENT_NEED: '家庭学习环境需要减阻',
    CHILD_EMOTIONAL_SUPPORT_NEED: '情绪支持需要提前安排',
    CHILD_DIGITAL_AI_NEED: '数字与 AI 使用需要边界',
    FAMILY_RHYTHM_NEED: '家庭节律需要一起校准',
    PARENT_METHOD_NEED: '家长方法需要可练习脚手架',
    PARENT_EMOTIONAL_SUPPORT_NEED: '家长状态需要被纳入支持',
    FAMILY_SCHOOL_ALIGNMENT_NEED: '家校反馈需要形成闭环',
  } as Record<string, string>)[needRef] ?? '家庭支持需要进一步观察';
}

function assessmentActionLabel(actionRef: string) {
  return ({
    COMMUNICATION_REPAIR_CONVERSATION: '每天安排一次不评价的短对话，先听孩子描述当天最难的一件事。',
    SEVEN_DAY_HOMEWORK_START_RITUAL: '把一个固定时段变成可坚持的小流程，用完成记录替代反复提醒。',
    SLEEP_AND_ENERGY_RHYTHM_CHECK: '连续七天记录睡眠、精力和学习状态，再一起找最小调整点。',
    FAMILY_DEVICE_AGREEMENT_DRAFT: '把设备使用边界写成家庭约定，并一起复盘执行感受。',
    AI_USE_FAMILY_RULES_MINI_PLAN: '约定 AI 学习工具的提问、核验和引用规则，保留孩子自己的思考过程。',
    MULTIMODAL_LEARNING_ARTIFACT_REVIEW: '让孩子用图、音频、讲解或作品复述一次学习内容，观察优势表达方式。',
    SCHOOL_FAMILY_FEEDBACK_HANDOFF: '把老师反馈转成一条家庭可执行动作，并约定下次复盘时间。',
    HUMAN_SERVICE_CONTEXT_PACKAGE: '整理家庭观察和关键场景，必要时交给专业人工支持继续判断。',
  } as Record<string, string>)[actionRef] ?? '选择一个最小行动试行一周，再用观察记录决定是否调整。';
}

function stableSeed(value: string, modulo: number) {
  return Array.from(value).reduce((sum, char) => sum + char.charCodeAt(0), 0) % modulo;
}

function uniqueValue<T>(value: T, index: number, values: T[]) { return values.indexOf(value) === index; }

const UI02_FOCUS_TO_MODEL_ITEM_REFS: Record<Ui02AssessmentFocusRef, string[]> = {
  LEARNING_HABITS: ['HOMEWORK_START_DELAY', 'CHILD_ERROR_REVIEW_PATTERN'],
  EMOTION_REGULATION: ['SLEEP_ENERGY_LEARNING_IMPACT', 'PARENT_CAPACITY_PRESSURE'],
  PARENT_CHILD_COMMUNICATION: ['PARENT_CHILD_TALK_INTERRUPTION', 'CHILD_WILLINGNESS_TO_TALK'],
  DEVICE_USE_CONTEXT: ['DEVICE_RULE_CONFLICT', 'AI_LEARNING_USE_CLARITY'],
  SELF_REGULATION: ['HOMEWORK_START_DELAY', 'CHILD_ERROR_REVIEW_PATTERN', 'SCHOOL_FAMILY_FEEDBACK_LOOP'],
};

const UI02_DEEP_QUESTION_PREFIX_TO_MODEL_ITEM_REFS: Record<Ui02AssessmentFocusRef, string[]> = {
  LEARNING_HABITS: ['HOMEWORK_START_DELAY', 'CHILD_ERROR_REVIEW_PATTERN', 'SCHOOL_FAMILY_FEEDBACK_LOOP'],
  EMOTION_REGULATION: ['SLEEP_ENERGY_LEARNING_IMPACT', 'PARENT_CAPACITY_PRESSURE', 'PARENT_CHILD_TALK_INTERRUPTION'],
  PARENT_CHILD_COMMUNICATION: ['PARENT_CHILD_TALK_INTERRUPTION', 'CHILD_WILLINGNESS_TO_TALK', 'PARENT_CAPACITY_PRESSURE'],
  DEVICE_USE_CONTEXT: ['DEVICE_RULE_CONFLICT', 'AI_LEARNING_USE_CLARITY', 'SLEEP_ENERGY_LEARNING_IMPACT'],
  SELF_REGULATION: ['HOMEWORK_START_DELAY', 'CHILD_ERROR_REVIEW_PATTERN', 'SCHOOL_FAMILY_FEEDBACK_LOOP'],
};

function assessmentRefForUi02(input: FamilyModelUi02AssessmentResponseSetInput): string {
  return `${input.tool_ref}/v${input.tool_version}/${input.assessment_session_id}`;
}

function ui02ItemRefsForFocus(value: string): string[] {
  return isUi02FocusRef(value) ? UI02_FOCUS_TO_MODEL_ITEM_REFS[value] : [];
}

function ui02ItemRefsForDeepQuestion(itemRef: string): string[] {
  for (const focusRef of Object.keys(UI02_DEEP_QUESTION_PREFIX_TO_MODEL_ITEM_REFS) as Ui02AssessmentFocusRef[]) {
    const match = itemRef.match(new RegExp(`^${focusRef}_Q(\\d{2})$`));
    if (!match) continue;
    const index = Number(match[1]) - 1;
    return UI02_DEEP_QUESTION_PREFIX_TO_MODEL_ITEM_REFS[focusRef][index]
      ? [UI02_DEEP_QUESTION_PREFIX_TO_MODEL_ITEM_REFS[focusRef][index]]
      : [];
  }
  return [];
}

function focusRefFromResponses(responses: FamilyModelUi02AssessmentResponseSignal[]): Ui02AssessmentFocusRef | null {
  const focus = responses.find((response) => response.item_ref === 'FOCUS')?.response_value;
  return typeof focus === 'string' && isUi02FocusRef(focus) ? focus : null;
}

function isUi02FocusRef(value: string): value is Ui02AssessmentFocusRef {
  return Object.prototype.hasOwnProperty.call(UI02_FOCUS_TO_MODEL_ITEM_REFS, value);
}

export class FamilyMemoryDialogueRuntime {
  buildUpdateCandidate(input: FamilyMemoryUpdateCandidateInput): FamilyMemoryUpdateCandidate {
    const basisTurnRefs = uniqueRefs(input.turns.map((turn) => turn.turn_ref));
    const needRefs = uniqueRefs(input.turns.flatMap((turn) => turn.need_refs ?? []));
    const constructRefs = uniqueRefs(input.turns.flatMap((turn) => turn.construct_refs ?? []));
    const actionCandidateRefs = uniqueRefs(input.turns.flatMap((turn) => turn.action_candidate_refs ?? []));
    const outcomeRefs = uniqueRefs(input.turns.flatMap((turn) => turn.outcome_refs ?? []));
    const artifactRefs = uniqueRefs(input.turns.flatMap((turn) => turn.artifact_refs ?? []));
    const riskSignalRefs = uniqueRefs(input.turns.flatMap((turn) => turn.risk_signal_refs ?? []));
    const basisByNeed = groupTurnBasisByRef(input.turns, 'need_refs');
    const basisByConstruct = groupTurnBasisByRef(input.turns, 'construct_refs');
    const blockedReasons = input.consent_ref ? [] : ['consent_required_missing'];

    return assertMemoryUpdateCandidateBoundary({
      candidate_ref: `MUC_${input.request_id}`,
      family_ref: input.family_ref,
      source_session_ref: input.session_ref,
      memory_object_refs: ['FAMILY_MEMORY_PROFILE', 'DIALOGUE_SUMMARY'],
      boundary_labels: [
        'consent_required',
        'perspective_not_fact',
        'hypothesis_not_fact',
        'memory_update_candidate_not_fact',
        'action_not_outcome',
        'human_gate_for_high_risk',
      ],
      need_summary: needRefs.map((need_ref) => ({ need_ref, basis_item_refs: basisByNeed.get(need_ref) ?? [] })),
      construct_mapping: constructRefs.map((construct_ref) => ({
        construct_ref,
        basis_item_refs: basisByConstruct.get(construct_ref) ?? [],
        boundary: 'signal_not_diagnosis',
      })),
      action_candidate_refs: actionCandidateRefs,
      outcome_refs: outcomeRefs,
      artifact_refs: artifactRefs,
      risk_signal_refs: riskSignalRefs,
      basis_turn_refs: basisTurnRefs,
      human_gate: {
        required: riskSignalRefs.length > 0,
        reason_refs: riskSignalRefs,
      },
      blocked_reasons: blockedReasons,
      requires_named_action: 'ConfirmMemoryUpdateCandidate',
      may_mutate_business_state: false,
    });
  }
}

export class FamilyPlatformCapabilityRuntime {
  private readonly componentsByRef: Map<FamilyModelComponentRef, FamilyModelComponentDefinition>;

  constructor(private readonly registry: FamilyModelComponentRegistryAsset) {
    this.componentsByRef = new Map(registry.registered_components.map((component) => [component.component_ref, component]));
  }

  plan(input: FamilyPlatformCapabilityInput): FamilyPlatformCapabilityPlan {
    const orderedComponentRefs = this.resolveComponents(input.requested_component_refs);
    const missingComponentRefs = orderedComponentRefs.filter((componentRef) => !this.componentsByRef.has(componentRef));
    const enabledCapabilities = orderedComponentRefs
      .filter((componentRef) => this.componentsByRef.has(componentRef))
      .map((componentRef) => capabilityForComponent(componentRef));
    const policyRefs = Array.from(
      new Set(orderedComponentRefs.flatMap((componentRef) => this.componentsByRef.get(componentRef)?.policy_refs ?? [])),
    );

    return {
      surface_ref: input.surface_ref,
      ordered_component_refs: orderedComponentRefs,
      enabled_capabilities: enabledCapabilities,
      missing_component_refs: missingComponentRefs,
      human_confirmation_required: true,
      may_mutate_business_state: false,
      boundary_labels: [
        'perspective_not_fact',
        'signal_not_diagnosis',
        'hypothesis_not_fact',
        'recommendation_not_decision',
        'action_requires_named_action',
        'outcome_required_for_completion',
      ],
      policy_refs: policyRefs,
    };
  }

  private resolveComponents(requestedComponentRefs: FamilyModelComponentRef[]): FamilyModelComponentRef[] {
    const orderedComponentRefs: FamilyModelComponentRef[] = [];
    const visited = new Set<FamilyModelComponentRef>();
    const visit = (componentRef: FamilyModelComponentRef) => {
      if (visited.has(componentRef)) return;
      visited.add(componentRef);
      for (const dependencyRef of this.componentsByRef.get(componentRef)?.dependency_refs ?? []) visit(dependencyRef);
      orderedComponentRefs.push(componentRef);
    };
    requestedComponentRefs.forEach(visit);
    return orderedComponentRefs;
  }
}

export class FamilyModelTechnicalArchitectureRuntime {
  private readonly layersByRef: Map<string, FamilyModelArchitectureLayer>;
  private readonly flowsByRef: Map<string, FamilyModelArchitectureFlow>;

  constructor(private readonly architecture: FamilyModelTechnicalArchitectureAsset) {
    this.layersByRef = new Map(architecture.architecture_layers.map((layer) => [layer.layer_ref, layer]));
    this.flowsByRef = new Map(architecture.architecture_flows.map((flow) => [flow.flow_ref, flow]));
  }

  planFlow(input: FamilyModelArchitecturePlanInput): FamilyModelArchitecturePlan {
    const flow = this.flowsByRef.get(input.flow_ref);
    if (!flow) throw new Error(`Unknown Family model architecture flow: ${input.flow_ref}`);
    const orderedLayers = flow.ordered_layer_refs.map((layerRef) => {
      const layer = this.layersByRef.get(layerRef);
      if (!layer) throw new Error(`Family model architecture flow ${flow.flow_ref} references unknown layer: ${layerRef}`);
      return layer;
    });
    const orderedComponentRefs = uniqueRefs(orderedLayers.flatMap((layer) => layer.component_refs));
    const gatewayProfileRefs = this.gatewayProfileRefsForFlow(flow, input.available_env_keys ?? []);
    const blockedReasons = this.blockedReasonsForFlow(
      flow,
      input.business_runtime_authorized === true,
      input.live_external_ai_authorized === true,
      input.available_env_keys ?? [],
    );

    return {
      architecture_id: this.architecture.architecture_id,
      flow_ref: flow.flow_ref,
      flow_kind: flow.flow_kind,
      ordered_layer_refs: flow.ordered_layer_refs,
      ordered_component_refs: orderedComponentRefs,
      input_refs: flow.input_refs,
      output_refs: flow.output_refs,
      required_boundary_labels: flow.required_boundary_labels,
      gateway_profile_refs: gatewayProfileRefs,
      blocked_reasons: blockedReasons,
      may_call_live_external_ai: flow.authorization_required_for_live_ai && blockedReasons.length === 0,
      may_mutate_business_state: false,
    };
  }

  private gatewayProfileRefsForFlow(flow: FamilyModelArchitectureFlow, availableEnvKeys: string[]): string[] {
    if (!flow.authorization_required_for_live_ai) return [];
    const available = new Set(availableEnvKeys);
    return this.architecture.model_gateway_profiles
      .filter((profile) => profile.live_external_ai_required)
      .filter((profile) => (profile.required_env ?? []).every((entry) => available.has(entry.split('=')[0])))
      .map((profile) => profile.profile_ref);
  }

  private blockedReasonsForFlow(flow: FamilyModelArchitectureFlow, businessRuntimeAuthorized: boolean, liveExternalAiAuthorized: boolean, availableEnvKeys: string[]): string[] {
    const reasons: string[] = [];
    if (flow.may_mutate_business_state !== false) reasons.push('flow_may_mutate_business_state');
    if (this.architecture.runtime_boundary.business_runtime === 'AUTHORIZED' && !businessRuntimeAuthorized) reasons.push('business_runtime_authorization_not_confirmed');
    if (this.architecture.runtime_boundary.business_runtime === 'NOT_AUTHORIZED' && businessRuntimeAuthorized) reasons.push('business_runtime_not_authorized_by_architecture');
    if (!flow.authorization_required_for_live_ai) return reasons;
    if (!liveExternalAiAuthorized || this.architecture.runtime_boundary.live_external_ai !== 'AUTHORIZED') reasons.push('live_external_ai_not_authorized');
    const available = new Set(availableEnvKeys);
    const liveProfiles = this.architecture.model_gateway_profiles.filter((profile) => profile.live_external_ai_required);
    if (!liveProfiles.some((profile) => (profile.required_env ?? []).every((entry) => available.has(entry.split('=')[0])))) {
      reasons.push('live_gateway_env_missing');
    }
    return reasons;
  }
}

export class FamilyModelRuntimeIntegrationRuntime {
  private readonly flowContractsByRef: Map<string, FamilyModelRuntimeIntegrationFlowContract>;
  private readonly architectureRuntime: FamilyModelTechnicalArchitectureRuntime;

  constructor(
    private readonly contract: FamilyModelRuntimeIntegrationContractAsset,
    architecture: FamilyModelTechnicalArchitectureAsset,
  ) {
    this.flowContractsByRef = new Map(contract.governed_flow_contracts.map((flowContract) => [flowContract.flow_ref, flowContract]));
    this.architectureRuntime = new FamilyModelTechnicalArchitectureRuntime(architecture);
  }

  planRequest(input: FamilyModelRuntimeIntegrationRequest): FamilyModelRuntimeIntegrationPlan {
    const flowContract = this.flowContractsByRef.get(input.flow_ref);
    if (!flowContract) throw new Error(`Unknown Family model runtime integration flow: ${input.flow_ref}`);

    const architecturePlan = this.architectureRuntime.planFlow({
      flow_ref: input.flow_ref,
      business_runtime_authorized: input.business_runtime_authorized,
      live_external_ai_authorized: input.live_external_ai_authorized,
      available_env_keys: input.available_env_keys,
    });
    const blockedReasons = [
      ...architecturePlan.blocked_reasons,
      ...this.contractBlockedReasons(flowContract, input),
    ];

    return {
      request_id: input.request_id,
      surface_ref: input.surface_ref,
      flow_ref: input.flow_ref,
      purpose_ref: input.purpose_ref,
      draft_kind: flowContract.draft_kind,
      architecture_plan: architecturePlan,
      blocked_reasons: uniqueRefs(blockedReasons),
      boundary_labels: flowContract.required_boundary_labels,
      candidate_event_names: flowContract.candidate_events_after_authorization,
      requires_human_confirmation: true,
      allowed_next_named_actions: [],
      may_execute: blockedReasons.length === 0,
      may_call_live_external_ai: architecturePlan.may_call_live_external_ai && flowContract.may_call_live_external_ai_after_authorization,
      may_mutate_business_state: false,
    };
  }

  private contractBlockedReasons(flowContract: FamilyModelRuntimeIntegrationFlowContract, input: FamilyModelRuntimeIntegrationRequest): string[] {
    const reasons: string[] = [];
    if (this.contract.current_authorization_boundary.business_runtime === 'AUTHORIZED' && !input.business_runtime_authorized) reasons.push('business_runtime_authorization_not_confirmed');
    if (this.contract.current_authorization_boundary.business_runtime === 'NOT_AUTHORIZED' && input.business_runtime_authorized) reasons.push('business_runtime_not_authorized_by_contract');
    if (flowContract.may_mutate_business_state !== false) reasons.push('contract_may_mutate_business_state');
    if (!flowContract.surface_refs.includes(input.surface_ref)) reasons.push('surface_not_allowed_for_flow');
    if (!flowContract.purpose_refs.includes(input.purpose_ref)) reasons.push('purpose_not_allowed_for_flow');
    if (flowContract.requires_consent && !input.consent_ref) reasons.push('consent_required_missing');
    if (input.execution_context === 'worker' && !flowContract.worker_allowed) reasons.push('worker_execution_not_allowed_for_flow');
    return reasons;
  }
}

export function assertInterpretationBoundary(output: FamilyModelInterpretationDraft): FamilyModelInterpretationDraft {
  assertNoForbiddenOutputFields(output);
  if (!output.boundary_labels.includes('hypothesis_not_fact')) throw new Error('Missing hypothesis_not_fact boundary');
  if (!output.boundary_labels.includes('recommendation_not_decision')) throw new Error('Missing recommendation_not_decision boundary');
  for (const signal of output.construct_signals) {
    if (signal.boundary !== 'signal_not_diagnosis') throw new Error(`Invalid construct signal boundary: ${signal.construct_ref}`);
  }
  for (const hypothesis of output.hypotheses) {
    if (hypothesis.boundary !== 'hypothesis_not_fact') throw new Error(`Invalid hypothesis boundary: ${hypothesis.hypothesis_ref}`);
  }
  for (const actionCandidate of output.action_candidates) {
    if (actionCandidate.boundary !== 'recommendation_not_decision') throw new Error(`Invalid action candidate boundary: ${actionCandidate.action_ref}`);
  }
  return output;
}

export function assertMemoryUpdateCandidateBoundary(output: FamilyMemoryUpdateCandidate): FamilyMemoryUpdateCandidate {
  assertNoForbiddenOutputFields(output);
  if (output.may_mutate_business_state !== false) throw new Error('Memory update candidate must not mutate business state');
  if (output.requires_named_action !== 'ConfirmMemoryUpdateCandidate') throw new Error('Memory update candidate requires named action confirmation');
  if (!output.boundary_labels.includes('consent_required')) throw new Error('Missing consent_required boundary');
  if (!output.boundary_labels.includes('memory_update_candidate_not_fact')) throw new Error('Missing memory_update_candidate_not_fact boundary');
  for (const signal of output.construct_mapping) {
    if (signal.boundary !== 'signal_not_diagnosis') throw new Error(`Invalid memory construct boundary: ${signal.construct_ref}`);
  }
  return output;
}

function assertNoForbiddenOutputFields(value: unknown, path = '$'): void {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoForbiddenOutputFields(item, `${path}[${index}]`));
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (key !== 'prohibited_outputs' && /(?:total_?score|ranking|diagnosis)/i.test(key)) {
      throw new Error(`Family model output contains forbidden output field: ${path}.${key}`);
    }
    if (key !== 'prohibited_outputs') assertNoForbiddenOutputFields(child, `${path}.${key}`);
  }
}

function capabilityForComponent(componentRef: FamilyModelComponentRef): string {
  const capabilityByComponent: Record<FamilyModelComponentRef, string> = {
    FAMILY_DOMAIN_KERNEL: 'domain_construct_mapping',
    FAMILY_ASSESSMENT_V0_COMPONENT: 'assessment_interpretation',
    FAMILY_MEMORY_DIALOGUE_COMPONENT: 'consent_aware_memory',
    FAMILY_REALTIME_DIALOGUE_COMPONENT: 'realtime_family_dialogue',
    FAMILY_MULTIMODAL_ARTIFACT_COMPONENT: 'multimodal_artifact_signal_extraction',
    FAMILY_ACTION_OUTCOME_COMPONENT: 'action_outcome_tracking',
    FAMILY_KNOWLEDGE_EVIDENCE_COMPONENT: 'evidence_grounded_context',
    FAMILY_HUMAN_SERVICE_HANDOFF_COMPONENT: 'human_service_handoff',
  };
  return capabilityByComponent[componentRef];
}

function collectRefs(items: FamilyAssessmentItem[], field: 'need_refs' | 'construct_refs'): string[] {
  return Array.from(new Set(items.flatMap((item) => item[field])));
}

function groupBasisByRef(items: FamilyAssessmentItem[], field: 'need_refs' | 'construct_refs'): Map<string, string[]> {
  const basis = new Map<string, string[]>();
  for (const item of items) {
    for (const ref of item[field]) {
      if (!basis.has(ref)) basis.set(ref, []);
      basis.get(ref)?.push(item.item_ref);
    }
  }
  return basis;
}

function groupTurnBasisByRef(items: FamilyDialogueTurnSignal[], field: 'need_refs' | 'construct_refs'): Map<string, string[]> {
  const basis = new Map<string, string[]>();
  for (const item of items) {
    for (const ref of item[field] ?? []) {
      if (!basis.has(ref)) basis.set(ref, []);
      basis.get(ref)?.push(item.turn_ref);
    }
  }
  return basis;
}

function uniqueRefs<T extends string>(refs: T[]): T[] {
  return Array.from(new Set(refs));
}

function isEvidenceBearingAnswer(answerRef: string): boolean {
  const normalized = String(answerRef).trim().toUpperCase();
  return ['OFTEN', 'SOMETIMES', 'YES', 'TRUE', 'HIGH', 'SEVERE', 'CRISIS'].includes(normalized);
}