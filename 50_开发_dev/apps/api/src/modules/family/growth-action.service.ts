import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { assertFamilyManagePermission as sharedAssertFamilyManagePermission } from './family-permission';
import { createHash, randomUUID } from 'node:crypto';
import type pg from 'pg';
import type { AuditMeta, CompleteGrowthActionRequest, CompleteGrowthActionResponse, GrowthActionDto } from '@family/contracts';
import { FamilyRepository } from './family.repository';
import { REFLECTION_BOUNDARY, assertCompletableGrowthActionStatus } from './growth-action.policy';
import { assertNormalSafetyRoute } from './normal-safety-route.policy';
import { GrowthSubjectResolver } from './growth-subject.resolver';
import { assertReflectionSafetyRoute } from './reflection-safety.policy';
import type { ValidatedTaskStateActionRequest } from './task-state-action.dto';

const CREATE_FAMILY_ACTION = 'CreateFamily';
const COMPLETE_GROWTH_ACTION_ACTION = 'CompleteGrowthAction';
const GROWTH_ACTION_COMPLETED_EVENT = 'GrowthActionCompleted';
const GROWTH_ACTION_STATE_CHANGED_EVENT = 'GrowthActionStateChanged';

type IdempotencyResult<TResponse> = { replay: false } | { replay: true; response: TResponse };

type JourneyCompletedActionRow = {
  action_id: string;
  journey_plan_id: string;
  journey_phase: NonNullable<GrowthActionDto['journey_phase']>;
  day_index: GrowthActionDto['day_index'];
  completed_at: string;
};

export type JourneyCompletedActionReadback = {
  action_id: string;
  journey_plan_id: string;
  journey_phase: NonNullable<GrowthActionDto['journey_phase']>;
  day_index: GrowthActionDto['day_index'];
  completed_at: string;
  boundary: 'JOURNEY_ACTION_IS_PROCESS_NOT_OUTCOME';
};

export type TaskExecutionTransitionResponse = { action: GrowthActionDto; replayed: boolean };

@Injectable()
export class GrowthActionService {
  constructor(
    @Inject(FamilyRepository) private readonly repository: FamilyRepository,
    @Inject(GrowthSubjectResolver) private readonly growthSubjectResolver: GrowthSubjectResolver = new GrowthSubjectResolver(),
  ) {}

  async getTodayAction(familyId: string, actorId: string): Promise<GrowthActionDto | null> {
    return this.repository.withTransaction(async (client) => {
      await ensureFamilyExists(client, familyId);
      await assertFamilyManagePermission(client, familyId, actorId);
      const result = await client.query<GrowthActionRow>(
        `select ga.action_id, ga.family_id, ga.subject_person_id, ga.onboarding_id, ga.priority_id, ga.intervention_episode_id,
                ga.journey_plan_id, ga.journey_phase, ga.day_index, ga.status, ga.assignment_text, ga.due_date, ga.completed_at,
                ga.completion_status, ga.reflection, ga.reflection_boundary, ga.boundary, ga.created_at,
                ga.execution_status, ga.started_at, ga.paused_at, ga.cancelled_at, ga.row_version
         from growth_actions ga
         left join intervention_episodes ie on ie.episode_id = ga.intervention_episode_id
         left join family_journey_plans jp on jp.plan_id = ga.journey_plan_id
         where ga.family_id = $1 and ga.status = 'PENDING'
           and ga.subject_person_id is not null
           and ga.due_date = current_date
           and (ie.status = 'ACTIVE' or jp.status = 'ACTIVE')
         order by case when jp.status = 'ACTIVE' then 0 else 1 end, ga.due_date, ga.day_index
         limit 1`,
        [familyId],
      );
      return result.rows[0] ? mapGrowthAction(result.rows[0]) : null;
    });
  }

