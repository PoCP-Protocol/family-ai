export type Ui03HypothesisAvailability = 'READY' | 'NO_SUBMITTED_ASSESSMENT' | 'POLICY_BLOCKED';
export type Ui03GrowthHypothesisGenerator = 'DETERMINISTIC_CATALOG_POLICY_NOT_MODEL' | 'FAMILY_EDUCATION_ASSESSMENT_MODEL_V0_1';
export type Ui03GrowthHypothesisAiState = 'NOT_INVOKED' | 'MODEL_DRAFT_READY' | 'MODEL_GATEWAY_BLOCKED';

export interface Ui03GrowthHypothesis {
  hypothesis_ref: string;
  subject_person_id: string;
  subject_display_name: string;
  focus_ref: string;
  need_type_ref: string;
  need_type_version: number;
  title: string;
  statement: string;
  required_capability_keys: string[];
  source_refs: {
    assessment_session_id: string;
    assessment_response_id: string;
    assessment_evidence_id: string;
    tool_ref: string;
    tool_version: number;
    assessment_submitted_at?: string | null;
  };
  limitations: string[];
  generator: Ui03GrowthHypothesisGenerator;
  model_draft_ref?: string;
  model_generator?: 'FAMILY_EDUCATION_MODEL_RUNTIME_DETERMINISTIC' | 'FAMILY_EDUCATION_MODEL_RUNTIME_GATEWAY';
  model_component_ref?: string;
  model_boundary_labels?: string[];
  need_refs?: string[];
  construct_refs?: string[];
  action_candidate_refs?: string[];
  fact_boundary: 'HYPOTHESIS_NOT_FACT_OR_DIAGNOSIS';
  principal?: Ui03PrincipalInterpretation;
  scorecard?: Ui03GrowthScorecard;
}

export interface Ui03PrincipalInterpretation {
  public_role: string;
  codename: string;
  opening: string;
  reading: string;
  boundary: string;
  boundary_labels: string[];
}

export interface Ui03GrowthScoreDimension {
  dimension_ref: string;
  label: string;
  score: number;
  peer_reference: number;
}

export interface Ui03GrowthScorecard {
  generated_by: 'FAMILI_PRINCIPAL_FAMILY_EDUCATION_MODEL';
  overall_score: number;
  overall_band: string;
  dimensions: Ui03GrowthScoreDimension[];
  core_issue_tags: string[];
  recommendations: string[];
  score_boundary: 'SUPPORT_ORIENTATION_SCORE_NOT_CHILD_DIAGNOSIS_OR_RANKING';
}

export interface Ui03GrowthHypothesisProjection {
  projection_version: 'UI03_GROWTH_HYPOTHESIS_V1';
  tenant_id: string;
  family_id: string;
  availability: Ui03HypothesisAvailability;
  hypothesis: Ui03GrowthHypothesis | null;
  named_actions: {
    confirm: 'CONFIRM_GROWTH_HYPOTHESIS';
    dismiss: 'DISMISS_GROWTH_HYPOTHESIS';
  };
  ai_state: Ui03GrowthHypothesisAiState;
}

export interface GrowthHypothesisDecisionReceipt {
  action: 'CONFIRM_GROWTH_HYPOTHESIS' | 'DISMISS_GROWTH_HYPOTHESIS';
  outcome: 'INTENT_CREATED' | 'NO_ACTION';
  hypothesis_ref: string;
  intent: null | {
    intent_id: string;
    need_type: string;
    status: 'OPEN';
    required_capability_keys: string[];
    evidence_refs: string[];
    boundary: 'HUMAN_CONFIRMED_INTENT_NOT_OUTCOME';
  };
  replayed: boolean;
}
