/**
 * FAMILY 35-UI canonical product/runtime vocabulary.
 *
 * UI owns presentation/projection needs; Domain owns canonical truth.
 * V4.1 canonical business loops and business domains are defined here.
 */
export const FAMILY_UI_IDS = [
  'UI-01','UI-02','UI-03','UI-04','UI-05','UI-06','UI-07','UI-08','UI-09','UI-10',
  'UI-11','UI-12','UI-13','UI-14','UI-15','UI-16','UI-17','UI-18','UI-19','UI-20',
  'UI-21','UI-22','UI-23','UI-24','UI-25','UI-26','UI-27','UI-28','UI-29','UI-30',
  'UI-31','UI-32','UI-33','UI-34','UI-35',
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
