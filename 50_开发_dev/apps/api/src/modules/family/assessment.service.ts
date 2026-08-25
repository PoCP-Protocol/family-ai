import { createHash, randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  AssessmentMutationReceipt,
  AssessmentResponseDto,
  AssessmentResponseType,
  AssessmentSessionDto,
  SaveAssessmentResponseRequest,
  StartAssessmentRequest,
  Ui02AssessmentProjection,
  Ui02AssessmentTool,
} from '@family/contracts';
import type pg from 'pg';
import { FamilyRepository } from './family.repository';
import { assertFamilyManagePermission } from './family-permission';

type ActionName = AssessmentMutationReceipt['action'];
type MutationMeta = { correlationId: string; idempotencyKey: string; source: string };

@Injectable()
export class AssessmentService {
  constructor(@Inject(FamilyRepository) private readonly repository: FamilyRepository) {}

  async getProjection(familyId: string, tenantId: string, actorId: string): Promise<Ui02AssessmentProjection> {
    return this.repository.withTransaction(async (client) => {
      await this.assertScope(client, familyId, tenantId, actorId);
      const policy = await client.query<{ allowed_pages: string[] | null }>(
        `select allowed_pages from tenant_policy_profiles
          where tenant_id=$1 and status='ACTIVE' order by created_at desc limit 1`,
        [tenantId],
      );
      const subjects = await client.query<{ person_id: string; display_name: string; consent_granted: boolean }>(
        `select p.person_id, p.display_name,
                exists(select 1 from consents c where c.family_id=p.family_id
                  and c.subject_person_id=p.person_id and c.purpose='ASSESSMENT' and c.status='GRANTED') consent_granted
           from persons p
          where p.family_id=$1 and p.person_type='CHILD'
          order by p.created_at, p.person_id`,
        [familyId],
      );
      const tool = await this.loadActiveTool(client);
      const sessionRows = await client.query<{ assessment_session_id: string }>(
        `select assessment_session_id from family_assessment_sessions
          where tenant_id=$1 and family_id=$2
            and exists (
              select 1 from consents c
               where c.family_id=family_assessment_sessions.family_id
                 and c.subject_person_id=family_assessment_sessions.subject_person_id
                 and c.purpose='ASSESSMENT' and c.status='GRANTED'
            )
          order by updated_at desc, assessment_session_id desc limit 10`,
        [tenantId, familyId],
      );
      const sessions: AssessmentSessionDto[] = [];
      for (const row of sessionRows.rows) sessions.push(await this.loadSession(client, familyId, row.assessment_session_id));
      const mappedSubjects = subjects.rows.map((subject) => ({
        person_id: subject.person_id,
        display_name: subject.display_name,
        availability: subject.consent_granted ? 'AVAILABLE' as const : 'CONSENT_REQUIRED' as const,
      }));
      const policyAllows = (policy.rows[0]?.allowed_pages ?? []).includes('UI-02');
      return {
        projection_version: 'UI02_FAMILY_ASSESSMENT_V1', tenant_id: tenantId, family_id: familyId,
        availability: !policyAllows ? 'POLICY_BLOCKED' : mappedSubjects.some((subject) => subject.availability === 'AVAILABLE')
          ? 'AVAILABLE' : mappedSubjects.length > 0 ? 'CONSENT_REQUIRED' : 'NO_SUBJECT',
        subjects: mappedSubjects, tool, sessions,
        named_actions: { start: 'START_ASSESSMENT', save_response: 'SAVE_ASSESSMENT_RESPONSE', submit: 'SUBMIT_ASSESSMENT' },
      };
    });
  }

