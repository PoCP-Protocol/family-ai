/**
 * Family consumer UI baseline canonical product/runtime vocabulary.
 *
 * UI owns presentation/projection needs; Domain owns canonical truth.
 * V4.1 canonical business loops, domains, and scenario-driven 4A mappings are defined here.
 */
export const FAMILY_UI_IDS = [
  'UI-01','UI-02','UI-03','UI-04','UI-05','UI-06','UI-07','UI-08','UI-09','UI-10',
  'UI-11','UI-12','UI-13','UI-14','UI-15','UI-16','UI-17','UI-18','UI-19','UI-20',
  'UI-21','UI-22','UI-23','UI-24','UI-25','UI-26','UI-27','UI-28','UI-29','UI-30',
  'UI-31','UI-32','UI-33','UI-34',
] as const;

export type FamilyUiId = (typeof FAMILY_UI_IDS)[number];

export const FAMILY_BUSINESS_LOOPS = [
  'GROWTH',
  'PLAN',
  'ASSESSMENT',
  'SERVICE',
  'COMMERCE',
  'COMMUNITY',
] as const;

export type FamilyBusinessLoop = (typeof FAMILY_BUSINESS_LOOPS)[number];

export const FAMILY_BUSINESS_DOMAINS = [
  'FAMILY_CORE',
  'GROWTH_INTELLIGENCE',
  'GROWTH_JOURNEY',
  'RESOURCE_NETWORK',
  'SERVICE_OS',
  'COMMERCE_ENTITLEMENT',
  'CONTENT_COMMUNITY',
] as const;

export type FamilyDomainOwner = (typeof FAMILY_BUSINESS_DOMAINS)[number];

export const FAMILY_CROSS_DOMAIN_PLATFORMS = ['FAMILY_CONTEXT_PLATFORM'] as const;
export type FamilyCrossDomainPlatform = (typeof FAMILY_CROSS_DOMAIN_PLATFORMS)[number];

export const FAMILY_SCENARIO_IDS = [
  'SCENE-01_FAMILY_ENTRY_NOW',
  'SCENE-02_ASSESSMENT_PROBLEM_UNDERSTANDING',
  'SCENE-03_21_DAY_FIRST_CHANGE',
  'SCENE-04_90_DAY_GROWTH_JOURNEY',
  'SCENE-05_DAILY_AI_COMPANION',
  'SCENE-06_EXPERT_HUMAN_SERVICE',
  'SCENE-07_CONTENT_COMMUNITY_GROWTH_STORY',
  'SCENE-08_COMMERCE_MEMBERSHIP_FAMILY_ASSET',
] as const;

export type FamilyScenarioId = (typeof FAMILY_SCENARIO_IDS)[number];

export type FamilyArchitectureLayer = 'BA' | 'DA' | 'AA' | 'TA_AI';

export type FamilyAiCapability =
  | 'MODEL_GATEWAY'
  | 'TRUSTED_CONTEXT_BROKER'
  | 'KNOWLEDGE_RAG'
  | 'METHOD_REGISTRY'
  | 'INTERVENTION_LIBRARY'
  | 'SKILL_RUNTIME'
  | 'AGENT_RUNTIME'
  | 'SAFETY_POLICY'
  | 'EVAL_RUNTIME'
  | 'MODEL_RUN_LEDGER'
  | 'CODEX_HARNESS';

/** Current runtime adapter truth; target control plane is declared separately. */
export type FamilyRuntimeAiAdapter = 'FAMILY_LLM_GATEWAY' | 'NONE';

/** V4.1 target: model-backed capabilities converge behind the Family AI Control Plane. */
export type FamilyTargetAiControlPlane = 'FAMILY_AI_CONTROL_PLANE' | 'NONE';

export type FamilyUiCanonicalWriteRule =
  | 'DOMAIN_NAMED_ACTION_ONLY'
  | 'READ_ONLY_OR_DRAFT_ONLY';

export interface FamilyUiCapabilityContract {
  ui_id: FamilyUiId;
  title: string;
  loop: FamilyBusinessLoop;
  primary_domain: FamilyDomainOwner;
  supporting_domains: FamilyDomainOwner[];
  platform_dependencies: FamilyCrossDomainPlatform[];
  frontend_route: string;
  projection: string;
  named_actions: string[];
  ai_use_cases: string[];
  skills: string[];
  runtime_ai_adapter: FamilyRuntimeAiAdapter;
  target_ai_control_plane: FamilyTargetAiControlPlane;
  canonical_write_rule: FamilyUiCanonicalWriteRule;
}

