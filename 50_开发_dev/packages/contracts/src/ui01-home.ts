import type { TodayTaskProjection } from './ui01-ui09-first-slice';

export type Ui01FeatureAvailability = 'AVAILABLE' | 'POLICY_BLOCKED' | 'SUPPLY_UNAVAILABLE' | 'NOT_CONFIGURED';

export type Ui01GrowthHelpSubjectAvailability = 'AVAILABLE' | 'CONSENT_REQUIRED' | 'OUT_OF_SCOPE';

export interface FamilyHomeRecommendation {
  recommendation_id: string;
  source_type: 'PRODUCT_OFFERING' | 'SERVICE_OFFERING';
  title: string;
  target_ui: 'UI-13' | 'UI-19';
  availability: 'AVAILABLE';
  /** Display order is catalog order. It is not a score or an inferred preference. */
  ordering_basis: 'ACTIVE_ADMITTED_CATALOG_ORDER';
}

export interface FamilyHomeProjection {
  projection_version: 'UI01_FAMILY_HOME_V1';
  tenant_id: string;
  family_id: string;
  as_of: string;
  entry_state: 'READY' | 'EMPTY';
  family: {
    display_name: string;
    actor_scope: 'AUTHORIZED_FAMILY_MANAGER';
  };
  greeting: {
    time_segment: 'MORNING' | 'AFTERNOON' | 'EVENING';
    text_key: 'GROW_TOGETHER_TODAY';
  };
  notification: {
    state: 'NOT_CONFIGURED';
    unread_count: 0;
    target_ui: 'UI-34';
  };
  assessment_campaign: {
    state: 'AVAILABLE' | 'POLICY_BLOCKED';
    target_ui: 'UI-02';
  };
  quick_entries: readonly {
    feature_id: 'ai_diagnostic' | 'challenge_21' | 'plan_90' | 'growth_cases' | 'expert_live' | 'family_advisor';
    title: string;
    target_ui: 'UI-03' | 'UI-14' | 'UI-04' | 'UI-12' | 'UI-19';
    availability: Ui01FeatureAvailability;
  }[];
  growth_help: {
    state: 'AVAILABLE' | 'CONSENT_REQUIRED' | 'NO_ELIGIBLE_SUBJECT' | 'POLICY_BLOCKED';
    subjects: readonly {
      person_id: string;
      display_name: string;
      availability: Ui01GrowthHelpSubjectAvailability;
    }[];
    named_action: 'REQUEST_GROWTH_HELP';
    endpoint: '/orchestration/needs';
    safety_boundary: 'EXPLICIT_SUBMISSION_REQUIRED';
  };
  /** The single highest-priority action for tonight. No model is invoked to select it. */
  primary_action: TodayTaskProjection | null;
  today_tasks: readonly TodayTaskProjection[];
  journey: {
    plan_id: string;
    title: string;
    status: 'ACTIVE' | 'PAUSED';
    current_phase: string;
    current_day: number;
    total_days: 90;
    boundary: 'PLAN_PROGRESS_IS_PROCESS_NOT_OUTCOME';
  } | null;
  recommendations: readonly FamilyHomeRecommendation[];
  feature_availability: readonly {
    feature_id: string;
    target_route: string;
    availability: Ui01FeatureAvailability;
  }[];
  ai_assistance: {
    use_cases: readonly ['HOME_GROWTH_SUMMARY', 'NEXT_BEST_GROWTH_HELP'];
    state: 'NOT_INVOKED';
    named_action: 'REQUEST_GROWTH_HELP';
    evidence_boundary: 'NO_MODEL_CONCLUSION_IN_HOME_READ';
  };
  provenance: {
    source_refs: readonly ['families', 'persons', 'life_stage_assignments', 'consents', 'tenant_policy_profiles', 'growth_actions', 'family_journey_plans', 'family_product_offerings', 'family_service_offerings'];
    recommendation_policy: 'ACTIVE_ADMITTED_CATALOG_ONLY';
    as_of: string;
  };
}