  /** UI-01 readback includes both pending and already checked-in actions due today. */
  async listTodayActions(familyId: string, actorId: string): Promise<readonly GrowthActionDto[]> {
    return this.repository.withTransaction(async (client) => {
      await ensureFamilyExists(client, familyId);
      await assertFamilyManagePermission(client, familyId, actorId);
      const result = await client.query<GrowthActionRow>(
        `select ga.action_id, ga.family_id, ga.subject_person_id, ga.onboarding_id, ga.priority_id, ga.intervention_episode_id,
                ga.journey_plan_id, ga.journey_phase, ga.day_index, ga.status, ga.assignment_text, ga.due_date, ga.completed_at,
                ga.completion_status, ga.reflection, ga.reflection_boundary, ga.boundary, ga.created_at,
                ga.execution_status, ga.started_at, ga.paused_at, ga.cancelled_at, ga.row_version
           from growth_actions ga
           left join intervention_episodes ie on ie.episode_id = ga.intervention_episode_id
           left join family_journey_plans jp on jp.plan_id = ga.journey_plan_id
          where ga.family_id = $1 and ga.due_date = current_date
            and ga.subject_person_id is not null
            and ga.status in ('PENDING','COMPLETED','PARTIAL','NOT_COMPLETED')
            and (ie.status = 'ACTIVE' or jp.status in ('ACTIVE','PAUSED'))
          order by case when ga.status = 'PENDING' then 0 else 1 end,
                   case when jp.status = 'ACTIVE' then 0 else 1 end,
                   ga.day_index, ga.created_at
          limit 3`,
        [familyId],
      );
      return result.rows.map(mapGrowthAction);
    });
  }

  async listCompletedJourneyActions(
    familyId: string,
    actorId: string,
    onboardingId: string,
  ): Promise<readonly JourneyCompletedActionReadback[]> {
    return this.repository.withTransaction(async (client) => {
      await ensureFamilyExists(client, familyId);
      await assertFamilyManagePermission(client, familyId, actorId);
      const result = await client.query<JourneyCompletedActionRow>(
        `select ga.action_id, ga.journey_plan_id, ga.journey_phase, ga.day_index, ga.completed_at
         from growth_actions ga
         join family_journey_plans jp on jp.plan_id = ga.journey_plan_id
         where ga.family_id = $1
           and ga.onboarding_id = $2
           and ga.journey_plan_id is not null
           and ga.completed_at is not null
         order by ga.completed_at desc, ga.day_index desc
         limit 12`,
        [familyId, onboardingId],
      );
      return result.rows.map((row) => ({
        action_id: row.action_id,
        journey_plan_id: row.journey_plan_id,
        journey_phase: row.journey_phase,
        day_index: row.day_index,
        completed_at: row.completed_at,
        boundary: 'JOURNEY_ACTION_IS_PROCESS_NOT_OUTCOME' as const,
      }));
    });
  }

  async completeGrowthAction(request: CompleteGrowthActionRequest, meta: AuditMeta): Promise<CompleteGrowthActionResponse> {
    assertCompletableGrowthActionStatus(request.completion_status);
    const requestHash = hashCompleteGrowthActionRequest(request, meta.actor);
    return this.repository.withTransaction(async (client) => {
      await ensureFamilyExists(client, request.family_id);
      await assertFamilyManagePermission(client, request.family_id, meta.actor);
      const idempotency = await lockIdempotencyKey<CompleteGrowthActionResponse>(client, COMPLETE_GROWTH_ACTION_ACTION, request.idempotency_key, requestHash);
      if (idempotency.replay) {
        return { ...idempotency.response, replayed: true };
      }

      const existing = await getCompletableGrowthAction(client, request.family_id, request.action_id);
      const subject = await this.growthSubjectResolver.resolve(client, {
        familyId: request.family_id,
        onboardingId: existing.onboarding_id,
        priorityId: existing.priority_id,
      });
      assertSubjectScopeMatches(existing.subject_person_id, subject.childPersonId, 'growth_action_subject_unresolved');
      await assertRequiredGrowthConsents(client, request.family_id, subject.childPersonId);
      await assertNormalSafetyRoute(client, request.family_id, existing.onboarding_id);
      assertReflectionSafetyRoute(request.reflection);
      const action = await updateGrowthActionCompletion(client, request);
      await refreshJourneyPlanExecution(client, action, meta.occurredAt);
      const response: CompleteGrowthActionResponse = {
        action,
        reflection_boundary: REFLECTION_BOUNDARY,
        replayed: false,
      };
      await insertAudit(client, COMPLETE_GROWTH_ACTION_ACTION, 'GrowthAction', request.family_id, request.action_id, request.idempotency_key, meta, response);
      await insertGrowthActionCompletedEvent(client, response, meta);
      await storeIdempotencyResponse(client, request.idempotency_key, response, 200);
      return response;
    });
  }