export interface FamilyScenario4AMapping {
  scenario_id: FamilyScenarioId;
  title: string;
  business_loop: FamilyBusinessLoop;
  ui_surfaces: FamilyUiId[];
  business_architecture: string;
  data_architecture: string;
  application_architecture: string;
  technical_ai_architecture: string;
  named_actions: string[];
  ai_capabilities: FamilyAiCapability[];
  human_gate_required: boolean;
  forbidden_shortcuts: string[];
}

export const FAMILY_CONSUMER_UI_SCENARIO_4A_MAPPING: readonly FamilyScenario4AMapping[] = [
  {
    scenario_id: 'SCENE-01_FAMILY_ENTRY_NOW',
    title: 'Family entry and FamilyNow',
    business_loop: 'GROWTH',
    ui_surfaces: ['UI-01', 'UI-09', 'UI-11', 'UI-12'],
    business_architecture: 'Parent enters the family growth system through one useful action for today, not an open chat or score dashboard.',
    data_architecture: 'Read FamilyHomeProjection, current Journey summary, daily action candidate, and private milestone snippets with source and visibility labels.',
    application_architecture: 'Mobile/Web home, Today action, rhythm, and private story screens share registered routes and projection-driven states.',
    technical_ai_architecture: 'AI summaries must go through Model Gateway and Trusted Context Broker; all writes continue through Named Actions.',
    named_actions: ['REQUEST_GROWTH_HELP', 'COMPLETE_DAILY_ACTION', 'SAVE_PARENT_REFLECTION'],
    ai_capabilities: ['MODEL_GATEWAY', 'TRUSTED_CONTEXT_BROKER', 'SAFETY_POLICY', 'MODEL_RUN_LEDGER'],
    human_gate_required: false,
    forbidden_shortcuts: ['family_total_score', 'family_ranking', 'direct_growth_profile_write'],
  },
  {
    scenario_id: 'SCENE-02_ASSESSMENT_PROBLEM_UNDERSTANDING',
    title: 'Assessment and problem understanding',
    business_loop: 'ASSESSMENT',
    ui_surfaces: ['UI-02', 'UI-03', 'UI-07', 'UI-08'],
    business_architecture: 'Family describes concerns and reviews support hypotheses without receiving diagnosis, ranking, or child fact assertions.',
    data_architecture: 'NeedInput is Perspective; NeedSignal and GrowthDiagnosticHypothesis remain Hypothesis/Recommendation until family confirmation.',
    application_architecture: 'Assessment, report, and review screens must show evidence boundaries and provide confirm, dismiss, and revise paths.',
    technical_ai_architecture: 'LLM generation is a draft behind Gateway, Output Validator, Evidence discipline, and Human Gate for high-risk signals.',
    named_actions: ['START_ASSESSMENT', 'SAVE_ASSESSMENT_RESPONSE', 'SUBMIT_ASSESSMENT', 'CONFIRM_GROWTH_HYPOTHESIS'],
    ai_capabilities: ['MODEL_GATEWAY', 'KNOWLEDGE_RAG', 'SAFETY_POLICY', 'EVAL_RUNTIME', 'MODEL_RUN_LEDGER'],
    human_gate_required: true,
    forbidden_shortcuts: ['ai_diagnosis_as_fact', 'automatic_child_fact', 'assessment_score_ranking'],
  },
  {
    scenario_id: 'SCENE-03_21_DAY_FIRST_CHANGE',
    title: '21-day first change program',
    business_loop: 'PLAN',
    ui_surfaces: ['UI-14', 'UI-09', 'UI-31', 'UI-34'],
    business_architecture: '21-Day Program is a business program and entitlement flow, not a standalone UI baseline page.',
    data_architecture: 'ProgramOffering, CommerceIntent, Entitlement, ProgramEnrollment, GrowthAction, and ServiceRecord remain separated.',
    application_architecture: 'Program discovery starts at product detail, daily work appears in Today action, service status appears in My Services and Service Records.',
    technical_ai_architecture: 'Program suggestions can explain fit but cannot activate entitlement, create service truth, or advance progress without Named Action.',
    named_actions: ['SUBMIT_COMMERCE_INTENT', 'ACTIVATE_DEV_ENTITLEMENT', 'ENROLL_PROGRAM', 'COMPLETE_DAILY_ACTION', 'APPEND_SERVICE_RECORD'],
    ai_capabilities: ['METHOD_REGISTRY', 'INTERVENTION_LIBRARY', 'MODEL_GATEWAY', 'MODEL_RUN_LEDGER'],
    human_gate_required: false,
    forbidden_shortcuts: ['ui_35_route', 'implicit_program_enrollment', 'action_as_outcome'],
  },
  {
    scenario_id: 'SCENE-04_90_DAY_GROWTH_JOURNEY',
    title: '90-day growth journey',
    business_loop: 'PLAN',
    ui_surfaces: ['UI-04', 'UI-05', 'UI-09', 'UI-10', 'UI-11', 'UI-12', 'UI-29'],
    business_architecture: 'Family confirms a priority, follows a staged 90-day plan, records process, and reviews milestones without causal overclaim.',
    data_architecture: 'GrowthPriority, GrowthJourney, GrowthAction, GrowthEvent, Reflection, Milestone, and OutcomeCandidate keep separate state transitions.',
    application_architecture: 'Plan, companion, task, child assistant, rhythm, story, and outcome screens share recoverable journey state.',
    technical_ai_architecture: 'Plan drafts and review summaries use controlled methods, audit, replay, and safety policies before any family-facing presentation.',
    named_actions: ['CONFIRM_JOURNEY_PLAN', 'COMPLETE_DAILY_ACTION', 'REVIEW_JOURNEY_PHASE', 'SAVE_PRIVATE_GROWTH_STORY'],
    ai_capabilities: ['METHOD_REGISTRY', 'INTERVENTION_LIBRARY', 'SKILL_RUNTIME', 'EVAL_RUNTIME'],
    human_gate_required: true,
    forbidden_shortcuts: ['service_completion_as_outcome', 'causal_claim_without_episode', 'child_diagnosis'],
  },
  {
    scenario_id: 'SCENE-05_DAILY_AI_COMPANION',
    title: 'Daily AI companion',
    business_loop: 'GROWTH',
    ui_surfaces: ['UI-01', 'UI-03', 'UI-09', 'UI-10'],
    business_architecture: 'AI supports low-dose daily practice and reflection while keeping parent decision and family consent in control.',
    data_architecture: 'Context snapshots are minimized; AI output is Recommendation or draft text, never canonical ontology truth.',
    application_architecture: 'Companion affordances stay embedded in scenario screens instead of becoming an unbounded chat homepage.',
    technical_ai_architecture: 'Every model call uses Gateway, policy, ledger, eval hooks, and high-risk routing.',
    named_actions: ['REQUEST_AI_EXPLANATION', 'SAVE_PARENT_REFLECTION', 'ESCALATE_TO_HUMAN_SUPPORT'],
    ai_capabilities: ['MODEL_GATEWAY', 'TRUSTED_CONTEXT_BROKER', 'AGENT_RUNTIME', 'SAFETY_POLICY', 'EVAL_RUNTIME', 'MODEL_RUN_LEDGER'],
    human_gate_required: true,
    forbidden_shortcuts: ['free_text_core_mutation', 'ungated_child_chat', 'model_provider_direct_call'],
  },
  {
    scenario_id: 'SCENE-06_EXPERT_HUMAN_SERVICE',
    title: 'Expert and human service',
    business_loop: 'SERVICE',
    ui_surfaces: ['UI-19', 'UI-20', 'UI-21', 'UI-22', 'UI-23', 'UI-24', 'UI-31', 'UI-34'],
    business_architecture: 'Family can understand expert/service fit, submit intent, and later review service records with clear human confirmation boundaries.',
    data_architecture: 'Provider, ServiceOffering, BookingRequest, ServiceCase, ServiceRecord, consent, and availability are first-class objects.',
    application_architecture: 'Teacher, booking, activity, service mine, my services, and records screens distinguish intent, confirmed service, and record.',
    technical_ai_architecture: 'Human Gate owns expert confirmation; AI may prepare structured drafts but cannot claim service happened.',
    named_actions: ['SUBMIT_SERVICE_BOOKING', 'SUBMIT_ACTIVITY_INTENT', 'CONFIRM_SERVICE_CASE', 'APPEND_SERVICE_RECORD'],
    ai_capabilities: ['TRUSTED_CONTEXT_BROKER', 'SAFETY_POLICY', 'MODEL_RUN_LEDGER'],
    human_gate_required: true,
    forbidden_shortcuts: ['external_effect_without_gate', 'fake_provider_confirmation', 'service_record_as_outcome'],
  },
  {
    scenario_id: 'SCENE-07_CONTENT_COMMUNITY_GROWTH_STORY',
    title: 'Content, community, and growth story',
    business_loop: 'COMMUNITY',
    ui_surfaces: ['UI-25', 'UI-26', 'UI-27', 'UI-28', 'UI-12'],
    business_architecture: 'Family content starts private, can become a reviewed draft, and does not create public comparison or social pressure.',
    data_architecture: 'FamilyNote, CommunityPostDraft, Visibility, Moderation, CommentPerspective, and GrowthStory stay provenance-labeled.',
    application_architecture: 'Community and story screens default to private/draft states and avoid public counters as truth.',
    technical_ai_architecture: 'AI can help tag, summarize, or redact drafts; publication, moderation, and minor-related content need policy gates.',
    named_actions: ['SAVE_FAMILY_NOTE_DRAFT', 'SUBMIT_COMMUNITY_DRAFT', 'REDACT_SHARE_DRAFT'],
    ai_capabilities: ['MODEL_GATEWAY', 'SAFETY_POLICY', 'EVAL_RUNTIME'],
    human_gate_required: true,
    forbidden_shortcuts: ['public_by_default', 'cross_family_ranking', 'minor_content_without_review'],
  },
  {
    scenario_id: 'SCENE-08_COMMERCE_MEMBERSHIP_FAMILY_ASSET',
    title: 'Commerce, membership, and family asset',
    business_loop: 'COMMERCE',
    ui_surfaces: ['UI-06', 'UI-13', 'UI-14', 'UI-15', 'UI-16', 'UI-17', 'UI-18', 'UI-30', 'UI-32', 'UI-33'],
    business_architecture: 'Family reviews resources, memberships, invitations, points, orders, assets, and profile details without recommendation being driven by margin.',
    data_architecture: 'CatalogItem, ResourceCandidate, CommerceIntent, OrderIntent, Entitlement, Membership, PointsLedger, CustomerAsset, and FamilyProfile remain separated.',
    application_architecture: 'Commerce, member, annual plan, orders/assets, and profile screens expose intent and entitlement states without real payment in DEV.',
    technical_ai_architecture: 'Recommendation fit uses fiduciary ranking and policy; payment, renewal, and entitlement activation require explicit gates.',
    named_actions: ['SUBMIT_COMMERCE_INTENT', 'CREATE_INVITE_DRAFT', 'CREATE_GROUP_INTENT', 'ACTIVATE_DEV_ENTITLEMENT', 'UPDATE_FAMILY_PROFILE'],
    ai_capabilities: ['KNOWLEDGE_RAG', 'MODEL_GATEWAY', 'MODEL_RUN_LEDGER'],
    human_gate_required: false,
    forbidden_shortcuts: ['margin_ranked_recommendation', 'real_payment_in_dev', 'implicit_entitlement'],
  },
] as const;