  async start(familyId: string, tenantId: string, actorId: string, request: StartAssessmentRequest, meta: MutationMeta): Promise<AssessmentMutationReceipt> {
    this.requireMutationMeta(meta);
    if (!isUuid(request.subject_person_id)) throw new BadRequestException('valid_subject_person_id_required');
    const toolRef = request.tool_ref?.trim() || 'FAMILY_SUPPORT_NEEDS';
    const requestHash = hashRequest({ subject_person_id: request.subject_person_id, tool_ref: toolRef });
    return this.repository.withTransaction(async (client) => {
      await this.lockOperation(client, tenantId, familyId, 'START_ASSESSMENT', meta.idempotencyKey);
      const replay = await this.loadOperationReplay(client, tenantId, familyId, 'START_ASSESSMENT', meta.idempotencyKey, requestHash);
      if (replay) return replay;
      await this.assertScope(client, familyId, tenantId, actorId);
      await this.assertSubjectConsent(client, familyId, request.subject_person_id);
      const tool = await this.loadActiveTool(client, toolRef);
      if (!tool) throw new NotFoundException('active_assessment_tool_not_found');
      const current = await client.query<{ assessment_session_id: string }>(
        `select assessment_session_id from family_assessment_sessions
          where tenant_id=$1 and family_id=$2 and subject_person_id=$3
            and tool_ref=$4 and tool_version=$5 and status='IN_PROGRESS'
          order by updated_at desc limit 1 for update`,
        [tenantId, familyId, request.subject_person_id, tool.tool_ref, tool.version_no],
      );
      const sessionId = current.rows[0]?.assessment_session_id ?? (await client.query<{ assessment_session_id: string }>(
        `insert into family_assessment_sessions(tenant_id,family_id,subject_person_id,tool_ref,tool_version,started_by_person_id)
         values ($1,$2,$3,$4,$5,$6) returning assessment_session_id`,
        [tenantId, familyId, request.subject_person_id, tool.tool_ref, tool.version_no, actorId],
      )).rows[0].assessment_session_id;
      const receipt: AssessmentMutationReceipt = { action: 'START_ASSESSMENT', replayed: false, session: await this.loadSession(client, familyId, sessionId), boundary: 'FAMILY_PERSPECTIVE_NOT_SCORE_OR_DIAGNOSIS' };
      await this.persistOperation(client, tenantId, familyId, sessionId, actorId, 'START_ASSESSMENT', requestHash, receipt, meta);
      await this.auditAndEmit(client, familyId, actorId, sessionId, 'START_ASSESSMENT', 'AssessmentSessionStarted', receipt, meta);
      return receipt;
    });
  }

  async saveResponse(familyId: string, tenantId: string, actorId: string, sessionId: string, request: SaveAssessmentResponseRequest, meta: MutationMeta): Promise<AssessmentMutationReceipt> {
    this.requireMutationMeta(meta);
    if (!isUuid(sessionId)) throw new BadRequestException('valid_assessment_session_id_required');
    const itemRef = request.item_ref?.trim();
    if (!itemRef || !['SINGLE_CHOICE', 'TEXT', 'BOOLEAN'].includes(request.response_type)) throw new BadRequestException('valid_assessment_response_required');
    const requestHash = hashRequest({ session_id: sessionId, item_ref: itemRef, response_type: request.response_type, response_value: request.response_value });
    return this.repository.withTransaction(async (client) => {
      await this.lockOperation(client, tenantId, familyId, 'SAVE_ASSESSMENT_RESPONSE', meta.idempotencyKey);
      const replay = await this.loadOperationReplay(client, tenantId, familyId, 'SAVE_ASSESSMENT_RESPONSE', meta.idempotencyKey, requestHash);
      if (replay) return replay;
      await this.assertScope(client, familyId, tenantId, actorId);
      const session = await this.loadSessionRowForUpdate(client, familyId, tenantId, sessionId);
      if (session.status !== 'IN_PROGRESS') throw new ConflictException('submitted_assessment_is_immutable');
      await this.assertSubjectConsent(client, familyId, session.subject_person_id);
      const tool = await this.loadTool(client, session.tool_ref, session.tool_version);
      const item = tool.items.find((candidate) => candidate.item_ref === itemRef);
      if (!item || item.response_type !== request.response_type) throw new BadRequestException('assessment_item_contract_mismatch');
      this.assertResponseValue(item.response_type, item.options, request.response_value);
      const previous = await client.query<{ revision: number }>(
        `select revision from family_assessment_responses where assessment_session_id=$1 and item_ref=$2 and is_current=true for update`,
        [sessionId, itemRef],
      );
      await client.query(`update family_assessment_responses set is_current=false,superseded_at=now() where assessment_session_id=$1 and item_ref=$2 and is_current=true`, [sessionId, itemRef]);
      await client.query(
        `insert into family_assessment_responses(assessment_session_id,item_ref,response_type,response_value,author_person_id,revision)
         values ($1,$2,$3,$4::jsonb,$5,$6)`,
        [sessionId, itemRef, request.response_type, JSON.stringify(request.response_value), actorId, (previous.rows[0]?.revision ?? 0) + 1],
      );
      await client.query(`update family_assessment_sessions set row_version=row_version+1,updated_at=now() where assessment_session_id=$1`, [sessionId]);
      const receipt: AssessmentMutationReceipt = { action: 'SAVE_ASSESSMENT_RESPONSE', replayed: false, session: await this.loadSession(client, familyId, sessionId), boundary: 'FAMILY_PERSPECTIVE_NOT_SCORE_OR_DIAGNOSIS' };
      await this.persistOperation(client, tenantId, familyId, sessionId, actorId, 'SAVE_ASSESSMENT_RESPONSE', requestHash, receipt, meta);
      await this.auditAndEmit(client, familyId, actorId, sessionId, 'SAVE_ASSESSMENT_RESPONSE', 'AssessmentResponseSaved', receipt, meta);
      return receipt;
    });
  }