  async transitionTaskExecution(request: ValidatedTaskStateActionRequest, meta: AuditMeta): Promise<TaskExecutionTransitionResponse> {
    const actionName = `${request.action[0]}${request.action.slice(1).toLowerCase()}GrowthAction`;
    const requestHash = createHash('sha256').update(JSON.stringify({ ...request, actor_id: meta.actor })).digest('hex');
    return this.repository.withTransaction(async (client) => {
      await ensureFamilyExists(client, request.family_id);
      await assertFamilyManagePermission(client, request.family_id, meta.actor);
      const idempotency = await lockIdempotencyKey<TaskExecutionTransitionResponse>(client, actionName, request.idempotency_key, requestHash);
      if (idempotency.replay) return { ...idempotency.response, replayed: true };

      const existing = await getTaskExecutionAction(client, request.family_id, request.action_id);
      const subject = await this.growthSubjectResolver.resolve(client, {
        familyId: request.family_id,
        onboardingId: existing.onboarding_id,
        priorityId: existing.priority_id,
      });
      assertSubjectScopeMatches(existing.subject_person_id, subject.childPersonId, 'growth_action_subject_unresolved');
      await assertRequiredGrowthConsents(client, request.family_id, subject.childPersonId);
      await assertNormalSafetyRoute(client, request.family_id, existing.onboarding_id);
      assertExecutionTransition(existing.execution_status, request.action);
      const action = await updateTaskExecutionState(client, request);
      const response: TaskExecutionTransitionResponse = { action, replayed: false };
      await insertAudit(client, actionName, 'GrowthAction', request.family_id, request.action_id, request.idempotency_key, meta, response);
      await insertGrowthActionStateChangedEvent(client, request.action, response, meta);
      await storeIdempotencyResponse(client, request.idempotency_key, response, 200);
      return response;
    });
  }
}

function assertExecutionTransition(current: NonNullable<GrowthActionDto['execution_status']>, requested: ValidatedTaskStateActionRequest['action']): void {
  const allowed: Record<NonNullable<GrowthActionDto['execution_status']>, readonly ValidatedTaskStateActionRequest['action'][]> = {
    NOT_STARTED: ['START', 'CANCEL'], IN_PROGRESS: ['PAUSE', 'CANCEL'], PAUSED: ['RESUME', 'CANCEL'],
    COMPLETED: [], PARTIAL: [], NOT_COMPLETED: [], CANCELLED: [],
  };
  if (!allowed[current].includes(requested)) throw new ConflictException(`task_transition_not_allowed:${current}:${requested}`);
}

function hashCompleteGrowthActionRequest(request: CompleteGrowthActionRequest, actorId: string): string {
  return createHash('sha256')
    .update(JSON.stringify({
      family_id: request.family_id,
      action_id: request.action_id,
      completion_status: request.completion_status,
      reflection: request.reflection,
      occurred_at: request.occurred_at,
      actor_id: actorId,
    }))
    .digest('hex');
}

async function lockIdempotencyKey<TResponse>(
  client: pg.PoolClient,
  actionName: string,
  idempotencyKey: string,
  requestHash: string,
): Promise<IdempotencyResult<TResponse>> {
  await client.query(
    `insert into idempotency_keys(idempotency_key, action_name, request_hash)
     values ($1, $2, $3)
     on conflict (idempotency_key) do nothing`,
    [idempotencyKey, actionName, requestHash],
  );
  const result = await client.query<{ action_name: string; request_hash: string; response_body: unknown | null }>(
    `select action_name, request_hash, response_body
     from idempotency_keys
     where idempotency_key = $1
     for update`,
    [idempotencyKey],
  );
  const row = result.rows[0];
  if (!row || row.action_name !== actionName || row.request_hash !== requestHash) {
    throw new ConflictException('Idempotency conflict');
  }
  if (row.response_body) {
    return { replay: true, response: row.response_body as TResponse };
  }
  return { replay: false };
}

