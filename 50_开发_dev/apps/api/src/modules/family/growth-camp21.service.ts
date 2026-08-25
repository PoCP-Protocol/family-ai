import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import type pg from 'pg';
import type { AuditMeta, CurriculumDraftReleaseReceipt, CurriculumDraftReviewReceipt, EnrollGrowthCamp21Request, GrowthCamp21CheckinReceipt, GrowthCamp21Enrollment, CheckInGrowthCamp21DayRequest, ReleaseCurriculumDraftRequest, ReviewCurriculumDraftRequest } from '@family/contracts';
import { COMMUNICATION_21DAY, projectProgramSchedule } from '@family/program-runtime';
import { assertCurriculumReviewer } from '../principal/curriculum-review-policy';
import { FamilyRepository } from './family.repository';
import { assertFamilyManagePermission } from './family-permission';

const PROGRAM_REF = 'communication-21day';
const PROGRAM_VERSION = '1.0.0';
const REVIEW = 'REVIEW_CURRICULUM_DRAFT';
const RELEASE = 'RELEASE_CURRICULUM_DRAFT';
const ENROLL = 'ENROLL_GROWTH_CAMP_21';
const CHECKIN = 'CHECK_IN_GROWTH_CAMP_21_DAY';

@Injectable()
export class GrowthCamp21Service {
  constructor(@Inject(FamilyRepository) private readonly repository: FamilyRepository) {}

  async reviewDraft(request: ReviewCurriculumDraftRequest, meta: AuditMeta): Promise<CurriculumDraftReviewReceipt> {
    assertCurriculumReviewer(meta.actor);
    return this.repository.withTransaction(async (client) => {
      const draft = await client.query<{ status: string; released_at: string | null }>('select status, released_at from family_curriculum_drafts where draft_id=$1 and (scope_type=\'PLATFORM\' or tenant_id is not null) for update', [request.draft_id]);
      if (!draft.rows[0]) throw new NotFoundException('curriculum_draft_not_found');
      if (draft.rows[0].released_at) throw new ConflictException('curriculum_draft_already_released');
      const hash = hashRequest({ ...request, actor: meta.actor });
      const replay = await replayOperation<CurriculumDraftReviewReceipt>(client, request.draft_id, REVIEW, request.idempotency_key, hash);
      if (replay) return replay;
      const reviewedAt = new Date().toISOString();
      const response: CurriculumDraftReviewReceipt = { draft_id: request.draft_id, decision: request.decision, status: request.decision, human_gate: request.decision === 'APPROVED' ? 'PASSED' : 'REJECTED', model_gateway_status: 'NOOP_NOT_INVOKED', released: false, reviewed_by: meta.actor, reviewed_at: reviewedAt, review_note: request.review_note ?? null };
      await client.query(`update family_curriculum_drafts set status=$2,reviewed_by_actor_id=$3,review_note=$4,reviewed_at=$5,updated_at=now() where draft_id=$1`, [request.draft_id, request.decision, meta.actor, request.review_note ?? null, reviewedAt]);
      await persistOperation(client, request.draft_id, REVIEW, meta.actor, request.decision, request.review_note ?? null, request.idempotency_key, hash, response, meta);
      await audit(client, REVIEW, 'CurriculumDraft', request.draft_id, request.idempotency_key, meta, response);
      await outbox(client, 'CurriculumDraft', request.draft_id, 'CurriculumDraftReviewed', response, meta);
      return response;
    });
  }

  async releaseDraft(request: ReleaseCurriculumDraftRequest, meta: AuditMeta): Promise<CurriculumDraftReleaseReceipt> {
    assertCurriculumReviewer(meta.actor);
    return this.repository.withTransaction(async (client) => {
      const draft = await client.query<{ status: string; released_at: string | null }>('select status, released_at from family_curriculum_drafts where draft_id=$1 for update', [request.draft_id]);
      if (!draft.rows[0]) throw new NotFoundException('curriculum_draft_not_found');
      const hash = hashRequest({ ...request, actor: meta.actor });
      const replay = await replayOperation<CurriculumDraftReleaseReceipt>(client, request.draft_id, RELEASE, request.idempotency_key, hash);
      if (replay) return replay;
      if (draft.rows[0].status !== 'APPROVED') throw new ConflictException('curriculum_draft_not_approved');
      if (draft.rows[0].released_at) throw new ConflictException('curriculum_draft_already_released');
      const releasedAt = new Date().toISOString();
      await client.query(`update family_curriculum_drafts set released_at=$2,updated_at=now() where draft_id=$1 and status='APPROVED' and released_at is null`, [request.draft_id, releasedAt]);
      const response: CurriculumDraftReleaseReceipt = { draft_id: request.draft_id, status: 'RELEASED', human_gate: 'PASSED', model_gateway_status: 'NOOP_NOT_INVOKED', released_by: meta.actor, released_at: releasedAt };
      await persistOperation(client, request.draft_id, RELEASE, meta.actor, 'APPROVED', null, request.idempotency_key, hash, response, meta);
      await audit(client, RELEASE, 'CurriculumDraft', request.draft_id, request.idempotency_key, meta, response);
      await outbox(client, 'CurriculumDraft', request.draft_id, 'CurriculumDraftReleased', response, meta);
      return response;
    });
  }

