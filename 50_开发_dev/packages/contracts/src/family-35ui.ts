/**
 * FAMILY-35UI-FULLSTACK-REBASELINE-001
 *
 * Shared implementation-level vocabulary for the 35-UI product baseline.
 * This file intentionally defines TYPES/INVARIANTS only.
 * The machine-readable per-screen mapping lives in:
 *   governance/FAMILY_35UI_RUNTIME_MATRIX_V1.json
 *
 * UI owns presentation/projection needs; Domain owns canonical truth.
 */
export const FAMILY_35_UI_IDS = [
  'UI-01','UI-02','UI-03','UI-04','UI-05','UI-06','UI-07','UI-08','UI-09','UI-10',
  'UI-11','UI-12','UI-13','UI-14','UI-15','UI-16','UI-17','UI-18','UI-19','UI-20',
  'UI-21','UI-22','UI-23','UI-24','UI-25','UI-26','UI-27','UI-28','UI-29','UI-30',
  'UI-31','UI-32','UI-33','UI-34','UI-35',
] as const;

// 类型名带 `Family35` 前缀,避免与既有 `family-growth-os.ts` 的
// `FamilyUiId`(松散 `UI-${string}`) 与 `FamilyBusinessLoop`(旧 6 loop: CORE_LOOP...)
// 在 barrel index.ts 处 `export *` 重名冲突。
// 两套词汇统一(旧 loop vs V4 六循环)属 G1 契约收敛,由架构师裁决。
export type Family35UiId = (typeof FAMILY_35_UI_IDS)[number];

export type Family35BusinessLoop =
  | 'GROWTH'
  | 'PLAN'
  | 'ASSESSMENT'
  | 'SERVICE'
  | 'COMMERCE'
  | 'COMMUNITY';

export type FamilyDomainOwner =
  | 'FAMILY_CORE'
  | 'GROWTH_INTELLIGENCE'
  | 'GROWTH_JOURNEY'
  | 'RESOURCE_COMMERCE'
  | 'SERVICE_OS'
  | 'CONTENT_COMMUNITY'
  | 'FAMILY_CONTEXT';

export type FamilyAiControlPlane = 'FAMILY_LLM_GATEWAY' | 'NONE';

export type FamilyUiCanonicalWriteRule =
  | 'DOMAIN_NAMED_ACTION_ONLY'
  | 'READ_ONLY_OR_DRAFT_ONLY';

export interface FamilyUiCapabilityContract {
  ui_id: Family35UiId;
  title: string;
  loop: Family35BusinessLoop;
  primary_domain: FamilyDomainOwner;
  supporting_domains: FamilyDomainOwner[];
  frontend_route: string;
  projection: string;
  named_actions: string[];
  ai_use_cases: string[];
  skills: string[];
  ai_control_plane: FamilyAiControlPlane;
  canonical_write_rule: FamilyUiCanonicalWriteRule;
}

export interface FamilyUiProjectionEnvelope<T> {
  family_id: string;
  ui_id: Family35UiId;
  projection_version: string;
  generated_at: string;
  trace_id: string;
  data: T;
  source_refs: string[];
}

/**
 * AI诊断 is a product capability, not a canonical medical/psychiatric diagnosis.
 * It is an interpretive artifact and must never be persisted as Child Fact directly.
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
