import { describe, expect, it } from 'vitest';
import { FakeAiGateway } from '@family/ai-gateway';
import {
  FAMILY_EDUCATION_ASSESSMENT_ITEM_BANK,
  FamilyEducationModelRuntime,
  FamilyMemoryDialogueRuntime,
  FamilyModelRuntimeIntegrationRuntime,
  FamilyModelTechnicalArchitectureRuntime,
  FamilyPlatformCapabilityRuntime,
  assertInterpretationBoundary,
  assertMemoryUpdateCandidateBoundary,
  createFamilyEducationAssessmentModelRuntime,
  type FamilyAssessmentItemBankAsset,
  type FamilyInterpretationSchemaAsset,
  type FamilyModelComponentRegistryAsset,
  type FamilyModelRuntimeIntegrationContractAsset,
  type FamilyModelTechnicalArchitectureAsset,
} from './index';

const itemBank: FamilyAssessmentItemBankAsset = {
  asset_ref: 'FAMILY_ASSESSMENT_ITEM_BANK_REGISTRY',
  items: [
    {
      item_ref: 'PARENT_CHILD_TALK_INTERRUPTION',
      prompt: '最近一周亲子沟通是否经常被打断?',
      construct_refs: ['PARENT_CHILD_COMMUNICATION'],
      need_refs: ['CHILD_NEED_EMOTIONAL_SAFETY', 'PARENT_NEED_COMMUNICATION_SUPPORT'],
    },
    {
      item_ref: 'HOMEWORK_START_DELAY',
      prompt: '作业开始是否明显拖延?',
      construct_refs: ['HOMEWORK_PROCESS'],
      need_refs: ['CHILD_NEED_LEARNING_PROCESS_SUPPORT'],
      safety_boundary: 'human_gate_when_high_stress',
    },
  ],
  recommended_action_map: [
    { construct_ref: 'PARENT_CHILD_COMMUNICATION', candidate_action_refs: ['COMMUNICATION_REPAIR_CONVERSATION'] },
    { construct_ref: 'HOMEWORK_PROCESS', candidate_action_refs: ['SEVEN_DAY_HOMEWORK_START_RITUAL'] },
  ],
};

const interpretationSchema: FamilyInterpretationSchemaAsset = {
  asset_ref: 'FAMILY_INTERPRETATION_SCHEMA',
  interpretation_templates: [
    {
      template_ref: 'COMMUNICATION_TEMPLATE',
      construct_refs: ['PARENT_CHILD_COMMUNICATION'],
      action_refs: ['COMMUNICATION_REPAIR_CONVERSATION'],
      outcome_refs: ['FAMILY_CONFLICT_CHANGE_SIGNAL'],
      explanation_style: 'separate_signal_hypothesis_action',
    },
  ],
};

const componentRegistry: FamilyModelComponentRegistryAsset = {
  asset_ref: 'FAMILY_MODEL_COMPONENT_REGISTRY',
  registered_components: [
    {
      component_ref: 'FAMILY_DOMAIN_KERNEL',
      component_kind: 'DOMAIN_COMPONENT',
      version: '0.1.0',
      dependency_refs: [],
      policy_refs: ['Perspective != Fact', 'Hypothesis != Fact'],
    },
    {
      component_ref: 'FAMILY_ASSESSMENT_V0_COMPONENT',
      component_kind: 'ASSESSMENT_COMPONENT',
      version: '0.1.0',
      dependency_refs: ['FAMILY_DOMAIN_KERNEL'],
      policy_refs: ['no_family_total_score', 'no_family_ranking', 'human_gate_for_high_risk'],
    },
    {
      component_ref: 'FAMILY_MEMORY_DIALOGUE_COMPONENT',
      component_kind: 'MEMORY_COMPONENT',
      version: '0.1.0',
      dependency_refs: ['FAMILY_DOMAIN_KERNEL'],
      policy_refs: ['structured_memory_update_only', 'consent_aware_recall'],
    },
    {
      component_ref: 'FAMILY_REALTIME_DIALOGUE_COMPONENT',
      component_kind: 'DIALOGUE_COMPONENT',
      version: '0.1.0',
      dependency_refs: ['FAMILY_DOMAIN_KERNEL', 'FAMILY_MEMORY_DIALOGUE_COMPONENT'],
      policy_refs: ['role_aware_response', 'no_direct_core_state_write'],
    },
  ],
};