  async enroll(request: EnrollGrowthCamp21Request, meta: AuditMeta): Promise<GrowthCamp21Enrollment> {
    return this.repository.withTransaction(async (client) => {
      await ensureFamily(client, request.family_id); await assertFamilyManagePermission(client, request.family_id, meta.actor);
      const program = await client.query(`select 1 from family_growth_camp_programs where program_ref=$1 and version_no=1 and status='ACTIVE' and admission_status='ADMITTED'`, [PROGRAM_REF]);
      if (!program.rowCount) throw new NotFoundException('communication_21day_program_not_admitted');
      const draft = await client.query(`select 1 from family_curriculum_drafts d join tenant_family_bindings b on b.family_id=$1 and b.status='ACTIVE' and (d.scope_type='PLATFORM' or (d.scope_type='TENANT' and d.tenant_id=b.tenant_id) or (d.scope_type='FAMILY' and d.family_id=$1)) where d.program_ref=$2 and d.status='APPROVED' and d.released_at is not null limit 1`, [request.family_id, PROGRAM_REF]);
      if (!draft.rowCount && process.env.FPAI_REQUIRE_CURRICULUM_REVIEW === 'on') throw new ForbiddenException('curriculum_review_required_before_assign');
      const subject = await client.query(`select 1 from persons where person_id=$1 and family_id=$2`, [request.subject_person_id, request.family_id]);
      if (!subject.rowCount) throw new NotFoundException('subject_person_not_found');
      const hash = hashRequest({ ...request, actor: meta.actor }); const replay = await replayOperation<GrowthCamp21Enrollment>(client, request.family_id, ENROLL, request.idempotency_key, hash);
      if (replay) return replay;
      const existing = await client.query<EnrollmentRow>(`select enrollment_id,family_id,subject_person_id,program_ref,program_version,status,current_day from family_growth_camp_enrollments where family_id=$1 and subject_person_id=$2 and program_ref=$3 and status in ('ACTIVE','PAUSED') limit 1`, [request.family_id, request.subject_person_id, PROGRAM_REF]);
      if (existing.rows[0]) return enrollmentProjection(existing.rows[0]);
      const inserted = await client.query<EnrollmentRow>(`insert into family_growth_camp_enrollments(tenant_id,family_id,subject_person_id,program_ref,program_version,started_by_person_id) select t.tenant_id,$1,$2,$3,1,$4 from tenants t join tenant_family_bindings b on b.tenant_id=t.tenant_id and b.family_id=$1 limit 1 returning enrollment_id,family_id,subject_person_id,program_ref,program_version,status,current_day`, [request.family_id, request.subject_person_id, PROGRAM_REF, meta.actor]);
      if (!inserted.rows[0]) throw new NotFoundException('family_tenant_binding_not_found');
      const response = enrollmentProjection(inserted.rows[0]); await persistOperation(client, request.family_id, ENROLL, meta.actor, 'APPROVED', null, request.idempotency_key, hash, response, meta); await audit(client, ENROLL, 'GrowthCamp21Enrollment', response.enrollment_id, request.idempotency_key, meta, response, request.family_id); await outbox(client, 'GrowthCamp21Enrollment', response.enrollment_id, 'GrowthCamp21Enrolled', response, meta); return response;
    });
  }

  async checkIn(request: CheckInGrowthCamp21DayRequest, meta: AuditMeta): Promise<GrowthCamp21CheckinReceipt> {
    return this.repository.withTransaction(async (client) => {
      await ensureFamily(client, request.family_id); await assertFamilyManagePermission(client, request.family_id, meta.actor);
      const enrollment = await client.query<EnrollmentRow>(`select enrollment_id,family_id,subject_person_id,program_ref,program_version,status,current_day from family_growth_camp_enrollments where enrollment_id=$1 and family_id=$2 for update`, [request.enrollment_id, request.family_id]);
      const row = enrollment.rows[0]; if (!row) throw new NotFoundException('growth_camp_enrollment_not_found'); if (!['ACTIVE', 'PAUSED'].includes(row.status)) throw new ConflictException('growth_camp_enrollment_not_active'); if (request.day_no !== row.current_day) throw new ConflictException('growth_camp_day_not_current');
      const hash = hashRequest({ ...request, actor: meta.actor }); const replay = await replayOperation<GrowthCamp21CheckinReceipt>(client, request.enrollment_id, CHECKIN, request.idempotency_key, hash); if (replay) return replay;
      const checkin = await client.query<{ checkin_id: string }>(`insert into family_growth_camp_day_checkins(enrollment_id,day_no,completion_status,reflection,recorded_by_person_id,occurred_at) values ($1,$2,$3,$4,$5,coalesce($6::timestamptz,now())) returning checkin_id`, [request.enrollment_id, request.day_no, request.completion_status, request.reflection ?? null, meta.actor, request.occurred_at ?? null]);
      const nextDay = request.day_no < 21 ? request.day_no + 1 : 21; await client.query(`update family_growth_camp_enrollments set current_day=$2,status=case when $2=21 and $3='COMPLETED' then 'COMPLETED' else status end,row_version=row_version+1,updated_at=now() where enrollment_id=$1`, [request.enrollment_id, nextDay, request.completion_status]);
      const updated = { ...row, current_day: nextDay, status: nextDay === 21 && request.completion_status === 'COMPLETED' ? 'COMPLETED' : row.status } as EnrollmentRow; const response: GrowthCamp21CheckinReceipt = { checkin_id: checkin.rows[0].checkin_id, enrollment: enrollmentProjection(updated), day_no: request.day_no, completion_status: request.completion_status, reflection_boundary: 'PARENT_REFLECTION_NOT_CHILD_FACT_OR_OUTCOME', process_boundary: 'ACTION_RECORD_NOT_COMPLETION_TRUTH_OR_OUTCOME', replayed: false }; await persistOperation(client, request.enrollment_id, CHECKIN, meta.actor, 'APPROVED', null, request.idempotency_key, hash, response, meta); await audit(client, CHECKIN, 'GrowthCamp21DayCheckin', response.checkin_id, request.idempotency_key, meta, response, request.family_id); await outbox(client, 'GrowthCamp21DayCheckin', response.checkin_id, 'GrowthCamp21DayCheckedIn', response, meta); return response;
    });
  }
}

