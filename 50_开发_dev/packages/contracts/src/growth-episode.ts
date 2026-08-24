/**
 * Family Platform V5 GrowthEpisode contract.
 *
 * GrowthEpisode is the shared process container for a family support journey:
 * 21-day program, 90-day journey, self-guided practice, AI-guided coaching,
 * human service, or hybrid delivery. It is not an outcome, diagnosis, score,
 * ranking, or entitlement object.
 */

export const GROWTH_EPISODE_TYPES = [
  'PROGRAM',
  'JOURNEY',
  'SELF_GUIDED',
  'AI_GUIDED',
  'HUMAN_SERVICE',
  'HYBRID',
] as const;

export type GrowthEpisodeType = (typeof GROWTH_EPISODE_TYPES)[number];

export type GrowthEpisodeStatus =
  | 'DRAFT'
  | 'ACTIVE'
  | 'PAUSED'
  | 'REVIEW_DUE'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'ARCHIVED';

export type GrowthEpisodeSourceKind =
  | 'GROWTH_NEED'
  | 'GROWTH_PRIORITY'
  | 'JOURNEY_PLAN'
  | 'PROGRAM_ENROLLMENT'
  | 'INTERVENTION_EPISODE'
  | 'SERVICE_CASE'
  | 'COMMERCE_ENTITLEMENT'
  | 'GROWTH_ACTION'
  | 'CHECKIN'
  | 'REFLECTION'
  | 'REVIEW'
  | 'OUTCOME_OBSERVATION';

export type GrowthEpisodeBoundary =
  | 'GROWTH_EPISODE_IS_SUPPORT_PROCESS_NOT_OUTCOME'
  | 'EPISODE_STATE_CHANGES_REQUIRE_NAMED_ACTION'
  | 'EPISODE_PROJECTION_MUST_NOT_MERGE_PERSPECTIVE_FACT_HYPOTHESIS_DECISION_ACTION_OUTCOME'
  | 'EPISODE_AI_SUMMARY_IS_REFLECTION_NOT_CORE_ONTOLOGY_WRITE';

export type GrowthEpisodeNamedAction =
  | 'START_GROWTH_EPISODE'
  | 'LINK_EPISODE_SOURCE'
  | 'PAUSE_GROWTH_EPISODE'
  | 'REVIEW_GROWTH_EPISODE'
  | 'COMPLETE_GROWTH_EPISODE'
  | 'ARCHIVE_GROWTH_EPISODE';

export interface GrowthEpisodeSourceRef {
  source_kind: GrowthEpisodeSourceKind;
  source_id: string;
  subject_person_id: string | null;
  evidence_refs: string[];
  provenance: string;
  linked_at: string;
}

export interface GrowthEpisodeMethodRef {
  method_id: string;
  version: string;
  evidence_refs: string[];
}

export interface GrowthEpisodeInterventionRef {
  intervention_id: string;
  version: string;
  source: 'INTERVENTION_LIBRARY' | 'HUMAN_AUTHORED' | 'PROGRAM_DEFINITION';
}

export interface GrowthEpisodeDto {
  episode_id: string;
  family_id: string;
  subject_person_id: string;
  need_ref: GrowthEpisodeSourceRef | null;
  priority_ref: GrowthEpisodeSourceRef | null;
  episode_type: GrowthEpisodeType;
  status: GrowthEpisodeStatus;
  title: string;
  current_phase: string | null;
  next_review_at: string | null;
  method_refs: GrowthEpisodeMethodRef[];
  intervention_refs: GrowthEpisodeInterventionRef[];
  program_ref: GrowthEpisodeSourceRef | null;
  journey_ref: GrowthEpisodeSourceRef | null;
  service_case_refs: GrowthEpisodeSourceRef[];
  action_refs: GrowthEpisodeSourceRef[];
  checkin_refs: GrowthEpisodeSourceRef[];
  reflection_refs: GrowthEpisodeSourceRef[];
  review_refs: GrowthEpisodeSourceRef[];
  outcome_observation_refs: GrowthEpisodeSourceRef[];
  boundaries: GrowthEpisodeBoundary[];
  policy_version: 'GROWTH_EPISODE_V1';
  created_at: string;
  updated_at: string;
  version: number;
}

export interface GrowthEpisodeProjection {
  family_id: string;
  subject_person_id: string;
  episode: GrowthEpisodeDto | null;
  source_refs: GrowthEpisodeSourceRef[];
  allowed_named_actions: GrowthEpisodeNamedAction[];
  fact_boundary: 'GROWTH_EPISODE_PROGRESS_IS_PROCESS_STATE_NOT_GROWTH_FACT';
  outcome_boundary: 'OUTCOME_OBSERVATION_REQUIRED_BEFORE_COMPLETION_CLAIM';
  model_gateway_status: 'NOOP' | 'AVAILABLE_FOR_REFLECTION_SUMMARY_ONLY';
}