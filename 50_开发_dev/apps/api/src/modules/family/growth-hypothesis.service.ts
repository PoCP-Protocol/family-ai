import { createHash, randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { GrowthHypothesisDecisionReceipt, Ui03GrowthHypothesis, Ui03GrowthHypothesisProjection } from '@family/contracts';
import { createFamilyEducationAssessmentModelRuntime } from '@family/family-model';
import type { FamilyAssessmentAiSubsystemOutput, FamilyModelUi02AssessmentResponseSetInput } from '@family/family-model';
import { PRINCIPAL_SOUL_PROFILE } from '@family/principal-ai';
import type pg from 'pg';
import { FamilyRepository } from './family.repository';
import { assertFamilyManagePermission } from './family-permission';

type DecisionType = 'CONFIRM' | 'DISMISS';
type DecisionMeta = { correlationId: string; idempotencyKey: string; source: string };

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

@Injectable()
export class GrowthHypothesisService {
  constructor(@Inject(FamilyRepository) private readonly repository: FamilyRepository) {}

  async getProjection(familyId: string, tenantId: string, actorId: string): Promise<Ui03GrowthHypothesisProjection> {
    return this.repository.withTransaction(async (client) => {
      await this.assertScope(client, familyId, tenantId, actorId);
      const policy = await client.query<{ allowed_pages: string[] | null }>(`select allowed_pages from tenant_policy_profiles where tenant_id=$1 and status='ACTIVE' order by created_at desc limit 1`, [tenantId]);
      if (!(policy.rows[0]?.allowed_pages ?? []).includes('UI-03')) return projection(tenantId, familyId, 'POLICY_BLOCKED', null);
      const row = await this.loadHypothesisRow(client, familyId, tenantId);
      return row ? projection(tenantId, familyId, 'READY', mapHypothesis(row, this.createAssessmentSubsystemOutput(familyId, row)), 'MODEL_DRAFT_READY') : projection(tenantId, familyId, 'NO_SUBMITTED_ASSESSMENT', null);
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
      const row = await this.loadHypothesisRow(client, familyId, tenantId, input.assessment_session_id);
      if (!row) throw new NotFoundException('growth_hypothesis_not_found');
      const hypothesis = mapHypothesis(row, this.createAssessmentSubsystemOutput(familyId, row));
      if (hypothesis.hypothesis_ref !== input.hypothesis_ref) throw new ConflictException('growth_hypothesis_reference_mismatch');
      await this.assertAssessmentConsent(client, familyId, row.subject_person_id);

      let intent: GrowthHypothesisDecisionReceipt['intent'] = null;
      if (input.decision_type === 'CONFIRM') {
        const existing = await client.query<{ intent_id: string; need_type: string; status: 'OPEN'; required_capability_keys: string[]; evidence_refs: string[]; boundary: 'HUMAN_CONFIRMED_INTENT_NOT_OUTCOME' }>(
          `select intent_id,need_type,status,required_capability_keys,evidence_refs,boundary from growth_intents where family_id=$1 and source_type='ASSESSMENT_HYPOTHESIS' and source_ref=$2 limit 1 for update`,
          [familyId, hypothesis.hypothesis_ref],
        );
        intent = existing.rows[0] ?? (await client.query<any>(
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

  private async loadHypothesisRow(client: pg.PoolClient, familyId: string, tenantId: string, sessionId?: string): Promise<HypothesisRow | null> {
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
        where s.family_id=$1 and s.tenant_id=$2 and s.status='SUBMITTED' and ($3::uuid is null or s.assessment_session_id=$3)
        group by s.assessment_session_id,s.subject_person_id,p.display_name,s.submitted_at,s.tool_ref,s.tool_version,r.assessment_response_id,r.response_value,e.evidence_id,nt.need_type_ref,nt.version_no,nt.title,nt.description,nt.required_capability_keys
        order by s.submitted_at desc,nt.version_no desc,e.created_at desc limit 1`,
      [familyId, tenantId, sessionId ?? null],
    );
    return result.rows[0] ?? null;
  }

  private createAssessmentSubsystemOutput(familyId: string, row: HypothesisRow): FamilyAssessmentAiSubsystemOutput {
    const input: FamilyModelUi02AssessmentResponseSetInput = {
      request_id: `UI03:${row.assessment_session_id}`,
      assessment_session_id: row.assessment_session_id,
      tool_ref: row.tool_ref,
      tool_version: row.tool_version,
      family_context_ref: `FAMILY:${familyId}`,
      child_age_stage: 'UNKNOWN_OR_NOT_COLLECTED',
      responses: row.response_set,
    };
    return createFamilyEducationAssessmentModelRuntime().assessUi02ResponseSet(input, 'DEEP_AI_INTERPRETATION');
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
}

function projection(tenantId: string, familyId: string, availability: Ui03GrowthHypothesisProjection['availability'], hypothesis: Ui03GrowthHypothesis | null, aiState: Ui03GrowthHypothesisProjection['ai_state'] = 'NOT_INVOKED'): Ui03GrowthHypothesisProjection {
  return { projection_version: 'UI03_GROWTH_HYPOTHESIS_V1', tenant_id: tenantId, family_id: familyId, availability, hypothesis, named_actions: { confirm: 'CONFIRM_GROWTH_HYPOTHESIS', dismiss: 'DISMISS_GROWTH_HYPOTHESIS' }, ai_state: aiState };
}

function mapHypothesis(row: HypothesisRow, assessmentOutput: FamilyAssessmentAiSubsystemOutput): Ui03GrowthHypothesis {
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
    model_draft_ref: modelHypothesis?.hypothesis_ref ?? modelDraft.assessment_ref,
    model_generator: modelDraft.generator,
    model_component_ref: modelDraft.draft.model_component_ref,
    model_boundary_labels: modelDraft.draft.boundary_labels,
    need_refs: modelDraft.draft.need_summary.map((need) => need.need_ref),
    construct_refs: modelDraft.draft.construct_signals.map((signal) => signal.construct_ref),
    action_candidate_refs: modelDraft.draft.action_candidates.map((candidate) => candidate.action_ref),
    fact_boundary: 'HYPOTHESIS_NOT_FACT_OR_DIAGNOSIS',
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
