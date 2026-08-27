import type { GrowthActionDto } from './index';

/**
 * UI-01/UI-09 first real slice.
 * Every value is a family-scoped read projection or an approved Named Action
 * readback. This module intentionally contains no Outcome, score, ranking,
 * diagnosis, external-effect, or model-output type.
 */

export type FamilyTodayEntryState = 'READY' | 'EMPTY' | 'CONSENT_REQUIRED' | 'REVIEW_REQUIRED' | 'FORBIDDEN' | 'ERROR' | 'STALE';
export type FamilyTodayTaskState = 'NOT_STARTED' | 'IN_PROGRESS' | 'PAUSED' | 'CHECKED_IN' | 'PARTIAL' | 'NOT_COMPLETED' | 'CANCELLED' | 'ARCHIVED';
export type FamilyTodayTaskAction = 'START' | 'PAUSE' | 'RESUME' | 'CANCEL';

export interface TodayTaskProjection {
  task_id: string;
  family_id: string;
  day_index: GrowthActionDto['day_index'];
  /** Optional execution linkage for an active 90-day family plan; absent for legacy 7-day actions. */
  journey_plan_id: string | null;
  /** Schedule phase, not a child state, diagnosis, score, or outcome. */
  journey_phase: GrowthActionDto['journey_phase'] | null;
  journey_execution_boundary: 'JOURNEY_ACTION_IS_PROCESS_NOT_OUTCOME' | null;
  assignment_text: string;
  due_date: string;
  task_state: FamilyTodayTaskState;
  execution_status: NonNullable<GrowthActionDto['execution_status']>;
  persisted_status: GrowthActionDto['status'];
  completion_status: GrowthActionDto['completion_status'];
  completed_at: string | null;
  reflection_boundary: GrowthActionDto['reflection_boundary'];
  reflection_present: boolean;
  checkin_allowed: boolean;
  blocking_state: 'NONE' | 'CONSENT_REQUIRED' | 'REVIEW_REQUIRED' | 'FORBIDDEN' | 'STALE';
  task_version: number;
  started_at: string | null;
  paused_at: string | null;
  cancelled_at: string | null;
  allowed_actions: readonly FamilyTodayTaskAction[];
  as_of: string;
}

/** Read-only family-scoped projection for UI-01 and UI-09. */
export interface FamilyTodayProjection {
  projection_version: 'UI01_UI09_FAMILY_TODAY_V1';
  family_id: string;
  as_of: string;
  expires_at: null;
  entry_state: FamilyTodayEntryState;
  /**
   * The action layer has verified the authenticated caller is permitted to
   * manage this family. A display name or inferred child profile is purposely
   * not exposed by this first slice.
   */
  family_display: {
    display_name: null;
    actor_scope: 'AUTHORIZED_FAMILY_MANAGER';
  };
  /**
   * Read does not claim that a consent is granted. The check-in command
   * revalidates the required child-scoped consents immediately before writing.
   */
  consent_state: {
    state: 'COMMAND_POLICY_ENFORCED';
    required_purposes: readonly ['SERVICE', 'ASSESSMENT', 'GROWTH_TRACKING'];
    policy_version: 'EXISTING_GROWTH_ACTION_POLICY';
  };
  today_task: TodayTaskProjection | null;
  /** All canonical actions due today, ordered with actionable tasks first. */
  today_tasks: readonly TodayTaskProjection[];
  provenance: {
    source_refs: readonly ['growth_actions'];
    policy_version: 'EXISTING_GROWTH_ACTION_POLICY';
    as_of: string;
  };
  /** AI-native safety boundary: structured metadata only, never a model conclusion. */
  ai_ready: {
    evidence_boundary: 'ACTION_CHECKIN_IS_NOT_OUTCOME_OR_CAUSAL_EFFECT';
    recommendation_source: 'RULE_BASED_SYNTHETIC_NO_RECOMMENDATION';
    model_gateway_status: 'NOOP_NOT_INVOKED';
    agent_hint: 'READ_TODAY_AND_AWAIT_GUARDED_CHECKIN';
  };
}

/** Transport body for the existing CompleteGrowthAction Named Action. */
export interface Ui01Ui09CheckinRequest {
  completion_status: 'COMPLETED' | 'PARTIAL' | 'NOT_COMPLETED';
  reflection: string;
  occurred_at: string;
}

export interface Ui09TaskStateRequest {
  action: FamilyTodayTaskAction;
  occurred_at: string;
}

export interface Ui09TaskStateResultProjection {
  result_state: 'SUCCESS' | 'REPLAYED';
  action: TodayTaskProjection;
  correlation_id: string;
  idempotency_key_ref: string;
  audit_status: 'RECORDED';
}

export interface TaskCheckinResultProjection {
  result_state: 'SUCCESS' | 'REPLAYED';
  action: TodayTaskProjection;
  reflection_boundary: GrowthActionDto['reflection_boundary'];
  correlation_id: string;
  idempotency_key_ref: string;
  audit_status: 'RECORDED';
  /** Rule-based, read-only next step. It is not a model recommendation or command. */
  next_hint: {
    source: 'RULE_BASED_SYNTHETIC_NOOP';
    text_key: 'REFRESH_TODAY_AFTER_CHECKIN';
    model_gateway_status: 'NOOP_NOT_INVOKED';
  };
}