export interface FamilyUiProjectionEnvelope<T> {
  family_id: string;
  ui_id: FamilyUiId;
  projection_version: string;
  generated_at: string;
  trace_id: string;
  data: T;
  source_refs: string[];
}

/**
 * Product-facing AI诊断 is retained.
 * Internal semantics remain hypothesis/interpretation, never an automatic child Fact.
 */
export interface GrowthDiagnosticHypothesis {
  hypothesis_id: string;
  family_id: string;
  subject_person_id: string | null;
  statement: string;
  evidence_refs: string[];
  unknowns: string[];
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  source: 'AI_INFERENCE' | 'RULE_ASSISTED' | 'HUMAN_AUTHORED';
  fact_boundary: 'HYPOTHESIS_NOT_FACT';
  status: 'PROPOSED' | 'FAMILY_ACKNOWLEDGED' | 'SUPERSEDED';
  created_at: string;
}

export interface FamilyAiActionProposal {
  proposal_id: string;
  family_id: string;
  use_case: string;
  proposed_action: string;
  requires_family_confirmation: true;
  may_mutate_business_state: false;
  evidence_refs: string[];
  created_at: string;
}

export interface FamilyNamedActionRequest<TPayload = Record<string, unknown>> {
  family_id: string;
  actor_person_id: string;
  idempotency_key: string;
  correlation_id: string;
  action: string;
  payload: TPayload;
}