async function storeIdempotencyResponse<TResponse>(client: pg.PoolClient, idempotencyKey: string, response: TResponse, responseCode: number): Promise<void> {
  await client.query(
    `update idempotency_keys
     set response_code = $2, response_body = $3::jsonb
     where idempotency_key = $1`,
    [idempotencyKey, responseCode, JSON.stringify(response)],
  );
}

async function ensureFamilyExists(client: pg.PoolClient, familyId: string): Promise<void> {
  const result = await client.query('select family_id from families where family_id = $1 for share', [familyId]);
  if (result.rowCount !== 1) {
    throw new NotFoundException('family_not_found');
  }
}

// 桥接:委托共享 family-permission(创建者 或 ACTIVE OWNER/GUARDIAN 成员)。
async function assertFamilyManagePermission(client: pg.PoolClient, familyId: string, actorId: string): Promise<void> {
  return sharedAssertFamilyManagePermission(client, familyId, actorId);
}

async function assertRequiredGrowthConsents(client: pg.PoolClient, familyId: string, childId: string): Promise<void> {
  const result = await client.query<{ purpose: string }>(
    `select purpose
     from consents
     where family_id = $1
       and subject_person_id = $2
       and purpose = any($3::consent_purpose[])
       and status = 'GRANTED'
     for share`,
    [familyId, childId, ['SERVICE', 'ASSESSMENT', 'GROWTH_TRACKING']],
  );
  const granted = new Set(result.rows.map((row) => row.purpose));
  const missing = ['SERVICE', 'ASSESSMENT', 'GROWTH_TRACKING'].filter((purpose) => !granted.has(purpose));
  if (missing.length > 0) {
    throw new ForbiddenException(`missing_required_consent:${missing.join(',')}`);
  }
}

async function getCompletableGrowthAction(client: pg.PoolClient, familyId: string, actionId: string): Promise<{ action_id: string; subject_person_id: string | null; onboarding_id: string; priority_id: string; status: string }> {
  const result = await client.query<{ action_id: string; subject_person_id: string | null; onboarding_id: string; priority_id: string; status: string }>(
    `select ga.action_id, ga.subject_person_id, ga.onboarding_id, ga.priority_id, ga.status
     from growth_actions ga
     left join intervention_episodes ie on ie.episode_id = ga.intervention_episode_id
     left join family_journey_plans jp on jp.plan_id = ga.journey_plan_id
     where ga.family_id = $1
       and ga.action_id = $2
       and (ie.status = 'ACTIVE' or jp.status = 'ACTIVE')
     for update of ga`,
    [familyId, actionId],
  );
  const row = result.rows[0];
  if (!row) {
    throw new NotFoundException('growth_action_not_found');
  }
  if (row.status !== 'PENDING') {
    throw new ConflictException('growth_action_already_checked_in');
  }
  return row;
}

async function getTaskExecutionAction(
  client: pg.PoolClient,
  familyId: string,
  actionId: string,
): Promise<{ action_id: string; subject_person_id: string | null; onboarding_id: string; priority_id: string; status: string; execution_status: NonNullable<GrowthActionDto['execution_status']> }> {
  const result = await client.query<{ action_id: string; subject_person_id: string | null; onboarding_id: string; priority_id: string; status: string; execution_status: NonNullable<GrowthActionDto['execution_status']> }>(
    `select ga.action_id, ga.subject_person_id, ga.onboarding_id, ga.priority_id, ga.status, ga.execution_status
       from growth_actions ga
       left join intervention_episodes ie on ie.episode_id = ga.intervention_episode_id
       left join family_journey_plans jp on jp.plan_id = ga.journey_plan_id
      where ga.family_id = $1 and ga.action_id = $2
        and ga.due_date = current_date
        and (ie.status = 'ACTIVE' or jp.status in ('ACTIVE','PAUSED'))
      for update of ga`,
    [familyId, actionId],
  );
  const row = result.rows[0];
  if (!row) throw new NotFoundException('growth_action_not_found');
  if (row.status !== 'PENDING') throw new ConflictException('growth_action_already_final');
  return row;
}