export function projectTodayTask(action: GrowthActionDto, asOf: string): TodayTaskProjection {
  const executionStatus = action.execution_status ?? (action.status === 'PENDING' ? 'NOT_STARTED' : action.status);
  const stateByExecution: Record<NonNullable<GrowthActionDto['execution_status']>, FamilyTodayTaskState> = {
    NOT_STARTED: 'NOT_STARTED', IN_PROGRESS: 'IN_PROGRESS', PAUSED: 'PAUSED', COMPLETED: 'CHECKED_IN',
    PARTIAL: 'PARTIAL', NOT_COMPLETED: 'NOT_COMPLETED', CANCELLED: 'CANCELLED',
  };
  const allowedByExecution: Record<NonNullable<GrowthActionDto['execution_status']>, readonly FamilyTodayTaskAction[]> = {
    NOT_STARTED: ['START', 'CANCEL'], IN_PROGRESS: ['PAUSE', 'CANCEL'], PAUSED: ['RESUME', 'CANCEL'],
    COMPLETED: [], PARTIAL: [], NOT_COMPLETED: [], CANCELLED: [],
  };
  const checkedIn = executionStatus === 'COMPLETED' || executionStatus === 'PARTIAL' || executionStatus === 'NOT_COMPLETED';
  return {
    task_id: action.action_id,
    family_id: action.family_id,
    day_index: action.day_index,
    journey_plan_id: action.journey_plan_id ?? null,
    journey_phase: action.journey_phase ?? null,
    journey_execution_boundary: action.journey_plan_id ? 'JOURNEY_ACTION_IS_PROCESS_NOT_OUTCOME' : null,
    assignment_text: action.assignment_text,
    due_date: action.due_date,
    task_state: stateByExecution[executionStatus],
    execution_status: executionStatus,
    persisted_status: action.status,
    completion_status: action.completion_status,
    completed_at: action.completed_at,
    reflection_boundary: action.reflection_boundary,
    reflection_present: action.reflection !== null && action.reflection.trim().length > 0,
    checkin_allowed: !checkedIn && executionStatus !== 'CANCELLED' && action.status === 'PENDING',
    blocking_state: 'NONE',
    task_version: action.row_version ?? 1,
    started_at: action.started_at ?? null,
    paused_at: action.paused_at ?? null,
    cancelled_at: action.cancelled_at ?? null,
    allowed_actions: allowedByExecution[executionStatus],
    as_of: asOf,
  };
}

export function projectFamilyToday(familyId: string, actionOrActions: GrowthActionDto | readonly GrowthActionDto[] | null, asOf: string): FamilyTodayProjection {
  const actions = Array.isArray(actionOrActions) ? actionOrActions : actionOrActions ? [actionOrActions] : [];
  const projected = actions.map((action) => projectTodayTask(action, asOf));
  return {
    projection_version: 'UI01_UI09_FAMILY_TODAY_V1',
    family_id: familyId,
    as_of: asOf,
    expires_at: null,
    entry_state: projected.length > 0 ? 'READY' : 'EMPTY',
    family_display: { display_name: null, actor_scope: 'AUTHORIZED_FAMILY_MANAGER' },
    consent_state: {
      state: 'COMMAND_POLICY_ENFORCED',
      required_purposes: ['SERVICE', 'ASSESSMENT', 'GROWTH_TRACKING'],
      policy_version: 'EXISTING_GROWTH_ACTION_POLICY',
    },
    today_task: projected[0] ?? null,
    today_tasks: projected,
    provenance: {
      source_refs: ['growth_actions'],
      policy_version: 'EXISTING_GROWTH_ACTION_POLICY',
      as_of: asOf,
    },
    ai_ready: {
      evidence_boundary: 'ACTION_CHECKIN_IS_NOT_OUTCOME_OR_CAUSAL_EFFECT',
      recommendation_source: 'RULE_BASED_SYNTHETIC_NO_RECOMMENDATION',
      model_gateway_status: 'NOOP_NOT_INVOKED',
      agent_hint: 'READ_TODAY_AND_AWAIT_GUARDED_CHECKIN',
    },
  };
}

export function projectTaskStateResult(
  action: GrowthActionDto,
  correlationId: string,
  idempotencyKey: string,
  replayed: boolean,
): Ui09TaskStateResultProjection {
  return {
    result_state: replayed ? 'REPLAYED' : 'SUCCESS',
    action: projectTodayTask(action, new Date().toISOString()),
    correlation_id: correlationId,
    idempotency_key_ref: idempotencyKey,
    audit_status: 'RECORDED',
  };
}

export function projectTaskCheckinResult(
  action: GrowthActionDto,
  correlationId: string,
  idempotencyKey: string,
  replayed: boolean,
): TaskCheckinResultProjection {
  return {
    result_state: replayed ? 'REPLAYED' : 'SUCCESS',
    action: projectTodayTask(action, new Date().toISOString()),
    reflection_boundary: action.reflection_boundary,
    correlation_id: correlationId,
    idempotency_key_ref: idempotencyKey,
    audit_status: 'RECORDED',
    next_hint: {
      source: 'RULE_BASED_SYNTHETIC_NOOP',
      text_key: 'REFRESH_TODAY_AFTER_CHECKIN',
      model_gateway_status: 'NOOP_NOT_INVOKED',
    },
  };
}