  async submit(familyId: string, tenantId: string, actorId: string, sessionId: string, meta: MutationMeta): Promise<AssessmentMutationReceipt> {
    this.requireMutationMeta(meta);
    if (!isUuid(sessionId)) throw new BadRequestException('valid_assessment_session_id_required');
    const requestHash = hashRequest({ session_id: sessionId });
    return this.repository.withTransaction(async (client) => {
      await this.lockOperation(client, tenantId, familyId, 'SUBMIT_ASSESSMENT', meta.idempotencyKey);
      const replay = await this.loadOperationReplay(client, tenantId, familyId, 'SUBMIT_ASSESSMENT', meta.idempotencyKey, requestHash);
      if (replay) return replay;
      await this.assertScope(client, familyId, tenantId, actorId);
      const session = await this.loadSessionRowForUpdate(client, familyId, tenantId, sessionId);
      if (session.status !== 'IN_PROGRESS') throw new ConflictException('assessment_session_not_editable');
      await this.assertSubjectConsent(client, familyId, session.subject_person_id);
      const tool = await this.loadTool(client, session.tool_ref, session.tool_version);
      const responses = await this.loadResponses(client, sessionId);
      const answered = new Set(responses.map((response) => response.item_ref));
      const missing = tool.items.filter((item) => item.required && !answered.has(item.item_ref)).map((item) => item.item_ref);
      if (missing.length > 0) throw new BadRequestException({ code: 'required_assessment_responses_missing', missing_items: missing });
      await client.query(`update family_assessment_sessions set status='SUBMITTED',submitted_at=now(),row_version=row_version+1,updated_at=now() where assessment_session_id=$1`, [sessionId]);
      const evidence = await client.query<{ evidence_id: string }>(
        `insert into evidence_records(family_id,evidence_type,source_ref,payload,observed_at,source,evidence_level)
         values ($1,'ASSESSMENT_RESPONSE_SET',$2,$3::jsonb,now(),'PARENT','E1') returning evidence_id`,
        [familyId, sessionId, JSON.stringify({ assessment_session_id: sessionId, tool_ref: session.tool_ref, tool_version: session.tool_version, response_refs: responses.map((response) => response.assessment_response_id), truth_class: 'FAMILY_PERSPECTIVE', not_a_score: true, not_a_diagnosis: true })],
      );
      const receipt: AssessmentMutationReceipt = { action: 'SUBMIT_ASSESSMENT', replayed: false, session: await this.loadSession(client, familyId, sessionId), evidence_id: evidence.rows[0].evidence_id, boundary: 'FAMILY_PERSPECTIVE_NOT_SCORE_OR_DIAGNOSIS' };
      await this.persistOperation(client, tenantId, familyId, sessionId, actorId, 'SUBMIT_ASSESSMENT', requestHash, receipt, meta);
      await this.auditAndEmit(client, familyId, actorId, sessionId, 'SUBMIT_ASSESSMENT', 'AssessmentSessionSubmitted', receipt, meta);
      return receipt;
    });
  }