async function updateTaskExecutionState(client: pg.PoolClient, request: ValidatedTaskStateActionRequest): Promise<GrowthActionDto> {
  const next = request.action === 'START' || request.action === 'RESUME' ? 'IN_PROGRESS' : request.action === 'PAUSE' ? 'PAUSED' : 'CANCELLED';
  const result = await client.query<GrowthActionRow>(
    `update growth_actions
        set execution_status = $3,
            started_at = case when $4 = 'START' then $5::timestamptz else started_at end,
            paused_at = case when $4 = 'PAUSE' then $5::timestamptz when $4 = 'RESUME' then null else paused_at end,
            cancelled_at = case when $4 = 'CANCEL' then $5::timestamptz else cancelled_at end,
            status = case when $4 = 'CANCEL' then 'NOT_COMPLETED' else status end,
            row_version = row_version + 1
      where family_id = $1 and action_id = $2
      returning action_id, family_id, subject_person_id, onboarding_id, priority_id, intervention_episode_id,
                journey_plan_id, journey_phase, day_index, status, assignment_text, due_date, completed_at,
                completion_status, reflection, reflection_boundary, boundary, created_at,
                execution_status, started_at, paused_at, cancelled_at, row_version`,
    [request.family_id, request.action_id, next, request.action, request.occurred_at],
  );
  if (!result.rows[0]) throw new NotFoundException('growth_action_not_found');
  return mapGrowthAction(result.rows[0]);
}

async function updateGrowthActionCompletion(client: pg.PoolClient, request: CompleteGrowthActionRequest): Promise<GrowthActionDto> {
  const result = await client.query<GrowthActionRow>(
    `update growth_actions
     set status = $3,
         completion_status = $3,
         completed_at = $4,
         reflection = $5,
         reflection_boundary = $6,
         execution_status = $3,
         row_version = row_version + 1
     where family_id = $1 and action_id = $2
    returning action_id, family_id, subject_person_id, onboarding_id, priority_id, intervention_episode_id,
               journey_plan_id, journey_phase, day_index, status, assignment_text, due_date, completed_at,
               completion_status, reflection, reflection_boundary, boundary, created_at,
               execution_status, started_at, paused_at, cancelled_at, row_version`,
    [request.family_id, request.action_id, request.completion_status, request.occurred_at, request.reflection, REFLECTION_BOUNDARY],
  );
  const row = result.rows[0];
  if (!row) {
    throw new NotFoundException('growth_action_not_found');
  }
  return mapGrowthAction(row);
}

async function refreshJourneyPlanExecution(
  client: pg.PoolClient,
  action: GrowthActionDto,
  occurredAt: string,
): Promise<void> {
  if (!action.journey_plan_id || !action.journey_phase) return;

  await client.query(
    `update family_journey_plans
     set current_day = greatest(current_day, $3), updated_at = $4, version = version + 1
     where family_id = $1 and plan_id = $2 and status = 'ACTIVE'`,
    [action.family_id, action.journey_plan_id, action.day_index, occurredAt],
  );

  await client.query(
    `update family_journey_plan_phases phase
     set status = 'REVIEW_DUE', updated_at = $4
     from family_journey_plans plan
     where phase.plan_id = plan.plan_id
       and plan.family_id = $1
       and plan.plan_id = $2
       and phase.phase = $3
       and phase.status = 'ACTIVE'
       and $5 >= phase.review_due_day`,
    [action.family_id, action.journey_plan_id, action.journey_phase, occurredAt, action.day_index],
  );
}

async function insertAudit(
  client: pg.PoolClient,
  actionName: string,
  resourceType: string,
  familyId: string,
  resourceId: string,
  idempotencyKey: string,
  meta: AuditMeta,
  response: unknown,
): Promise<void> {
  await client.query(
    `insert into audit_logs(
       family_id, actor_type, actor_id, action_name, resource_type, resource_id,
       correlation_id, idempotency_key, result, metadata
     ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)`,
    [familyId, 'USER', meta.actor, actionName, resourceType, resourceId, meta.correlationId, idempotencyKey, 'SUCCESS', JSON.stringify({ source: meta.source, occurred_at: meta.occurredAt, response })],
  );
}