const input = {
  request_id: 'REQ-1',
  assessment_ref: 'FAMILY_SUPPORT_NEEDS/v2',
  child_age_stage: '10岁（小学四年级）',
  responses: [
    { item_ref: 'PARENT_CHILD_TALK_INTERRUPTION', answer_ref: 'often' },
    { item_ref: 'HOMEWORK_START_DELAY', answer_ref: 'often' },
  ],
};

const technicalArchitecture: FamilyModelTechnicalArchitectureAsset = {
  asset_ref: 'FAMILY_MODEL_TECHNICAL_ARCHITECTURE_REGISTRY',
  architecture_id: 'FAMILY_EDUCATION_LARGE_MODEL_TECH_ARCH_V0_1',
  runtime_boundary: {
    current_gate: 'G1-A ARCHITECTURE_AND_CONTRACT_CONVERGENCE',
    business_runtime: 'NOT_AUTHORIZED',
    database_schema_change: 'NOT_AUTHORIZED',
    live_external_ai: 'NOT_AUTHORIZED',
    allowed_now: ['pure_runtime_packages', 'mock_gateway_execution'],
    forbidden_now: ['live_external_ai_call_without_authorization'],
  },
  architecture_layers: [
    {
      layer_ref: 'EXPERIENCE_SURFACE_LAYER',
      layer_kind: 'product_surface',
      owned_by: 'Family Growth Platform UI',
      component_refs: [],
      primary_contract_refs: ['family_ui_model_binding.registry.yaml'],
      may_mutate_business_state: false,
    },
    {
      layer_ref: 'FAMILY_DOMAIN_KERNEL_LAYER',
      layer_kind: 'domain_kernel',
      owned_by: 'Family Education Industry Model',
      component_refs: ['FAMILY_DOMAIN_KERNEL'],
      primary_contract_refs: ['family_education_construct.registry.yaml'],
      may_mutate_business_state: false,
    },
    {
      layer_ref: 'SKILL_COMPONENT_RUNTIME_LAYER',
      layer_kind: 'skill_runtime',
      owned_by: 'Family Model Runtime',
      component_refs: ['FAMILY_ASSESSMENT_V0_COMPONENT'],
      primary_contract_refs: ['family_model_component.registry.yaml'],
      may_mutate_business_state: false,
    },
    {
      layer_ref: 'MODEL_GATEWAY_LAYER',
      layer_kind: 'provider_gateway',
      owned_by: 'AI Gateway',
      component_refs: [],
      primary_contract_refs: ['family_interpretation.schema.yaml'],
      may_mutate_business_state: false,
    },
    {
      layer_ref: 'MEMORY_CONTEXT_LAYER',
      layer_kind: 'memory_context',
      owned_by: 'Family Context Platform',
      component_refs: ['FAMILY_MEMORY_DIALOGUE_COMPONENT'],
      primary_contract_refs: ['family_memory_conversation.schema.yaml'],
      may_mutate_business_state: false,
    },
  ],
  model_gateway_profiles: [
    {
      profile_ref: 'FAMILY_MODEL_CC_SWITCH_GATEWAY',
      provider_kind: 'openai_compatible',
      provider_id: 'anthropic-cc-switch',
      live_external_ai_required: true,
      required_env: [
        'FAMILY_MODEL_GATEWAY_MODE=cc-switch',
        'FAMILY_MODEL_ALLOW_LIVE_EXTERNAL_AI=true',
        'FAMILY_MODEL_CC_SWITCH_BASE_URL',
        'FAMILY_MODEL_CC_SWITCH_API_KEY',
        'FAMILY_MODEL_CC_SWITCH_MODEL',
      ],
    },
  ],
  architecture_flows: [
    {
      flow_ref: 'UI02_ASSESSMENT_TO_STRUCTURED_DRAFT',
      flow_kind: 'assessment_interpretation',
      trigger_surface_refs: ['UI-02'],
      ordered_layer_refs: ['EXPERIENCE_SURFACE_LAYER', 'FAMILY_DOMAIN_KERNEL_LAYER', 'SKILL_COMPONENT_RUNTIME_LAYER', 'MODEL_GATEWAY_LAYER'],
      input_refs: ['family_assessment_item_bank.registry.yaml'],
      output_refs: ['family_interpretation.schema.yaml'],
      required_boundary_labels: ['hypothesis_not_fact', 'recommendation_not_decision'],
      may_mutate_business_state: false,
      authorization_required_for_live_ai: true,
    },
    {
      flow_ref: 'CONSENT_MEMORY_RECALL_AND_UPDATE_CANDIDATE',
      flow_kind: 'memory_context',
      trigger_surface_refs: ['UI-03'],
      ordered_layer_refs: ['EXPERIENCE_SURFACE_LAYER', 'MEMORY_CONTEXT_LAYER', 'FAMILY_DOMAIN_KERNEL_LAYER', 'SKILL_COMPONENT_RUNTIME_LAYER'],
      input_refs: ['family_memory_conversation.schema.yaml'],
      output_refs: ['memory_update_candidate'],
      required_boundary_labels: ['perspective_not_fact', 'action_requires_named_action'],
      may_mutate_business_state: false,
      authorization_required_for_live_ai: false,
    },
  ],
};

