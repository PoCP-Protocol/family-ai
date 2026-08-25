import { createHash, randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { GrowthHypothesisDecisionReceipt, GrowthHypothesisGenerationReceipt, Ui03GrowthHypothesis, Ui03GrowthHypothesisProjection } from '@family/contracts';
import type { FamilyAssessmentAiSubsystemOutput, FamilyModelUi02AssessmentResponseSetInput } from '@family/family-model';
import { PRINCIPAL_SOUL_PROFILE } from '@family/principal-ai';
import type pg from 'pg';
import { FamilyRepository } from './family.repository';
import { assertFamilyManagePermission } from './family-permission';
import { FamilyAssessmentModelProvider } from '../model/family-assessment-model.provider';

type DecisionType = 'CONFIRM' | 'DISMISS';
type DecisionMeta = { correlationId: string; idempotencyKey: string; source: string };
type GrowthIntentReceipt = NonNullable<GrowthHypothesisDecisionReceipt['intent']>;

type HypothesisRow = {
  assessment_session_id: string;
  subject_person_id: string;
  subject_display_name: string;
  submitted_at: string | null;
  tool_ref: string;
  tool_version: number;
  assessment_response_id: string;
  focus_ref: string;
  assessment_evidence_id: string;
  need_type_ref: string;
  need_type_version: number;
  title: string;
  description: string;
  required_capability_keys: string[];
  response_set: Array<{ item_ref: string; response_type: 'SINGLE_CHOICE' | 'TEXT' | 'BOOLEAN'; response_value: string | boolean }>;
};

type AssessmentAiRun = {
  runId: string;
  output: FamilyAssessmentAiSubsystemOutput;
};

type PersistedHypothesisRow = {
  assessment_session_id: string;
  subject_person_id: string;
  hypothesis_ref: string;
  status: 'PROPOSED' | 'ACKNOWLEDGED' | 'DISMISSED' | 'SUPERSEDED';
  evidence_refs: string[];
  hypothesis_body: Ui03GrowthHypothesis;
};

@Injectable()
export class GrowthHypothesisService {
  constructor(
    @Inject(FamilyRepository) private readonly repository: FamilyRepository,
    @Inject(FamilyAssessmentModelProvider) private readonly assessmentModel: FamilyAssessmentModelProvider,
  ) {}

  async getProjection(familyId: string, tenantId: string, actorId: string): Promise<Ui03GrowthHypothesisProjection> {
    return this.repository.withTransaction(async (client) => {
      await this.assertScope(client, familyId, tenantId, actorId);
      const policy = await client.query<{ allowed_pages: string[] | null }>(`select allowed_pages from tenant_policy_profiles where tenant_id=$1 and status='ACTIVE' order by created_at desc limit 1`, [tenantId]);
      if (!(policy.rows[0]?.allowed_pages ?? []).includes('UI-03')) return projection(tenantId, familyId, 'POLICY_BLOCKED', null);
      const persisted = await this.loadPersistedHypothesis(client, familyId, tenantId);
      if (persisted) return projection(tenantId, familyId, availabilityFromStatus(persisted.status), persisted.hypothesis_body, 'READ_ONLY_PERSISTED', persisted.assessment_session_id);
      const state = await this.loadLatestAssessmentState(client, familyId, tenantId);
      if (state) return projection(tenantId, familyId, state.status, null, 'NOT_INVOKED', state.assessment_session_id);
      return projection(tenantId, familyId, 'NO_SUBMITTED_ASSESSMENT', null);
    });
  }

  async generate(familyId: string, tenantId: string, actorId: string, sessionId: string, meta: DecisionMeta): Promise<GrowthHypothesisGenerationReceipt> {
    if (!meta.idempotencyKey?.trim()) throw new BadRequestException('idempotency_key_required');
    if (!isUuid(sessionId)) throw new BadRequestException('valid_assessment_session_id_required');
    const requestHash = hashRequest({ assessment_session_id: sessionId });
    const prepared: { replay: GrowthHypothesisGenerationReceipt } | { row: HypothesisRow } = await this.repository.withTransaction(async (client) => {
      await client.query(`select pg_advisory_xact_lock(hashtextextended($1,0))`, [`${tenantId}:${familyId}:GENERATE_GROWTH_HYPOTHESIS:${meta.idempotencyKey}`]);
      const replay = await this.loadGenerationReplay(client, tenantId, familyId, meta.idempotencyKey, requestHash);
      if (replay) return { replay };
      await this.assertScope(client, familyId, tenantId, actorId);
      const existing = await this.loadPersistedHypothesis(client, familyId, tenantId, sessionId);
      if (existing) {
        const receipt = generationReceipt(existing.assessment_session_id, existing.hypothesis_ref, 'HYPOTHESIS_REUSED', false);
        await this.persistAssessmentOperation(client, tenantId, familyId, sessionId, actorId, 'GENERATE_GROWTH_HYPOTHESIS', requestHash, receipt, meta);
        return { replay: receipt };
      }
      const row = await this.loadHypothesisRow(client, familyId, tenantId, sessionId, ['SUBMITTED', 'ANALYSIS_FAILED']);
      if (!row) throw new NotFoundException('submitted_assessment_not_found');
      await this.assertAssessmentConsent(client, familyId, row.subject_person_id);
      await client.query(`update family_assessment_sessions set status='ANALYZING',row_version=row_version+1,updated_at=now() where assessment_session_id=$1 and status in ('SUBMITTED','ANALYSIS_FAILED')`, [sessionId]);
      return { row };
    });
    if ('replay' in prepared) return prepared.replay;

    const input = this.buildAssessmentSubsystemInput(familyId, prepared.row);
    let output: FamilyAssessmentAiSubsystemOutput;
    try {
      output = await this.assessmentModel.generateAssessmentSubsystemOutput(input);
    } catch (error) {
      await this.markAnalysisFailed(tenantId, familyId, sessionId, meta, error);
      throw error;
    }

    return this.repository.withTransaction(async (client) => {
      await client.query(`select pg_advisory_xact_lock(hashtextextended($1,0))`, [`${tenantId}:${familyId}:GENERATE_GROWTH_HYPOTHESIS:${meta.idempotencyKey}`]);
      const replay = await this.loadGenerationReplay(client, tenantId, familyId, meta.idempotencyKey, requestHash);
      if (replay) return replay;
      await this.assertScope(client, familyId, tenantId, actorId);
      const row = await this.loadHypothesisRow(client, familyId, tenantId, sessionId, ['ANALYZING', 'SUBMITTED', 'ANALYSIS_FAILED']);
      if (!row) throw new NotFoundException('submitted_assessment_not_found');
      await this.assertAssessmentConsent(client, familyId, row.subject_person_id);
      const assessmentRun = await this.persistAssessmentSubsystemOutput(client, tenantId, familyId, row, input, output);
      const hypothesis = mapHypothesis(row, assessmentRun);
      const existing = await this.loadPersistedHypothesis(client, familyId, tenantId, sessionId);
      await this.persistGrowthHypothesis(client, tenantId, familyId, row, hypothesis, assessmentRun, output);
      await client.query(`update family_assessment_sessions set status='READY',row_version=row_version+1,updated_at=now() where assessment_session_id=$1 and status in ('ANALYZING','SUBMITTED','ANALYSIS_FAILED')`, [sessionId]);
      const receipt = generationReceipt(sessionId, hypothesis.hypothesis_ref, existing ? 'HYPOTHESIS_REUSED' : 'HYPOTHESIS_CREATED', false);
      await this.persistAssessmentOperation(client, tenantId, familyId, sessionId, actorId, 'GENERATE_GROWTH_HYPOTHESIS', requestHash, receipt, meta);
      await this.auditAndEmitGeneration(client, familyId, actorId, sessionId, hypothesis, receipt, meta);
      return receipt;
    });
  }

  async decide(familyId: string, tenantId: string, actorId: string, input: { assessment_session_id: string; hypothesis_ref: string; decision_type: DecisionType }, meta: DecisionMeta): Promise<GrowthHypothesisDecisionReceipt> {
    if (!meta.idempotencyKey?.trim()) throw new BadRequestException('idempotency_key_required');
    if (!isUuid(input.assessment_session_id) || !input.hypothesis_ref?.trim() || !['CONFIRM', 'DISMISS'].includes(input.decision_type)) throw new BadRequestException('valid_hypothesis_decision_required');
    const action = input.decision_type === 'CONFIRM' ? 'CONFIRM_GROWTH_HYPOTHESIS' : 'DISMISS_GROWTH_HYPOTHESIS';
    const requestHash = hashRequest(input);
    return this.repository.withTransaction(async (client) => {
      await client.query(`select pg_advisory_xact_lock(hashtextextended($1,0))`, [`${tenantId}:${familyId}:${input.hypothesis_ref}`]);
      const replay = await client.query<{ request_hash: string; response_body: GrowthHypothesisDecisionReceipt }>(
        `select request_hash,response_body from family_growth_hypothesis_decisions where tenant_id=$1 and family_id=$2 and decision_type=$3 and idempotency_key=$4`,
        [tenantId, familyId, input.decision_type, meta.idempotencyKey],
      );
      if (replay.rows[0]) {
        if (replay.rows[0].request_hash !== requestHash) throw new ConflictException('idempotency_key_payload_mismatch');
        return { ...replay.rows[0].response_body, replayed: true };
      }
      await this.assertScope(client, familyId, tenantId, actorId);
      const row = await this.loadHypothesisRow(client, familyId, tenantId, input.assessment_session_id, ['READY', 'ACKNOWLEDGED']);
      if (!row) throw new NotFoundException('growth_hypothesis_not_found');
      const persisted = await this.loadPersistedHypothesis(client, familyId, tenantId, input.assessment_session_id);
      if (!persisted) throw new NotFoundException('growth_hypothesis_not_found');
      const hypothesis = persisted.hypothesis_body;
      if (hypothesis.hypothesis_ref !== input.hypothesis_ref) throw new ConflictException('growth_hypothesis_reference_mismatch');
      await this.assertAssessmentConsent(client, familyId, row.subject_person_id);
      if (hypothesis.safety_gate?.required) throw new ForbiddenException('human_review_required_for_high_risk_assessment');

      let intent: GrowthHypothesisDecisionReceipt['intent'] = null;
      if (input.decision_type === 'CONFIRM') {
        const existing = await client.query<GrowthIntentReceipt>(
          `select intent_id,need_type,status,required_capability_keys,evidence_refs,boundary from growth_intents where family_id=$1 and source_type='ASSESSMENT_HYPOTHESIS' and source_ref=$2 limit 1 for update`,
          [familyId, hypothesis.hypothesis_ref],
        );
        intent = existing.rows[0] ?? (await client.query<GrowthIntentReceipt>(
          `insert into growth_intents(family_id,subject_person_id,signal_ref,need_type,goal_text,required_capability_keys,status,confirmed_by,source_type,source_ref,evidence_refs,boundary)
           values ($1,$2,null,$3,$4,$5,'OPEN',$6,'ASSESSMENT_HYPOTHESIS',$7,$8,'HUMAN_CONFIRMED_INTENT_NOT_OUTCOME')
           returning intent_id,need_type,status,required_capability_keys,evidence_refs,boundary`,
          [familyId, row.subject_person_id, row.need_type_ref, row.description, row.required_capability_keys, actorId, hypothesis.hypothesis_ref, [row.assessment_evidence_id]],
        )).rows[0];
      }
      const receipt: GrowthHypothesisDecisionReceipt = {
        action,
        outcome: input.decision_type === 'CONFIRM' ? 'INTENT_CREATED' : 'NO_ACTION',
        hypothesis_ref: hypothesis.hypothesis_ref,
        intent,
        replayed: false,
      };
      await client.query(
        `insert into family_growth_hypothesis_decisions(tenant_id,family_id,assessment_session_id,hypothesis_ref,decision_type,actor_person_id,intent_id,idempotency_key,request_hash,response_body,correlation_id)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11)`,
        [tenantId, familyId, row.assessment_session_id, hypothesis.hypothesis_ref, input.decision_type, actorId, intent?.intent_id ?? null, meta.idempotencyKey, requestHash, JSON.stringify(receipt), meta.correlationId],
      );
      await client.query(`update family_growth_hypotheses set status=$1,updated_at=now() where tenant_id=$2 and family_id=$3 and hypothesis_ref=$4`, [input.decision_type === 'CONFIRM' ? 'ACKNOWLEDGED' : 'DISMISSED', tenantId, familyId, hypothesis.hypothesis_ref]);
      if (input.decision_type === 'CONFIRM') await client.query(`update family_assessment_sessions set status='ACKNOWLEDGED',row_version=row_version+1,updated_at=now() where assessment_session_id=$1 and status='READY'`, [row.assessment_session_id]);
      await client.query(
        `insert into audit_logs(family_id,actor_type,actor_id,action_name,resource_type,resource_id,correlation_id,idempotency_key,result,metadata)
         values ($1,'PERSON',$2,$3,'GROWTH_HYPOTHESIS',$4,$5,$6,'SUCCESS',$7::jsonb)`,
        [familyId, actorId, action, hypothesis.hypothesis_ref, meta.correlationId, meta.idempotencyKey, JSON.stringify({ source: meta.source, assessment_session_id: row.assessment_session_id, evidence_ref: row.assessment_evidence_id, boundary: hypothesis.fact_boundary })],
      );
      await client.query(
        `insert into outbox_events(aggregate_type,aggregate_id,event_name,event_version,event_id,correlation_id,payload,occurred_at)
         values ('GROWTH_HYPOTHESIS',$1,$2,1,$3,$4,$5::jsonb,now())`,
        [hypothesis.hypothesis_ref, input.decision_type === 'CONFIRM' ? 'GrowthHypothesisConfirmed' : 'GrowthHypothesisDismissed', randomUUID(), meta.correlationId, JSON.stringify({ family_id: familyId, hypothesis_ref: hypothesis.hypothesis_ref, assessment_session_id: row.assessment_session_id, intent_id: intent?.intent_id ?? null, outcome: receipt.outcome, boundary: hypothesis.fact_boundary })],
      );
      return receipt;
    });
  }

  private async loadHypothesisRow(client: pg.PoolClient, familyId: string, tenantId: string, sessionId?: string, statuses: string[] = ['SUBMITTED']): Promise<HypothesisRow | null> {
    const result = await client.query<HypothesisRow>(
      `select s.assessment_session_id,s.subject_person_id,p.display_name subject_display_name,s.submitted_at,s.tool_ref,s.tool_version,
              r.assessment_response_id,r.response_value #>> '{}' focus_ref,e.evidence_id assessment_evidence_id,
              nt.need_type_ref,nt.version_no need_type_version,nt.title,nt.description,nt.required_capability_keys,
              jsonb_agg(jsonb_build_object('item_ref',ar.item_ref,'response_type',ar.response_type,'response_value',ar.response_value) order by ar.item_ref) response_set
         from family_assessment_sessions s
         join persons p on p.person_id=s.subject_person_id and p.family_id=s.family_id
         join family_assessment_responses r on r.assessment_session_id=s.assessment_session_id and r.item_ref='FOCUS' and r.is_current=true
         join family_assessment_responses ar on ar.assessment_session_id=s.assessment_session_id and ar.is_current=true
         join evidence_records e on e.family_id=s.family_id and e.source_ref=s.assessment_session_id::text and e.evidence_type='ASSESSMENT_RESPONSE_SET'
         join family_need_types nt on nt.source_focus_ref=(r.response_value #>> '{}') and nt.status='ACTIVE' and nt.admission_status='ADMITTED'
              and nt.effective_from<=now() and (nt.effective_to is null or nt.effective_to>now())
        where s.family_id=$1 and s.tenant_id=$2 and s.status=any($4::text[]) and ($3::uuid is null or s.assessment_session_id=$3)
        group by s.assessment_session_id,s.subject_person_id,p.display_name,s.submitted_at,s.tool_ref,s.tool_version,r.assessment_response_id,r.response_value,e.evidence_id,nt.need_type_ref,nt.version_no,nt.title,nt.description,nt.required_capability_keys
        order by s.submitted_at desc,nt.version_no desc,e.created_at desc limit 1`,
      [familyId, tenantId, sessionId ?? null, statuses],
    );
    return result.rows[0] ?? null;
  }

  private async loadPersistedHypothesis(client: pg.PoolClient, familyId: string, tenantId: string, sessionId?: string): Promise<PersistedHypothesisRow | null> {
    const result = await client.query<PersistedHypothesisRow>(
      `select assessment_session_id,subject_person_id,hypothesis_ref,status,evidence_refs,hypothesis_body
         from family_growth_hypotheses
        where tenant_id=$1 and family_id=$2 and ($3::uuid is null or assessment_session_id=$3)
        order by updated_at desc,created_at desc limit 1`,
      [tenantId, familyId, sessionId ?? null],
    );
    return result.rows[0] ?? null;
  }

  private async loadLatestAssessmentState(client: pg.PoolClient, familyId: string, tenantId: string): Promise<{ status: 'SUBMITTED' | 'ANALYZING' | 'ANALYSIS_FAILED'; assessment_session_id: string } | null> {
    const result = await client.query<{ status: string; assessment_session_id: string }>(
      `select status,assessment_session_id from family_assessment_sessions
        where tenant_id=$1 and family_id=$2 and status in ('SUBMITTED','ANALYZING','READY','ACKNOWLEDGED','ANALYSIS_FAILED')
        order by updated_at desc,assessment_session_id desc limit 1`,
      [tenantId, familyId],
    );
    const status = result.rows[0]?.status;
    if (status === 'SUBMITTED' || status === 'ANALYZING' || status === 'ANALYSIS_FAILED') return { status, assessment_session_id: result.rows[0].assessment_session_id };
    return null;
  }

  private async markAnalysisFailed(tenantId: string, familyId: string, sessionId: string, meta: DecisionMeta, error: unknown) {
    await this.repository.withTransaction(async (client) => {
      await client.query(`update family_assessment_sessions set status='ANALYSIS_FAILED',row_version=row_version+1,updated_at=now() where tenant_id=$1 and family_id=$2 and assessment_session_id=$3 and status='ANALYZING'`, [tenantId, familyId, sessionId]);
      await client.query(
        `insert into audit_logs(family_id,actor_type,actor_id,action_name,resource_type,resource_id,correlation_id,idempotency_key,result,metadata)
         values ($1,'SYSTEM',null,'GENERATE_GROWTH_HYPOTHESIS','ASSESSMENT_SESSION',$2,$3,$4,'FAILED',$5::jsonb)`,
        [familyId, sessionId, meta.correlationId, meta.idempotencyKey, JSON.stringify({ source: meta.source, error: error instanceof Error ? error.message : 'unknown_error' })],
      );
    });
  }

  private async persistAssessmentSubsystemOutput(client: pg.PoolClient, tenantId: string, familyId: string, row: HypothesisRow, input: FamilyModelUi02AssessmentResponseSetInput, output: FamilyAssessmentAiSubsystemOutput): Promise<AssessmentAiRun> {
    const existing = await client.query<{ assessment_ai_run_id: string; output_body: FamilyAssessmentAiSubsystemOutput }>(
      `select assessment_ai_run_id,output_body from family_assessment_ai_runs
        where tenant_id=$1 and family_id=$2 and assessment_session_id=$3 and service_depth='DEEP_AI_INTERPRETATION'
        order by created_at desc limit 1`,
      [tenantId, familyId, row.assessment_session_id],
    );
    if (existing.rows[0]) return { runId: existing.rows[0].assessment_ai_run_id, output: existing.rows[0].output_body };

    const inserted = await client.query<{ assessment_ai_run_id: string; output_body: FamilyAssessmentAiSubsystemOutput }>(
      `insert into family_assessment_ai_runs(
         tenant_id,family_id,assessment_session_id,assessment_evidence_id,subsystem_ref,subsystem_version,service_depth,
         request_id,model_provider,model_generator,model_component_ref,source_refs,input_hash,output_hash,output_body,
         state_upper_bound,boundary_labels,schema_validation
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14,$15::jsonb,'DERIVED_DRAFT_PRIVATE',$16,'valid')
       on conflict (tenant_id,family_id,assessment_session_id,service_depth) do update set output_body=family_assessment_ai_runs.output_body
       returning assessment_ai_run_id,output_body`,
      [
        tenantId,
        familyId,
        row.assessment_session_id,
        row.assessment_evidence_id,
        output.subsystem_ref,
        output.subsystem_version,
        output.service_depth,
        input.request_id,
        output.provenance.generator === 'FAMILY_EDUCATION_MODEL_RUNTIME_GATEWAY' ? 'gateway' : 'deterministic',
        output.provenance.generator,
        output.interpretation.draft.model_component_ref,
        JSON.stringify({ assessment_session_id: row.assessment_session_id, assessment_evidence_id: row.assessment_evidence_id, tool_ref: row.tool_ref, tool_version: row.tool_version }),
        hashRequest(input),
        hashRequest(output),
        JSON.stringify(output),
        output.interpretation.draft.boundary_labels ?? [],
      ],
    );
    return { runId: inserted.rows[0].assessment_ai_run_id, output: inserted.rows[0].output_body };
  }

  private async persistGrowthHypothesis(client: pg.PoolClient, tenantId: string, familyId: string, row: HypothesisRow, hypothesis: Ui03GrowthHypothesis, assessmentRun: AssessmentAiRun, output: FamilyAssessmentAiSubsystemOutput) {
    const modelDraft = output.interpretation;
    const confidence = modelDraft.draft.hypotheses[0]?.confidence ?? 'low';
    await client.query(
      `insert into family_growth_hypotheses(
         hypothesis_ref,tenant_id,family_id,subject_person_id,assessment_session_id,statement,explanation,confidence,source,
         evidence_refs,limitations,model_run_ref,model_component_ref,model_provider,model_name,skill_ref,skill_version,
         output_schema_version,output_hash,fact_boundary,status,hypothesis_body
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,'ASSESSMENT_AI_SUBSYSTEM',$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,
         'HYPOTHESIS_NOT_FACT_OR_DIAGNOSIS','PROPOSED',$19::jsonb)
       on conflict (tenant_id,family_id,assessment_session_id,skill_ref,skill_version,output_schema_version)
       do update set updated_at=family_growth_hypotheses.updated_at
       returning growth_hypothesis_id`,
      [
        hypothesis.hypothesis_ref,
        tenantId,
        familyId,
        row.subject_person_id,
        row.assessment_session_id,
        hypothesis.statement,
        hypothesis.principal?.reading ?? hypothesis.statement,
        confidence,
        [row.assessment_evidence_id],
        hypothesis.limitations,
        assessmentRun.runId,
        hypothesis.model_component_ref ?? null,
        hypothesis.model_generator === 'FAMILY_EDUCATION_MODEL_RUNTIME_GATEWAY' ? 'gateway' : 'deterministic',
        hypothesis.model_generator ?? 'FAMILY_EDUCATION_MODEL_RUNTIME_DETERMINISTIC',
        'FAMILY_GROWTH_HYPOTHESIS_UI03',
        'R1B',
        output.subsystem_version,
        hashRequest(output),
        JSON.stringify(hypothesis),
      ],
    );
  }

  private buildAssessmentSubsystemInput(familyId: string, row: HypothesisRow): FamilyModelUi02AssessmentResponseSetInput {
    return {
      request_id: `UI03:${row.assessment_session_id}`,
      assessment_session_id: row.assessment_session_id,
      tool_ref: row.tool_ref,
      tool_version: row.tool_version,
      family_context_ref: `FAMILY:${familyId}`,
      child_age_stage: 'UNKNOWN_OR_NOT_COLLECTED',
      responses: row.response_set,
    };
  }

  private async assertScope(client: pg.PoolClient, familyId: string, tenantId: string, actorId: string) {
    const binding = await client.query(`select 1 from tenant_family_bindings where tenant_id=$1 and family_id=$2 and status='ACTIVE' and effective_from<=now() and (effective_to is null or effective_to>now()) limit 1`, [tenantId, familyId]);
    if ((binding.rowCount ?? 0) !== 1) throw new ForbiddenException('tenant_family_scope_denied');
    await assertFamilyManagePermission(client, familyId, actorId);
  }

  private async assertAssessmentConsent(client: pg.PoolClient, familyId: string, subjectId: string) {
    const consent = await client.query(`select 1 from consents where family_id=$1 and subject_person_id=$2 and purpose='ASSESSMENT' and status='GRANTED' limit 1`, [familyId, subjectId]);
    if ((consent.rowCount ?? 0) !== 1) throw new ForbiddenException('assessment_consent_required');
  }

  private async loadGenerationReplay(client: pg.PoolClient, tenantId: string, familyId: string, key: string, requestHash: string): Promise<GrowthHypothesisGenerationReceipt | null> {
    const replay = await client.query<{ request_hash: string; response_body: GrowthHypothesisGenerationReceipt }>(
      `select request_hash,response_body from family_assessment_operations where tenant_id=$1 and family_id=$2 and action_name='GENERATE_GROWTH_HYPOTHESIS' and idempotency_key=$3`,
      [tenantId, familyId, key],
    );
    if (!replay.rows[0]) return null;
    if (replay.rows[0].request_hash !== requestHash) throw new ConflictException('idempotency_key_payload_mismatch');
    return { ...replay.rows[0].response_body, replayed: true };
  }

  private async persistAssessmentOperation(client: pg.PoolClient, tenantId: string, familyId: string, sessionId: string, actorId: string, actionName: string, requestHash: string, receipt: GrowthHypothesisGenerationReceipt, meta: DecisionMeta) {
    await client.query(
      `insert into family_assessment_operations(tenant_id,family_id,assessment_session_id,action_name,actor_person_id,idempotency_key,request_hash,response_body,correlation_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)`,
      [tenantId, familyId, sessionId, actionName, actorId, meta.idempotencyKey, requestHash, JSON.stringify(receipt), meta.correlationId],
    );
  }

  private async auditAndEmitGeneration(client: pg.PoolClient, familyId: string, actorId: string, sessionId: string, hypothesis: Ui03GrowthHypothesis, receipt: GrowthHypothesisGenerationReceipt, meta: DecisionMeta) {
    await client.query(
      `insert into audit_logs(family_id,actor_type,actor_id,action_name,resource_type,resource_id,correlation_id,idempotency_key,result,metadata)
       values ($1,'PERSON',$2,'GENERATE_GROWTH_HYPOTHESIS','ASSESSMENT_SESSION',$3,$4,$5,'SUCCESS',$6::jsonb)`,
      [familyId, actorId, sessionId, meta.correlationId, meta.idempotencyKey, JSON.stringify({ source: meta.source, hypothesis_ref: hypothesis.hypothesis_ref, outcome: receipt.outcome, boundary: hypothesis.fact_boundary })],
    );
    await client.query(
      `insert into outbox_events(aggregate_type,aggregate_id,event_name,event_version,event_id,correlation_id,payload,occurred_at)
       values ('GROWTH_HYPOTHESIS',$1,'GrowthHypothesisGenerated',1,$2,$3,$4::jsonb,now())`,
      [hypothesis.hypothesis_ref, randomUUID(), meta.correlationId, JSON.stringify({ family_id: familyId, assessment_session_id: sessionId, hypothesis_ref: hypothesis.hypothesis_ref, boundary: hypothesis.fact_boundary })],
    );
  }
}

function projection(tenantId: string, familyId: string, availability: Ui03GrowthHypothesisProjection['availability'], hypothesis: Ui03GrowthHypothesis | null, aiState: Ui03GrowthHypothesisProjection['ai_state'] = 'NOT_INVOKED', latestAssessmentSessionId: string | null = null): Ui03GrowthHypothesisProjection {
  return { projection_version: 'UI03_GROWTH_HYPOTHESIS_V1', tenant_id: tenantId, family_id: familyId, availability, hypothesis, latest_assessment_session_id: latestAssessmentSessionId, named_actions: { generate: 'GENERATE_GROWTH_HYPOTHESIS', confirm: 'CONFIRM_GROWTH_HYPOTHESIS', dismiss: 'DISMISS_GROWTH_HYPOTHESIS' }, ai_state: aiState };
}

function generationReceipt(assessmentSessionId: string, hypothesisRef: string, outcome: GrowthHypothesisGenerationReceipt['outcome'], replayed: boolean): GrowthHypothesisGenerationReceipt {
  return { action: 'GENERATE_GROWTH_HYPOTHESIS', outcome, assessment_session_id: assessmentSessionId, hypothesis_ref: hypothesisRef, status: 'PROPOSED', fact_boundary: 'HYPOTHESIS_NOT_FACT_OR_DIAGNOSIS', replayed };
}

function availabilityFromStatus(status: PersistedHypothesisRow['status']): Ui03GrowthHypothesisProjection['availability'] {
  if (status === 'ACKNOWLEDGED') return 'ACKNOWLEDGED';
  if (status === 'DISMISSED') return 'DISMISSED';
  return 'READY';
}

function mapHypothesis(row: HypothesisRow, assessmentRun: AssessmentAiRun): Ui03GrowthHypothesis {
  const assessmentOutput = assessmentRun.output;
  const modelDraft = assessmentOutput.interpretation;
  const modelHypothesis = modelDraft.draft.hypotheses[0];
  return {
    hypothesis_ref: `ASSESSMENT:${row.assessment_session_id}:${row.tool_ref}:v${row.tool_version}:H1`,
    subject_person_id: row.subject_person_id,
    subject_display_name: row.subject_display_name,
    focus_ref: row.focus_ref,
    need_type_ref: row.need_type_ref,
    need_type_version: row.need_type_version,
    title: row.title,
    statement: `基于家庭本次选择和 Family Education Assessment Model 的结构化解读，可以先把“${row.title}”作为一个待验证的支持方向。${row.description}`,
    required_capability_keys: row.required_capability_keys,
    source_refs: { assessment_session_id: row.assessment_session_id, assessment_response_id: row.assessment_response_id, assessment_evidence_id: row.assessment_evidence_id, tool_ref: row.tool_ref, tool_version: row.tool_version, assessment_submitted_at: row.submitted_at },
    limitations: ['仅来自本次家庭视角回答，尚未包含孩子的直接表达。', '模型产物用于组织下一步支持，不表示家庭或孩子的固定标签。', '它不是医学、心理或教育诊断，后续行动效果需要另行观察和确认。'],
    generator: 'FAMILY_EDUCATION_ASSESSMENT_MODEL_V0_1',
    model_run_ref: assessmentRun.runId,
    model_draft_ref: modelHypothesis?.hypothesis_ref ?? modelDraft.assessment_ref,
    model_generator: modelDraft.generator,
    model_component_ref: modelDraft.draft.model_component_ref,
    model_boundary_labels: modelDraft.draft.boundary_labels,
    need_refs: modelDraft.draft.need_summary.map((need) => need.need_ref),
    construct_refs: modelDraft.draft.construct_signals.map((signal) => signal.construct_ref),
    action_candidate_refs: modelDraft.draft.action_candidates.map((candidate) => candidate.action_ref),
    fact_boundary: 'HYPOTHESIS_NOT_FACT_OR_DIAGNOSIS',
    safety_gate: {
      required: modelDraft.draft.human_gate.required,
      reason_refs: modelDraft.draft.human_gate.reason_refs,
      mode: 'HUMAN_REVIEW_REQUIRED',
    },
    principal: mapPrincipalInterpretation(row, modelDraft),
    scorecard: assessmentOutput.scorecard,
  };
}

function mapPrincipalInterpretation(row: HypothesisRow, modelDraft: FamilyAssessmentAiSubsystemOutput['interpretation']): NonNullable<Ui03GrowthHypothesis['principal']> {
  return {
    public_role: PRINCIPAL_SOUL_PROFILE.public_role,
    codename: PRINCIPAL_SOUL_PROFILE.codename,
    opening: `我是${PRINCIPAL_SOUL_PROFILE.public_role}。先谢谢你愿意认真看${row.subject_display_name}的这次测评，这说明你在用心陪伴。`,
    reading: `结合家庭这次的选择，我先把“${row.title}”当成一个可以一起验证的支持方向，而不是给${row.subject_display_name}下的结论。我们不急，先从今晚一件小事开始。`,
    boundary: '这是我基于家庭教育大模型的解读，是待家庭确认的支持方向，不是孩子标签、成长分或诊断；高风险场景我会停下普通陪练，请你联系专业人工支持。',
    boundary_labels: [...(modelDraft.draft.boundary_labels ?? []), 'hypothesis_not_fact', 'recommendation_not_decision'],
  };
}

function hashRequest(value: unknown) { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function isUuid(value: string) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