async function insertGrowthActionCompletedEvent(client: pg.PoolClient, response: CompleteGrowthActionResponse, meta: AuditMeta): Promise<void> {
  const eventId = randomUUID();
  await client.query(
    `insert into outbox_events(
       aggregate_type, aggregate_id, event_name, event_version, event_id,
       correlation_id, payload, occurred_at
     ) values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)`,
    [
      'GrowthAction',
      response.action.action_id,
      GROWTH_ACTION_COMPLETED_EVENT,
      1,
      eventId,
      meta.correlationId,
      JSON.stringify({ event_id: eventId, occurred_at: meta.occurredAt, actor_id: meta.actor, correlation_id: meta.correlationId, ...response }),
      meta.occurredAt,
    ],
  );
}

async function insertGrowthActionStateChangedEvent(
  client: pg.PoolClient,
  transition: ValidatedTaskStateActionRequest['action'],
  response: TaskExecutionTransitionResponse,
  meta: AuditMeta,
): Promise<void> {
  const eventId = randomUUID();
  await client.query(
    `insert into outbox_events(
       aggregate_type, aggregate_id, event_name, event_version, event_id,
       correlation_id, payload, occurred_at
     ) values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)`,
    ['GrowthAction', response.action.action_id, GROWTH_ACTION_STATE_CHANGED_EVENT, 1, eventId, meta.correlationId,
      JSON.stringify({ event_id: eventId, actor_id: meta.actor, transition, action: response.action }), meta.occurredAt],
  );
}

interface GrowthActionRow {
  action_id: string;
  family_id: string;
  subject_person_id: string;
  onboarding_id: string;
  priority_id: string;
  intervention_episode_id: string | null;
  journey_plan_id: string | null;
  journey_phase: 'SEE' | 'PARENT_FIRST' | 'CO_CREATE' | 'STABILIZE' | null;
  day_index: number;
  status: GrowthActionDto['status'];
  assignment_text: string;
  due_date: Date | string;
  completed_at: Date | string | null;
  completion_status: GrowthActionDto['completion_status'];
  reflection: string | null;
  reflection_boundary: GrowthActionDto['reflection_boundary'];
  boundary: GrowthActionDto['boundary'];
  created_at: Date | string;
  execution_status?: NonNullable<GrowthActionDto['execution_status']>;
  started_at?: Date | string | null;
  paused_at?: Date | string | null;
  cancelled_at?: Date | string | null;
  row_version?: number;
}

function mapGrowthAction(row: GrowthActionRow): GrowthActionDto {
  return {
    action_id: row.action_id,
    family_id: row.family_id,
    subject_person_id: row.subject_person_id,
    onboarding_id: row.onboarding_id,
    priority_id: row.priority_id,
    intervention_episode_id: row.intervention_episode_id,
    journey_plan_id: row.journey_plan_id,
    journey_phase: row.journey_phase,
    day_index: row.day_index,
    status: row.status,
    assignment_text: row.assignment_text,
    due_date: toDateOnly(row.due_date),
    completed_at: row.completed_at ? toIsoString(row.completed_at) : null,
    completion_status: row.completion_status,
    reflection: row.reflection,
    reflection_boundary: row.reflection_boundary,
    boundary: row.boundary,
    created_at: toIsoString(row.created_at),
    execution_status: row.execution_status ?? (row.status === 'PENDING' ? 'NOT_STARTED' : row.status),
    started_at: row.started_at ? toIsoString(row.started_at) : null,
    paused_at: row.paused_at ? toIsoString(row.paused_at) : null,
    cancelled_at: row.cancelled_at ? toIsoString(row.cancelled_at) : null,
    row_version: row.row_version ?? 1,
  };
}

function assertSubjectScopeMatches(actual: string | null | undefined, expected: string, errorCode: string): void {
  if (!actual) throw new ConflictException(errorCode);
  if (actual !== expected) throw new ConflictException('subject_scope_conflict');
}

function toIsoString(value: Date | string): string {
  return typeof value === 'string' ? value : value.toISOString();
}

function toDateOnly(value: Date | string): string {
  if (typeof value === 'string') {
    return value.includes('T') ? value.slice(0, 10) : value;
  }
  return value.toISOString().slice(0, 10);
}