const runtimeIntegrationContract: FamilyModelRuntimeIntegrationContractAsset = {
  asset_ref: 'FAMILY_MODEL_RUNTIME_INTEGRATION_CONTRACT',
  current_authorization_boundary: {
    business_runtime: 'NOT_AUTHORIZED',
    database_schema_change: 'NOT_AUTHORIZED',
    live_external_ai: 'NOT_AUTHORIZED',
  },
  canonical_runtime: {
    package: '@family/family-model',
    planner: 'FamilyModelTechnicalArchitectureRuntime',
    gateway_package: '@family/ai-gateway',
    architecture_asset_ref: 'FAMILY_MODEL_TECHNICAL_ARCHITECTURE_REGISTRY',
    human_readable_contract: 'contracts/model/FAMILY_MODEL_RUNTIME_INTEGRATION_CONTRACT_V0_1.md',
  },
  governed_flow_contracts: [
    {
      flow_ref: 'UI02_ASSESSMENT_TO_STRUCTURED_DRAFT',
      surface_refs: ['UI-02', 'UI-03'],
      purpose_refs: ['assessment_interpretation'],
      draft_kind: 'assessment_interpretation',
      requires_consent: true,
      may_call_live_external_ai_after_authorization: true,
      may_mutate_business_state: false,
      required_boundary_labels: ['perspective_not_fact', 'hypothesis_not_fact', 'recommendation_not_decision'],
      worker_allowed: false,
      candidate_events_after_authorization: ['FamilyModelDraftGenerated', 'FamilyModelHumanReviewRequested'],
    },
    {
      flow_ref: 'CONSENT_MEMORY_RECALL_AND_UPDATE_CANDIDATE',
      surface_refs: ['UI-11', 'UI-12'],
      purpose_refs: ['memory_recall', 'memory_update_candidate'],
      draft_kind: 'memory_update_candidate',
      requires_consent: true,
      may_call_live_external_ai_after_authorization: false,
      may_mutate_business_state: false,
      required_boundary_labels: ['consent_required', 'memory_update_candidate_not_fact'],
      worker_allowed: true,
      candidate_events_after_authorization: ['FamilyModelMemoryUpdateCandidateGenerated', 'FamilyModelHumanReviewRequested'],
    },
  ],
  forbidden_integration_paths: ['client_direct_provider_call', 'model_free_text_to_core_ontology_write'],
};