  private async assertScope(client: pg.PoolClient, familyId: string, tenantId: string, actorId: string) {
    const binding = await client.query(`select 1 from tenant_family_bindings where tenant_id=$1 and family_id=$2 and status='ACTIVE' and effective_from<=now() and (effective_to is null or effective_to>now()) limit 1`, [tenantId, familyId]);
    if ((binding.rowCount ?? 0) !== 1) throw new ForbiddenException('tenant_family_scope_denied');
    await assertFamilyManagePermission(client, familyId, actorId);
  }

  private async assertSubjectConsent(client: pg.PoolClient, familyId: string, subjectPersonId: string) {
    const subject = await client.query(`select 1 from persons p where p.person_id=$1 and p.family_id=$2 and p.person_type='CHILD' and exists(select 1 from consents c where c.family_id=p.family_id and c.subject_person_id=p.person_id and c.purpose='ASSESSMENT' and c.status='GRANTED') limit 1`, [subjectPersonId, familyId]);
    if ((subject.rowCount ?? 0) !== 1) throw new ForbiddenException('assessment_subject_or_consent_unavailable');
  }

  private async loadActiveTool(client: pg.PoolClient, toolRef = 'FAMILY_SUPPORT_NEEDS'): Promise<Ui02AssessmentTool | null> {
    const result = await client.query<any>(`select tool_ref,version_no,title,purpose,evidence_level,schema_ref,item_schema,boundary from family_assessment_tools where tool_ref=$1 and status='ACTIVE' and admission_status='ADMITTED' and effective_from<=now() and (effective_to is null or effective_to>now()) order by version_no desc limit 1`, [toolRef]);
    return result.rows[0] ? mapTool(result.rows[0]) : null;
  }

  private async loadTool(client: pg.PoolClient, toolRef: string, version: number): Promise<Ui02AssessmentTool> {
    const result = await client.query<any>(`select tool_ref,version_no,title,purpose,evidence_level,schema_ref,item_schema,boundary from family_assessment_tools where tool_ref=$1 and version_no=$2`, [toolRef, version]);
    if (!result.rows[0]) throw new NotFoundException('assessment_tool_version_not_found');
    return mapTool(result.rows[0]);
  }

  private async loadSessionRowForUpdate(client: pg.PoolClient, familyId: string, tenantId: string, sessionId: string) {
    const result = await client.query<{ status: string; subject_person_id: string; tool_ref: string; tool_version: number }>(`select status,subject_person_id,tool_ref,tool_version from family_assessment_sessions where assessment_session_id=$1 and family_id=$2 and tenant_id=$3 for update`, [sessionId, familyId, tenantId]);
    if (!result.rows[0]) throw new NotFoundException('assessment_session_not_found');
    return result.rows[0];
  }

  private async loadSession(client: pg.PoolClient, familyId: string, sessionId: string): Promise<AssessmentSessionDto> {
    const result = await client.query<Omit<AssessmentSessionDto, 'responses'>>(`select assessment_session_id,family_id,subject_person_id,tool_ref,tool_version,status,started_at,submitted_at,row_version from family_assessment_sessions where assessment_session_id=$1 and family_id=$2`, [sessionId, familyId]);
    if (!result.rows[0]) throw new NotFoundException('assessment_session_not_found');
    return { ...result.rows[0], responses: await this.loadResponses(client, sessionId) };
  }

  private async loadResponses(client: pg.PoolClient, sessionId: string): Promise<AssessmentResponseDto[]> {
    return (await client.query<AssessmentResponseDto>(`select assessment_response_id,item_ref,response_type,response_value,revision,captured_at,visibility from family_assessment_responses where assessment_session_id=$1 and is_current=true order by captured_at,assessment_response_id`, [sessionId])).rows;
  }