type EnrollmentRow = { enrollment_id: string; family_id: string; subject_person_id: string; program_ref: string; program_version: string; status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED'; current_day: number };
function hashRequest(value: unknown): string { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function enrollmentProjection(row: EnrollmentRow): GrowthCamp21Enrollment { const schedule = projectProgramSchedule(COMMUNICATION_21DAY, row.current_day); return { enrollment_id: row.enrollment_id, family_id: row.family_id, subject_person_id: row.subject_person_id, program_ref: 'communication-21day', program_version: '1.0.0', status: row.status, current_day: row.current_day, schedule_percent: schedule.schedule_percent, reached_final_day: schedule.reached_final_day, process_boundary: 'PROCESS_PROJECTION_NOT_SCORE_OR_OUTCOME' }; }
async function ensureFamily(client: pg.PoolClient, familyId: string): Promise<void> { const result = await client.query('select family_id from families where family_id=$1 for share', [familyId]); if (!result.rowCount) throw new NotFoundException('family_not_found'); }
async function replayOperation<T>(client: pg.PoolClient, ref: string, action: string, key: string, hash: string): Promise<T | null> { const table = action === REVIEW ? 'family_curriculum_review_operations' : 'family_curriculum_operations'; const refColumn = action === REVIEW ? 'draft_id::text' : 'operation_ref'; const result = await client.query<{ request_hash: string; response_body: T }>(`select request_hash,response_body from ${table} where ${refColumn}=$1 and action_name=$2 and idempotency_key=$3`, [ref, action, key]); if (!result.rows[0]) return null; if (result.rows[0].request_hash !== hash) throw new ConflictException('Idempotency conflict'); return result.rows[0].response_body; }
async function persistOperation(client: pg.PoolClient, ref: string, action: string, actor: string, decision: string, note: string | null, key: string, hash: string, response: unknown, meta: AuditMeta): Promise<void> { if (action === REVIEW) { await client.query(`insert into family_curriculum_review_operations(draft_id,action_name,actor_id,decision,review_note,idempotency_key,request_hash,response_body,correlation_id) values ($1::uuid,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)`, [ref, action, actor, decision, note, key, hash, JSON.stringify(response), meta.correlationId]); return; } await client.query(`insert into family_curriculum_operations(operation_ref,action_name,actor_id,idempotency_key,request_hash,response_body,correlation_id) values ($1,$2,$3,$4,$5,$6::jsonb,$7)`, [ref, action, actor, key, hash, JSON.stringify(response), meta.correlationId]); }
async function audit(client: pg.PoolClient, action: string, resource: string, id: string, key: string, meta: AuditMeta, response: unknown, familyId: string | null = null): Promise<void> { await client.query(`insert into audit_logs(family_id,actor_type,actor_id,action_name,resource_type,resource_id,correlation_id,idempotency_key,result,metadata) values ($1,'USER',$2,$3,$4,$5,$6,$7,'SUCCESS',$8::jsonb)`, [familyId, meta.actor, action, resource, id, meta.correlationId, key, JSON.stringify({ source: meta.source, occurred_at: meta.occurredAt, response })]); }
async function outbox(client: pg.PoolClient, type: string, id: string, event: string, response: unknown, meta: AuditMeta): Promise<void> { const eventId = randomUUID(); await client.query(`insert into outbox_events(aggregate_type,aggregate_id,event_name,event_version,event_id,correlation_id,payload,occurred_at) values ($1,$2,$3,1,$4,$5,$6::jsonb,$7)`, [type, id, event, eventId, meta.correlationId, JSON.stringify({ event_id: eventId, occurred_at: meta.occurredAt, actor_id: meta.actor, correlation_id: meta.correlationId, response }), meta.occurredAt]); }