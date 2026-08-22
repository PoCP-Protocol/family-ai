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

// G1-A 契约收敛(架构师裁决):本文件是 `FamilyUiId` 与 `FamilyBusinessLoop` 的**唯一 canonical 来源**。
//  - FamilyUiId       = 严格 UI-01..UI-35 联合(取代 family-growth-os.ts 旧的松散 `UI-${string}`)
//  - FamilyBusinessLoop = V4 六业务循环(唯一 Business Loop 词汇)
// 旧 family-growth-os.ts 的 loop 类别已降维改名为 `GrowthCoreLoop`(Growth OS 内部运行语义,非 Business Loop)。
// 禁止 `type FamilyBusinessLoop = Old | New` 之类的语义 alias。
export type FamilyUiId = (typeof FAMILY_35_UI_IDS)[number];

export type FamilyBusinessLoop =
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
  ui_id: FamilyUiId;
  title: string;
  loop: FamilyBusinessLoop;
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
  ui_id: FamilyUiId;
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