describe('FamilyEducationModelRuntime', () => {
  it('turns assessment signals into bounded needs, hypotheses, and action candidates', () => {
    const runtime = new FamilyEducationModelRuntime({ itemBank, interpretationSchema });
    const draft = runtime.interpretDeterministically(input);

    expect(draft.need_summary.map((need) => need.need_ref)).toEqual([
      'CHILD_NEED_EMOTIONAL_SAFETY',
      'PARENT_NEED_COMMUNICATION_SUPPORT',
      'CHILD_NEED_LEARNING_PROCESS_SUPPORT',
    ]);
    expect(draft.construct_signals.map((signal) => signal.construct_ref)).toEqual(['PARENT_CHILD_COMMUNICATION', 'HOMEWORK_PROCESS']);
    expect(draft.action_candidates.map((action) => action.action_ref)).toEqual([
      'COMMUNICATION_REPAIR_CONVERSATION',
      'SEVEN_DAY_HOMEWORK_START_RITUAL',
    ]);
    expect(draft.human_gate).toEqual({ required: true, reason_refs: ['HOMEWORK_START_DELAY'] });
  });

  it('keeps Family hard boundaries in generated deterministic draft', () => {
    const runtime = new FamilyEducationModelRuntime({ itemBank, interpretationSchema });
    const draft = runtime.interpretDeterministically(input);

    expect(draft.boundary_labels).toContain('perspective_not_fact');
    expect(draft.boundary_labels).toContain('hypothesis_not_fact');
    expect(draft.boundary_labels).toContain('recommendation_not_decision');
    expect(draft.prohibited_outputs).toContain('family_total_score');
    expect(JSON.stringify(draft)).not.toContain('familyTotalScore');
  });

  it('falls back to deterministic draft when no gateway is injected', async () => {
    const runtime = new FamilyEducationModelRuntime({ itemBank, interpretationSchema });
    await expect(runtime.generateGatewayDraft(input)).resolves.toMatchObject({ assessment_ref: 'FAMILY_SUPPORT_NEEDS/v2' });
  });

  it('can call an injected gateway without changing business runtime wiring', async () => {
    const gatewayDraft = new FamilyEducationModelRuntime({ itemBank, interpretationSchema }).interpretDeterministically(input);
    const runtime = new FamilyEducationModelRuntime({
      itemBank,
      interpretationSchema,
      gateway: new FakeAiGateway({ FAMILY_EDUCATION_ASSESSMENT_INTERPRETATION: gatewayDraft }),
    });

    await expect(runtime.generateGatewayDraft(input)).resolves.toEqual(gatewayDraft);
  });

  it('adapts UI-02 assessment response sets into Family Education Model drafts', () => {
    const runtime = new FamilyEducationModelRuntime({ itemBank, interpretationSchema });
    const draft = runtime.interpretUi02AssessmentResponses({
      request_id: 'REQ-UI02',
      assessment_session_id: 'SESSION-1',
      tool_ref: 'FAMILY_SUPPORT_NEEDS',
      tool_version: 2,
      child_age_stage: '10岁（小学四年级）',
      responses: [
        { item_ref: 'FOCUS', response_type: 'SINGLE_CHOICE', response_value: 'PARENT_CHILD_COMMUNICATION' },
        { item_ref: 'PARENT_CHILD_COMMUNICATION_Q01', response_type: 'SINGLE_CHOICE', response_value: 'OFTEN' },
        { item_ref: 'FAMILY_STRUCTURE', response_type: 'SINGLE_CHOICE', response_value: 'TWO_PARENT' },
      ],
    });

    expect(draft).toMatchObject({
      backend_capability_ref: 'FAMILY_ASSESSMENT_AI_CAPABILITY',
      ai_use_case: 'ASSESSMENT_INTERPRETATION',
      generator: 'FAMILY_EDUCATION_MODEL_RUNTIME_DETERMINISTIC',
      assessment_ref: 'FAMILY_SUPPORT_NEEDS/v2/SESSION-1',
      focus_ref: 'PARENT_CHILD_COMMUNICATION',
    });
    expect(draft.model_input.responses.map((response) => response.item_ref)).toEqual(['PARENT_CHILD_TALK_INTERRUPTION']);
    expect(draft.draft.construct_signals.map((signal) => signal.construct_ref)).toEqual(['PARENT_CHILD_COMMUNICATION']);
    expect(draft.draft.action_candidates.map((action) => action.action_ref)).toEqual(['COMMUNICATION_REPAIR_CONVERSATION']);
    expect(draft.coverage).toMatchObject({
      source_response_count: 3,
      interpreted_response_count: 1,
      mapped_item_refs: ['PARENT_CHILD_TALK_INTERRUPTION'],
      uninterpreted_item_refs: ['FAMILY_STRUCTURE'],
    });
  });

  it('constructs the backend Family Education assessment model from packaged assets', () => {
    const runtime = createFamilyEducationAssessmentModelRuntime();
    const cases = [
      {
        focus_ref: 'LEARNING_HABITS',
        question_ref: 'LEARNING_HABITS_Q01',
        construct_refs: ['HOMEWORK_PROCESS'],
        action_refs: ['SEVEN_DAY_HOMEWORK_START_RITUAL'],
      },
      {
        focus_ref: 'EMOTION_REGULATION',
        question_ref: 'EMOTION_REGULATION_Q01',
        construct_refs: ['PHYSICAL_HEALTH_RHYTHM', 'PSYCHOSOMATIC_STRESS_SIGNAL'],
        action_refs: ['SLEEP_AND_ENERGY_RHYTHM_CHECK', 'HUMAN_SERVICE_CONTEXT_PACKAGE'],
      },
      {
        focus_ref: 'PARENT_CHILD_COMMUNICATION',
        question_ref: 'PARENT_CHILD_COMMUNICATION_Q01',
        construct_refs: ['PARENT_CHILD_COMMUNICATION'],
        action_refs: ['COMMUNICATION_REPAIR_CONVERSATION'],
      },
      {
        focus_ref: 'DEVICE_USE_CONTEXT',
        question_ref: 'DEVICE_USE_CONTEXT_Q02',
        construct_refs: ['DEVICE_USE_CONTEXT', 'AI_LITERACY_FLUENCY'],
        action_refs: ['FAMILY_DEVICE_AGREEMENT_DRAFT', 'AI_USE_FAMILY_RULES_MINI_PLAN'],
      },
      {
        focus_ref: 'SELF_REGULATION',
        question_ref: 'SELF_REGULATION_Q01',
        construct_refs: ['HOMEWORK_PROCESS', 'FAMILY_ROUTINE'],
        action_refs: ['SEVEN_DAY_HOMEWORK_START_RITUAL'],
      },
    ] as const;

    expect(FAMILY_EDUCATION_ASSESSMENT_ITEM_BANK.items.map((item) => item.item_ref)).toEqual(expect.arrayContaining([
      'PARENT_CHILD_TALK_INTERRUPTION',
      'HOMEWORK_START_DELAY',
      'DEVICE_RULE_CONFLICT',
      'AI_LEARNING_USE_CLARITY',
      'PARENT_CAPACITY_PRESSURE',
    ]));
    for (const modelCase of cases) {
      const draft = runtime.interpretUi02AssessmentResponses({
        request_id: `REQ-BACKEND-MODEL-${modelCase.focus_ref}`,
        assessment_session_id: `SESSION-${modelCase.focus_ref}`,
        tool_ref: 'FAMILY_SUPPORT_NEEDS',
        tool_version: 2,
        responses: [
          { item_ref: 'FOCUS', response_type: 'SINGLE_CHOICE', response_value: modelCase.focus_ref },
          { item_ref: modelCase.question_ref, response_type: 'SINGLE_CHOICE', response_value: 'SOMETIMES' },
        ],
      });

      expect(draft.focus_ref).toBe(modelCase.focus_ref);
      expect(draft.draft.construct_signals.map((signal) => signal.construct_ref)).toEqual(expect.arrayContaining([...modelCase.construct_refs]));
      expect(draft.draft.action_candidates.map((action) => action.action_ref)).toEqual(expect.arrayContaining([...modelCase.action_refs]));
      expect(draft.draft.boundary_labels).toEqual(expect.arrayContaining(['perspective_not_fact', 'hypothesis_not_fact', 'recommendation_not_decision']));
    }
  });

  it('rejects model outputs that omit required boundary labels', () => {
    const draft = new FamilyEducationModelRuntime({ itemBank, interpretationSchema }).interpretDeterministically(input);
    expect(() => assertInterpretationBoundary({ ...draft, boundary_labels: ['perspective_not_fact'] })).toThrow(/hypothesis_not_fact/);
  });

  it('rejects model outputs with forbidden scoring fields', () => {
    const draft = new FamilyEducationModelRuntime({ itemBank, interpretationSchema }).interpretDeterministically(input);
    const outputWithScore = { ...draft, family_total_score: 87 } as unknown as typeof draft;

    expect(() => assertInterpretationBoundary(outputWithScore)).toThrow(/forbidden output field/);
  });

  it('rejects hypotheses without hypothesis boundary labels', () => {
    const draft = new FamilyEducationModelRuntime({ itemBank, interpretationSchema }).interpretDeterministically(input);
    const outputWithWrongHypothesisBoundary = {
      ...draft,
      hypotheses: [{ ...draft.hypotheses[0], boundary: 'perspective_not_fact' }],
    } as unknown as typeof draft;

    expect(() => assertInterpretationBoundary(outputWithWrongHypothesisBoundary)).toThrow(/hypothesis boundary/);
  });

  it('rejects action candidates without recommendation boundary labels', () => {
    const draft = new FamilyEducationModelRuntime({ itemBank, interpretationSchema }).interpretDeterministically(input);
    const outputWithWrongActionBoundary = {
      ...draft,
      action_candidates: [{ ...draft.action_candidates[0], boundary: 'action_requires_named_action' }],
    } as unknown as typeof draft;

    expect(() => assertInterpretationBoundary(outputWithWrongActionBoundary)).toThrow(/action candidate boundary/);
  });

  it('plans platform capabilities from component dependencies', () => {
    const runtime = new FamilyPlatformCapabilityRuntime(componentRegistry);
    const plan = runtime.plan({
      surface_ref: 'UI-02/FAMILY_ASSESSMENT',
      requested_component_refs: ['FAMILY_ASSESSMENT_V0_COMPONENT', 'FAMILY_REALTIME_DIALOGUE_COMPONENT'],
      memory_context_ref: 'MEMORY/FAMILY-1',
    });

    expect(plan.ordered_component_refs).toEqual([
      'FAMILY_DOMAIN_KERNEL',
      'FAMILY_ASSESSMENT_V0_COMPONENT',
      'FAMILY_MEMORY_DIALOGUE_COMPONENT',
      'FAMILY_REALTIME_DIALOGUE_COMPONENT',
    ]);
    expect(plan.enabled_capabilities).toEqual([
      'domain_construct_mapping',
      'assessment_interpretation',
      'consent_aware_memory',
      'realtime_family_dialogue',
    ]);
    expect(plan.may_mutate_business_state).toBe(false);
    expect(plan.human_confirmation_required).toBe(true);
    expect(plan.policy_refs).toContain('no_direct_core_state_write');
  });

  it('plans architecture flow layers and blocks live model calls under current gate', () => {
    const runtime = new FamilyModelTechnicalArchitectureRuntime(technicalArchitecture);
    const plan = runtime.planFlow({
      flow_ref: 'UI02_ASSESSMENT_TO_STRUCTURED_DRAFT',
      live_external_ai_authorized: false,
      available_env_keys: [],
    });

    expect(plan.ordered_layer_refs).toEqual([
      'EXPERIENCE_SURFACE_LAYER',
      'FAMILY_DOMAIN_KERNEL_LAYER',
      'SKILL_COMPONENT_RUNTIME_LAYER',
      'MODEL_GATEWAY_LAYER',
    ]);
    expect(plan.ordered_component_refs).toEqual(['FAMILY_DOMAIN_KERNEL', 'FAMILY_ASSESSMENT_V0_COMPONENT']);
    expect(plan.blocked_reasons).toEqual(['live_external_ai_not_authorized', 'live_gateway_env_missing']);
    expect(plan.may_call_live_external_ai).toBe(false);
    expect(plan.may_mutate_business_state).toBe(false);
  });

  it('plans memory flow without requiring live external AI', () => {
    const runtime = new FamilyModelTechnicalArchitectureRuntime(technicalArchitecture);
    const plan = runtime.planFlow({ flow_ref: 'CONSENT_MEMORY_RECALL_AND_UPDATE_CANDIDATE' });

    expect(plan.ordered_component_refs).toEqual(['FAMILY_MEMORY_DIALOGUE_COMPONENT', 'FAMILY_DOMAIN_KERNEL', 'FAMILY_ASSESSMENT_V0_COMPONENT']);
    expect(plan.gateway_profile_refs).toEqual([]);
    expect(plan.blocked_reasons).toEqual([]);
    expect(plan.may_call_live_external_ai).toBe(false);
  });

  it('rejects architecture flows that reference unknown layers', () => {
    const runtime = new FamilyModelTechnicalArchitectureRuntime({
      ...technicalArchitecture,
      architecture_flows: [
        {
          ...technicalArchitecture.architecture_flows[0],
          ordered_layer_refs: ['UNKNOWN_LAYER'],
        },
      ],
    });

    expect(() => runtime.planFlow({ flow_ref: 'UI02_ASSESSMENT_TO_STRUCTURED_DRAFT' })).toThrow(/unknown layer/);
  });

  it('plans runtime integration requests with architecture and contract blockers', () => {
    const runtime = new FamilyModelRuntimeIntegrationRuntime(runtimeIntegrationContract, technicalArchitecture);
    const plan = runtime.planRequest({
      request_id: 'REQ-RUNTIME-1',
      surface_ref: 'UI-02',
      flow_ref: 'UI02_ASSESSMENT_TO_STRUCTURED_DRAFT',
      actor_ref: 'PARENT/P-1',
      purpose_ref: 'assessment_interpretation',
      payload: { assessment_ref: 'FAMILY_SUPPORT_NEEDS/v2' },
      execution_context: 'api',
    });

    expect(plan.draft_kind).toBe('assessment_interpretation');
    expect(plan.architecture_plan.ordered_component_refs).toEqual(['FAMILY_DOMAIN_KERNEL', 'FAMILY_ASSESSMENT_V0_COMPONENT']);
    expect(plan.blocked_reasons).toEqual(['live_external_ai_not_authorized', 'live_gateway_env_missing', 'consent_required_missing']);
    expect(plan.may_execute).toBe(false);
    expect(plan.may_mutate_business_state).toBe(false);
    expect(plan.requires_human_confirmation).toBe(true);
  });

  it('allows explicitly authorized business runtime and live Family Model gateway plans', () => {
    const authorizedArchitecture: FamilyModelTechnicalArchitectureAsset = {
      ...technicalArchitecture,
      runtime_boundary: {
        ...technicalArchitecture.runtime_boundary,
        business_runtime: 'AUTHORIZED',
        live_external_ai: 'AUTHORIZED',
        allowed_now: ['api_runtime_integration', 'live_gateway_execution_after_explicit_authorization'],
        forbidden_now: ['direct_provider_call', 'ai_direct_core_state_mutation'],
      },
    };
    const authorizedContract: FamilyModelRuntimeIntegrationContractAsset = {
      ...runtimeIntegrationContract,
      current_authorization_boundary: {
        ...runtimeIntegrationContract.current_authorization_boundary,
        business_runtime: 'AUTHORIZED',
        live_external_ai: 'AUTHORIZED',
      },
    };
    const runtime = new FamilyModelRuntimeIntegrationRuntime(authorizedContract, authorizedArchitecture);
    const plan = runtime.planRequest({
      request_id: 'REQ-RUNTIME-AUTHORIZED-1',
      surface_ref: 'UI-02',
      flow_ref: 'UI02_ASSESSMENT_TO_STRUCTURED_DRAFT',
      actor_ref: 'PARENT/P-1',
      purpose_ref: 'assessment_interpretation',
      consent_ref: 'CONSENT/FAMILY-1/ASSESSMENT',
      payload: { assessment_ref: 'FAMILY_SUPPORT_NEEDS/v2' },
      execution_context: 'api',
      business_runtime_authorized: true,
      live_external_ai_authorized: true,
      available_env_keys: [
        'FAMILY_MODEL_GATEWAY_MODE',
        'FAMILY_MODEL_ALLOW_LIVE_EXTERNAL_AI',
        'FAMILY_MODEL_CC_SWITCH_BASE_URL',
        'FAMILY_MODEL_CC_SWITCH_API_KEY',
        'FAMILY_MODEL_CC_SWITCH_MODEL',
      ],
    });

    expect(plan.blocked_reasons).toEqual([]);
    expect(plan.may_execute).toBe(true);
    expect(plan.may_call_live_external_ai).toBe(true);
    expect(plan.architecture_plan.gateway_profile_refs).toEqual(['FAMILY_MODEL_CC_SWITCH_GATEWAY']);
    expect(plan.may_mutate_business_state).toBe(false);
  });

  it('allows non-live worker integration plans when consent, surface, and purpose match', () => {
    const runtime = new FamilyModelRuntimeIntegrationRuntime(runtimeIntegrationContract, technicalArchitecture);
    const plan = runtime.planRequest({
      request_id: 'REQ-RUNTIME-2',
      surface_ref: 'UI-11',
      flow_ref: 'CONSENT_MEMORY_RECALL_AND_UPDATE_CANDIDATE',
      actor_ref: 'SYSTEM/MEMORY-WORKER',
      purpose_ref: 'memory_update_candidate',
      consent_ref: 'CONSENT/FAMILY-1/MEMORY',
      payload: { memory_context_ref: 'MEMORY/FAMILY-1' },
      execution_context: 'worker',
    });

    expect(plan.blocked_reasons).toEqual([]);
    expect(plan.may_execute).toBe(true);
    expect(plan.candidate_event_names).toContain('FamilyModelMemoryUpdateCandidateGenerated');
    expect(plan.boundary_labels).toEqual(['consent_required', 'memory_update_candidate_not_fact']);
  });

  it('builds consent-aware memory update candidates without writing core state', () => {
    const runtime = new FamilyMemoryDialogueRuntime();
    const candidate = runtime.buildUpdateCandidate({
      request_id: 'REQ-MEM-1',
      family_ref: 'FAMILY/F-1',
      session_ref: 'SESSION/S-1',
      actor_ref: 'PARENT/P-1',
      consent_ref: 'CONSENT/FAMILY-1/MEMORY',
      turns: [
        {
          turn_ref: 'TURN-1',
          speaker_role: 'parent',
          intent_refs: ['report_new_signal'],
          need_refs: ['CHILD_NEED_EMOTIONAL_SAFETY'],
          construct_refs: ['PARENT_CHILD_COMMUNICATION'],
          action_candidate_refs: ['COMMUNICATION_REPAIR_CONVERSATION'],
        },
        {
          turn_ref: 'TURN-2',
          speaker_role: 'child',
          need_refs: ['CHILD_NEED_EMOTIONAL_SAFETY'],
          construct_refs: ['PARENT_CHILD_COMMUNICATION'],
          outcome_refs: ['FAMILY_CONFLICT_CHANGE_SIGNAL'],
          risk_signal_refs: ['HIGH_CONFLICT_ESCALATION_SIGNAL'],
        },
      ],
    });

    expect(candidate.candidate_ref).toBe('MUC_REQ-MEM-1');
    expect(candidate.memory_object_refs).toEqual(['FAMILY_MEMORY_PROFILE', 'DIALOGUE_SUMMARY']);
    expect(candidate.boundary_labels).toContain('memory_update_candidate_not_fact');
    expect(candidate.need_summary).toEqual([{ need_ref: 'CHILD_NEED_EMOTIONAL_SAFETY', basis_item_refs: ['TURN-1', 'TURN-2'] }]);
    expect(candidate.construct_mapping[0]).toMatchObject({ construct_ref: 'PARENT_CHILD_COMMUNICATION', boundary: 'signal_not_diagnosis' });
    expect(candidate.action_candidate_refs).toEqual(['COMMUNICATION_REPAIR_CONVERSATION']);
    expect(candidate.human_gate).toEqual({ required: true, reason_refs: ['HIGH_CONFLICT_ESCALATION_SIGNAL'] });
    expect(candidate.blocked_reasons).toEqual([]);
    expect(candidate.requires_named_action).toBe('ConfirmMemoryUpdateCandidate');
    expect(candidate.may_mutate_business_state).toBe(false);
  });

  it('blocks memory update candidates when consent is missing', () => {
    const runtime = new FamilyMemoryDialogueRuntime();
    const candidate = runtime.buildUpdateCandidate({
      request_id: 'REQ-MEM-2',
      family_ref: 'FAMILY/F-1',
      session_ref: 'SESSION/S-2',
      actor_ref: 'PARENT/P-1',
      turns: [
        {
          turn_ref: 'TURN-1',
          speaker_role: 'parent',
          need_refs: ['PARENT_NEED_COMMUNICATION_SUPPORT'],
          construct_refs: ['PARENT_CHILD_COMMUNICATION'],
        },
      ],
    });

    expect(candidate.blocked_reasons).toEqual(['consent_required_missing']);
    expect(candidate.may_mutate_business_state).toBe(false);
    expect(() => assertMemoryUpdateCandidateBoundary({ ...candidate, requires_named_action: 'WriteMemory' as 'ConfirmMemoryUpdateCandidate' })).toThrow(/named action/);
  });

  it('blocks worker execution for UI-02 assessment integration flow', () => {
    const runtime = new FamilyModelRuntimeIntegrationRuntime(runtimeIntegrationContract, technicalArchitecture);
    const plan = runtime.planRequest({
      request_id: 'REQ-RUNTIME-3',
      surface_ref: 'UI-02',
      flow_ref: 'UI02_ASSESSMENT_TO_STRUCTURED_DRAFT',
      actor_ref: 'SYSTEM/ASSESSMENT-WORKER',
      purpose_ref: 'assessment_interpretation',
      consent_ref: 'CONSENT/FAMILY-1/ASSESSMENT',
      payload: {},
      execution_context: 'worker',
    });

    expect(plan.blocked_reasons).toContain('worker_execution_not_allowed_for_flow');
    expect(plan.may_execute).toBe(false);
  });
});