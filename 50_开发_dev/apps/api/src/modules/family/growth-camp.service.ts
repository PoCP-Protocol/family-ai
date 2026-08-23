import { createHash, randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { GrowthCampDayCheckinDto, GrowthCampEnrollmentDto, GrowthCampMutationReceipt, Ui35GrowthCampProjection } from '@family/contracts';
import type pg from 'pg';
import { FamilyRepository } from './family.repository';
import { assertFamilyManagePermission } from './family-permission';

type MutationMeta = { correlationId: string; idempotencyKey: string; source: string };
type CampAction = GrowthCampMutationReceipt['action'];

@Injectable()
export class GrowthCampService {
  constructor(@Inject(FamilyRepository) private readonly repository: FamilyRepository) {}

  async getProjection(familyId: string, tenantId: string, actorId: string): Promise<Ui35GrowthCampProjection> {
    return this.repository.withTransaction(async (client) => {
      await this.assertScope(client, familyId, tenantId, actorId);
      const program = await this.loadProgram(client);
      const policy = await client.query<{ allowed_pages: string[] | null }>(`select allowed_pages from tenant_policy_profiles where tenant_id=$1 and status='ACTIVE' order by created_at desc limit 1`, [tenantId]);
      const allowedPages = policy.rows[0]?.allowed_pages ?? [];
      const policyAllows = allowedPages.length === 0 || allowedPages.includes('UI-35');
      const subjects = await client.query<{ person_id: string; display_name: string; consent_granted: boolean }>(
        `select p.person_id,p.display_name,exists(select 1 from consents c where c.family_id=p.family_id and c.subject_person_id=p.person_id and c.purpose='SERVICE' and c.status='GRANTED') consent_granted
           from persons p where p.family_id=$1 and p.person_type='CHILD' order by p.created_at,p.person_id`, [familyId],
      );
      const enrollmentRow = await client.query<any>(
        `select * from family_growth_camp_enrollments where tenant_id=$1 and family_id=$2 order by (status in ('ACTIVE','PAUSED')) desc,updated_at desc,enrollment_id desc limit 1`,
        [tenantId, familyId],
      );
      const enrollment = enrollmentRow.rows[0] ? mapEnrollment(enrollmentRow.rows[0]) : null;
      const checkins = enrollment ? await this.loadCheckins(client, enrollment.enrollment_id) : [];
      const mappedSubjects = subjects.rows.map((subject) => ({ person_id: subject.person_id, display_name: subject.display_name, availability: subject.consent_granted ? 'AVAILABLE' as const : 'CONSENT_REQUIRED' as const }));
      return {
        projection_version: 'UI35_GROWTH_CAMP_V1', tenant_id: tenantId, family_id: familyId,
        availability: !policyAllows ? 'POLICY_BLOCKED' : mappedSubjects.some((subject) => subject.availability === 'AVAILABLE') ? 'AVAILABLE' : mappedSubjects.length > 0 ? 'CONSENT_REQUIRED' : 'NO_SUBJECT',
        subjects: mappedSubjects, program, enrollment, checkins,
        boundary: 'ACTION_RECORD_IS_NOT_CHILD_SCORE_DIAGNOSIS_OR_GROWTH_OUTCOME',
      };
    });
  }

  async enroll(familyId: string, tenantId: string, actorId: string, subjectPersonId: string, meta: MutationMeta): Promise<GrowthCampMutationReceipt> {
    this.requireMeta(meta);
    if (!isUuid(subjectPersonId)) throw new BadRequestException('valid_subject_person_id_required');
    const requestHash = hashRequest({ subject_person_id: subjectPersonId, program_ref: 'PARENT_GROWTH_21' });
    return this.repository.withTransaction(async (client) => {
      await this.lockOperation(client, tenantId, familyId, 'ENROLL_GROWTH_CAMP', meta.idempotencyKey);
      const replay = await this.loadReplay(client, tenantId, familyId, 'ENROLL_GROWTH_CAMP', meta.idempotencyKey, requestHash);
      if (replay) return replay;
      await this.assertScope(client, familyId, tenantId, actorId);
      await this.assertServiceConsent(client, familyId, subjectPersonId);
      const program = await this.loadProgram(client);
      const existing = await client.query<any>(
        `select * from family_growth_camp_enrollments where family_id=$1 and subject_person_id=$2 and program_ref=$3 and status in ('ACTIVE','PAUSED') order by updated_at desc limit 1 for update`,
        [familyId, subjectPersonId, program.program_ref],
      );
      const row = existing.rows[0] ?? (await client.query<any>(
        `insert into family_growth_camp_enrollments(tenant_id,family_id,subject_person_id,program_ref,program_version,started_by_person_id) values ($1,$2,$3,$4,$5,$6) returning *`,
        [tenantId, familyId, subjectPersonId, program.program_ref, program.version_no, actorId],
      )).rows[0];
      const receipt: GrowthCampMutationReceipt = { action: 'ENROLL_GROWTH_CAMP', replayed: false, enrollment: mapEnrollment(row), boundary: 'ACTION_RECORD_IS_NOT_CHILD_SCORE_DIAGNOSIS_OR_GROWTH_OUTCOME' };
      await this.persistOperation(client, tenantId, familyId, receipt.enrollment.enrollment_id, actorId, 'ENROLL_GROWTH_CAMP', requestHash, receipt, meta);
      await this.auditAndEmit(client, familyId, actorId, receipt.enrollment.enrollment_id, 'ENROLL_GROWTH_CAMP', 'GrowthCampEnrolled', receipt, meta);
      return receipt;
    });
  }

  async checkInDay(familyId: string, tenantId: string, actorId: string, enrollmentId: string, dayNo: number, request: { completion_status: 'COMPLETED' | 'PARTIAL' | 'NOT_COMPLETED'; reflection?: string; occurred_at: string }, meta: MutationMeta): Promise<GrowthCampMutationReceipt> {
    this.requireMeta(meta);
    if (!isUuid(enrollmentId) || !Number.isInteger(dayNo) || dayNo < 1 || dayNo > 21) throw new BadRequestException('valid_growth_camp_day_required');
    if (!['COMPLETED','PARTIAL','NOT_COMPLETED'].includes(request.completion_status)) throw new BadRequestException('valid_completion_status_required');
    const reflection = request.reflection?.trim() || null;
    if (reflection && reflection.length > 500) throw new BadRequestException('reflection_too_long');
    const occurredAt = new Date(request.occurred_at);
    if (Number.isNaN(occurredAt.getTime())) throw new BadRequestException('valid_occurred_at_required');
    const requestHash = hashRequest({ enrollment_id: enrollmentId, day_no: dayNo, completion_status: request.completion_status, reflection, occurred_at: occurredAt.toISOString() });
    return this.repository.withTransaction(async (client) => {
      await this.lockOperation(client, tenantId, familyId, 'CHECK_IN_GROWTH_CAMP_DAY', meta.idempotencyKey);
      const replay = await this.loadReplay(client, tenantId, familyId, 'CHECK_IN_GROWTH_CAMP_DAY', meta.idempotencyKey, requestHash);
      if (replay) return replay;
      await this.assertScope(client, familyId, tenantId, actorId);
      const result = await client.query<any>(`select * from family_growth_camp_enrollments where enrollment_id=$1 and tenant_id=$2 and family_id=$3 for update`, [enrollmentId, tenantId, familyId]);
      const row = result.rows[0];
      if (!row) throw new NotFoundException('growth_camp_enrollment_not_found');
      if (row.status !== 'ACTIVE') throw new ConflictException('growth_camp_enrollment_not_active');
      if (dayNo !== row.current_day) throw new ConflictException('growth_camp_day_not_current');
      await this.assertServiceConsent(client, familyId, row.subject_person_id);
      const checkinRow = (await client.query<any>(
        `insert into family_growth_camp_day_checkins(enrollment_id,day_no,completion_status,reflection,recorded_by_person_id,occurred_at) values ($1,$2,$3,$4,$5,$6) returning *`,
        [enrollmentId, dayNo, request.completion_status, reflection, actorId, occurredAt.toISOString()],
      )).rows[0];
      const nextDay = Math.min(21, dayNo + 1);
      const nextStatus = dayNo === 21 ? 'COMPLETED' : 'ACTIVE';
      const updated = (await client.query<any>(
        `update family_growth_camp_enrollments set current_day=$2,status=$3::varchar,completed_at=case when $3::varchar='COMPLETED' then now() else completed_at end,row_version=row_version+1,updated_at=now() where enrollment_id=$1 returning *`,
        [enrollmentId, nextDay, nextStatus],
      )).rows[0];
      const receipt: GrowthCampMutationReceipt = { action: 'CHECK_IN_GROWTH_CAMP_DAY', replayed: false, enrollment: mapEnrollment(updated), checkin: mapCheckin(checkinRow), boundary: 'ACTION_RECORD_IS_NOT_CHILD_SCORE_DIAGNOSIS_OR_GROWTH_OUTCOME' };
      await this.persistOperation(client, tenantId, familyId, enrollmentId, actorId, 'CHECK_IN_GROWTH_CAMP_DAY', requestHash, receipt, meta);
      await this.auditAndEmit(client, familyId, actorId, enrollmentId, 'CHECK_IN_GROWTH_CAMP_DAY', 'GrowthCampDayCheckedIn', receipt, meta);
      return receipt;
    });
  }

  private async loadProgram(client: pg.PoolClient): Promise<Ui35GrowthCampProjection['program']> {
    const program = await client.query<any>(`select program_ref,version_no,title,purpose,evidence_level from family_growth_camp_programs where program_ref='PARENT_GROWTH_21' and status='ACTIVE' and admission_status='ADMITTED' and effective_from<=now() and (effective_to is null or effective_to>now()) order by version_no desc limit 1`);
    if (!program.rows[0]) throw new NotFoundException('active_growth_camp_program_not_found');
    const days = await client.query<any>(`select day_no,stage,title,intent,action_text,suggested_words,observation_prompt,estimated_minutes from family_growth_camp_days where program_ref=$1 and program_version=$2 order by day_no`, [program.rows[0].program_ref, program.rows[0].version_no]);
    if (days.rows.length !== 21) throw new ConflictException('growth_camp_curriculum_incomplete');
    return { program_ref: 'PARENT_GROWTH_21', version_no: program.rows[0].version_no, title: program.rows[0].title, purpose: program.rows[0].purpose, evidence_level: 'E1', days: days.rows.map((day) => ({ day: day.day_no, stage: day.stage, title: day.title, intent: day.intent, action: day.action_text, suggested_words: day.suggested_words, observation_prompt: day.observation_prompt, estimated_minutes: day.estimated_minutes })) };
  }

  private async loadCheckins(client: pg.PoolClient, enrollmentId: string): Promise<GrowthCampDayCheckinDto[]> {
    return (await client.query<any>(`select * from family_growth_camp_day_checkins where enrollment_id=$1 order by day_no`, [enrollmentId])).rows.map(mapCheckin);
  }

  private async assertScope(client: pg.PoolClient, familyId: string, tenantId: string, actorId: string) {
    const binding = await client.query(`select 1 from tenant_family_bindings where tenant_id=$1 and family_id=$2 and status='ACTIVE' and effective_from<=now() and (effective_to is null or effective_to>now()) limit 1`, [tenantId, familyId]);
    if ((binding.rowCount ?? 0) !== 1) throw new ForbiddenException('tenant_family_scope_denied');
    await assertFamilyManagePermission(client, familyId, actorId);
  }

  private async assertServiceConsent(client: pg.PoolClient, familyId: string, subjectPersonId: string) {
    const result = await client.query(`select 1 from persons p where p.person_id=$1 and p.family_id=$2 and p.person_type='CHILD' and exists(select 1 from consents c where c.family_id=p.family_id and c.subject_person_id=p.person_id and c.purpose='SERVICE' and c.status='GRANTED') limit 1`, [subjectPersonId, familyId]);
    if ((result.rowCount ?? 0) !== 1) throw new ForbiddenException('growth_camp_subject_or_consent_unavailable');
  }

  private requireMeta(meta: MutationMeta) {
    if (!meta.idempotencyKey?.trim()) throw new BadRequestException('idempotency_key_required');
    if (meta.idempotencyKey.length > 128) throw new BadRequestException('idempotency_key_too_long');
  }
  private async lockOperation(client: pg.PoolClient, tenantId: string, familyId: string, action: CampAction, key: string) { await client.query(`select pg_advisory_xact_lock(hashtextextended($1,0))`, [`${tenantId}:${familyId}:${action}:${key}`]); }
  private async loadReplay(client: pg.PoolClient, tenantId: string, familyId: string, action: CampAction, key: string, requestHash: string): Promise<GrowthCampMutationReceipt | null> {
    const result = await client.query<{ request_hash: string; response_body: GrowthCampMutationReceipt }>(`select request_hash,response_body from family_growth_camp_operations where tenant_id=$1 and family_id=$2 and action_name=$3 and idempotency_key=$4`, [tenantId, familyId, action, key]);
    if (!result.rows[0]) return null;
    if (result.rows[0].request_hash !== requestHash) throw new ConflictException('idempotency_key_payload_mismatch');
    return { ...result.rows[0].response_body, replayed: true };
  }
  private async persistOperation(client: pg.PoolClient, tenantId: string, familyId: string, enrollmentId: string, actorId: string, action: CampAction, requestHash: string, receipt: GrowthCampMutationReceipt, meta: MutationMeta) {
    await client.query(`insert into family_growth_camp_operations(tenant_id,family_id,enrollment_id,action_name,actor_person_id,idempotency_key,request_hash,response_body,correlation_id) values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)`, [tenantId,familyId,enrollmentId,action,actorId,meta.idempotencyKey,requestHash,JSON.stringify(receipt),meta.correlationId]);
  }
  private async auditAndEmit(client: pg.PoolClient, familyId: string, actorId: string, enrollmentId: string, action: CampAction, eventName: string, receipt: GrowthCampMutationReceipt, meta: MutationMeta) {
    await client.query(`insert into audit_logs(family_id,actor_type,actor_id,action_name,resource_type,resource_id,correlation_id,idempotency_key,result,metadata) values ($1,'PERSON',$2,$3,'GROWTH_CAMP_ENROLLMENT',$4,$5,$6,'SUCCESS',$7::jsonb)`, [familyId,actorId,action,enrollmentId,meta.correlationId,meta.idempotencyKey,JSON.stringify({ source: meta.source, program_ref: receipt.enrollment.program_ref, program_version: receipt.enrollment.program_version, day_no: receipt.checkin?.day_no ?? null, boundary: receipt.boundary })]);
    await client.query(`insert into outbox_events(aggregate_type,aggregate_id,event_name,event_version,event_id,correlation_id,payload,occurred_at) values ('GROWTH_CAMP_ENROLLMENT',$1,$2,1,$3,$4,$5::jsonb,now())`, [enrollmentId,eventName,randomUUID(),meta.correlationId,JSON.stringify({ family_id: familyId, enrollment_id: enrollmentId, status: receipt.enrollment.status, current_day: receipt.enrollment.current_day, day_no: receipt.checkin?.day_no ?? null, boundary: receipt.boundary })]);
  }
}

function mapEnrollment(row: any): GrowthCampEnrollmentDto { return { enrollment_id: row.enrollment_id, family_id: row.family_id, subject_person_id: row.subject_person_id, program_ref: 'PARENT_GROWTH_21', program_version: row.program_version, status: row.status, current_day: row.current_day, started_at: new Date(row.started_at).toISOString(), completed_at: row.completed_at ? new Date(row.completed_at).toISOString() : null, row_version: row.row_version }; }
function mapCheckin(row: any): GrowthCampDayCheckinDto { return { checkin_id: row.checkin_id, enrollment_id: row.enrollment_id, day_no: row.day_no, completion_status: row.completion_status, reflection: row.reflection, reflection_boundary: 'PARENT_REFLECTION_NOT_CHILD_FACT_OR_OUTCOME', occurred_at: new Date(row.occurred_at).toISOString() }; }
function hashRequest(value: unknown) { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function isUuid(value: string) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