  private assertResponseValue(type: AssessmentResponseType, options: string[] | undefined, value: string | boolean) {
    if (type === 'BOOLEAN' && typeof value !== 'boolean') throw new BadRequestException('assessment_boolean_response_required');
    if ((type === 'SINGLE_CHOICE' || type === 'TEXT') && typeof value !== 'string') throw new BadRequestException('assessment_text_response_required');
    if (type === 'TEXT' && typeof value === 'string' && (value.trim().length === 0 || value.length > 500)) throw new BadRequestException('assessment_text_response_invalid');
    if (type === 'SINGLE_CHOICE' && (!options || !options.includes(String(value)))) throw new BadRequestException('assessment_choice_not_in_tool_version');
  }

  private requireMutationMeta(meta: MutationMeta) {
    if (!meta.idempotencyKey?.trim()) throw new BadRequestException('idempotency_key_required');
    if (meta.idempotencyKey.length > 128) throw new BadRequestException('idempotency_key_too_long');
  }

  private async lockOperation(client: pg.PoolClient, tenantId: string, familyId: string, action: ActionName, key: string) {
    await client.query(`select pg_advisory_xact_lock(hashtextextended($1,0))`, [`${tenantId}:${familyId}:${action}:${key}`]);
  }

  private async loadOperationReplay(client: pg.PoolClient, tenantId: string, familyId: string, action: ActionName, key: string, requestHash: string): Promise<AssessmentMutationReceipt | null> {
    const result = await client.query<{ request_hash: string; response_body: AssessmentMutationReceipt }>(`select request_hash,response_body from family_assessment_operations where tenant_id=$1 and family_id=$2 and action_name=$3 and idempotency_key=$4`, [tenantId, familyId, action, key]);
    if (!result.rows[0]) return null;
    if (result.rows[0].request_hash !== requestHash) throw new ConflictException('idempotency_key_payload_mismatch');
    return { ...result.rows[0].response_body, replayed: true };
  }

  private async persistOperation(client: pg.PoolClient, tenantId: string, familyId: string, sessionId: string, actorId: string, action: ActionName, requestHash: string, receipt: AssessmentMutationReceipt, meta: MutationMeta) {
    await client.query(`insert into family_assessment_operations(tenant_id,family_id,assessment_session_id,action_name,actor_person_id,idempotency_key,request_hash,response_body,correlation_id) values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)`, [tenantId, familyId, sessionId, action, actorId, meta.idempotencyKey, requestHash, JSON.stringify(receipt), meta.correlationId]);
  }

  private async auditAndEmit(client: pg.PoolClient, familyId: string, actorId: string, sessionId: string, action: ActionName, eventName: string, receipt: AssessmentMutationReceipt, meta: MutationMeta) {
    await client.query(`insert into audit_logs(family_id,actor_type,actor_id,action_name,resource_type,resource_id,correlation_id,idempotency_key,result,metadata) values ($1,'PERSON',$2,$3,'ASSESSMENT_SESSION',$4,$5,$6,'SUCCESS',$7::jsonb)`, [familyId, actorId, action, sessionId, meta.correlationId, meta.idempotencyKey, JSON.stringify({ source: meta.source, tool_ref: receipt.session.tool_ref, tool_version: receipt.session.tool_version, boundary: receipt.boundary })]);
    await client.query(`insert into outbox_events(aggregate_type,aggregate_id,event_name,event_version,event_id,correlation_id,payload,occurred_at) values ('ASSESSMENT_SESSION',$1,$2,1,$3,$4,$5::jsonb,now())`, [sessionId, eventName, randomUUID(), meta.correlationId, JSON.stringify({ family_id: familyId, assessment_session_id: sessionId, status: receipt.session.status, tool_ref: receipt.session.tool_ref, tool_version: receipt.session.tool_version, evidence_id: receipt.evidence_id ?? null, boundary: receipt.boundary })]);
  }
}

function mapTool(row: any): Ui02AssessmentTool {
  return { tool_ref: row.tool_ref, version_no: row.version_no, title: row.title, purpose: row.purpose, evidence_level: row.evidence_level, schema_ref: row.schema_ref, items: row.item_schema.items, boundary: row.boundary };
}

function hashRequest(value: unknown) { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function isUuid(value: string) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
