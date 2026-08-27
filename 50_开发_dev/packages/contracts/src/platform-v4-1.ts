/**
 * FAMILY_AI_PLATFORM_V4_1 machine-level architecture contracts.
 *
 * These types describe stable platform boundaries. They do NOT authorize
 * production capabilities and do NOT grant AI permission to mutate domain truth.
 */
export const FAMILY_ARCHITECTURE_ID = 'FAMILY_AI_PLATFORM_V4_1' as const;

export type FamilyActorType = 'ACCOUNT' | 'PERSON' | 'SYSTEM' | 'WORKER';

export interface FamilyDomainEventEnvelope<TPayload = Record<string, unknown>> {
  event_id: string;
  event_type: string;
  event_version: number;
  aggregate_type: string;
  aggregate_id: string;
  family_id: string;
  tenant_id: string | null;
  occurred_at: string;
  actor_type: FamilyActorType;
  actor_id: string | null;
  correlation_id: string;
  causation_id: string | null;
  trace_id: string;
  payload: TPayload;
}

export type AiUseCaseId =
  | 'AI_DIAGNOSIS'
  | 'ASSESSMENT_INTERPRETATION'
  | 'GROWTH_PLAN_DRAFT'
  | 'PRIVATE_NOTE_TAGGING'
  | 'RESOURCE_RECOMMENDATION'
  | 'EXPERT_ROUTING'
  | 'REPORT_EXPLANATION'
  | 'DAILY_COACH';

export type AiInputDataClass =
  | 'PUBLIC'
  | 'FAMILY_CONTEXT_MINIMIZED'
  | 'FAMILY_SENSITIVE'
  | 'HIGH_SENSITIVITY_RESTRICTED';

export interface AiUseCasePolicy {
  use_case_id: AiUseCaseId;
  allowed_skill_ids: readonly string[];
  input_data_class: AiInputDataClass;
  required_consent_purposes: readonly string[];
  human_confirmation_required: boolean;
  may_propose_action: boolean;
  may_mutate_business_state: false;
  max_context_scope: string;
  provider_policy_id: string;
  eval_suite_id: string;
}

export interface TenantFamilyScopeContext {
  account_id: string;
  tenant_id: string | null;
  family_id: string;
  actor_person_id: string | null;
  purpose: string;
  consent_refs: readonly string[];
  visibility_scope: readonly string[];
}

export type FamilyContextMemoryKind =
  | 'WORKING'
  | 'EPISODIC'
  | 'SEMANTIC'
  | 'EVIDENCE';

export interface AiRunMetadata {
  ai_run_id: string;
  family_id: string;
  subject_person_id: string | null;
  use_case_id: AiUseCaseId;
  skill_id: string;
  skill_version: string;
  prompt_version: string;
  provider: string;
  model: string;
  model_version: string | null;
  context_snapshot_id: string | null;
  input_refs: readonly string[];
  output_ref: string | null;
  token_input: number | null;
  token_output: number | null;
  cost_micros: number | null;
  latency_ms: number | null;
  validation_status: 'PENDING' | 'PASS' | 'FAIL';
  safety_status: 'PENDING' | 'PASS' | 'REVIEW' | 'BLOCKED';
  human_review_status: 'NOT_REQUIRED' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'EDITED';
  trace_id: string;
  started_at: string;
  completed_at: string | null;
}

export type SkillReleaseStage = 'DEV' | 'INTERNAL' | 'SHADOW' | 'PILOT' | 'PROD';
