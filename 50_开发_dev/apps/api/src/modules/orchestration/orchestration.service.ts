/**
 * FAMILY-GROWTH-VERTICAL-SLICE-001 · 编排 runtime 服务(单家庭价值闭环;3A 运行时真相修正)。
 * 七真相分离;RANKING≠ORCHESTRATION;T1 推荐 eligible ≠ T2 执行 eligible(exact-offer snapshot 复验,FAIL CLOSED)。
 * 执行按【所选 Offer 类型】分派(绝不都跑 AI_COACH);subject 链服务端派生;不写 canonical;不臆造家庭文本。
 * SERVICE consent 是落库/执行前提;AI_PERSONALIZATION 是 AI_COACH 额外要求;年龄严格 12–15。
 */
import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { safetyPrecheck } from '@family/principal-ai';
import type { PrincipalRiskRoute } from '@family/principal-ai';
import {
  SERVICE_PRODUCT_REGISTRY,
  type ContextReuseProjectionDto, type FamilyDecisionType, type GrowthCapabilityKey,
  type ResourceOfferDto, type ResourceRecommendationDto, type SafeOrchestrationOutcome,
  type ServiceTaskDto, type TaskAssignmentDto, type ServiceContributionAllocationDto,
} from '@family/contracts';
import { PrincipalAiCoachResource } from '../principal/principal-ai-coach.resource';
import { classifyNeed } from './need-classification.policy';
import { candidateOffersForCommunicationConflict, resolveResourceRuntimeState } from './resource.registry';
import { evaluateOfferEligibility, type EligibilityContext } from './eligibility.policy';
import { buildRecommendation } from './recommendation.policy';
import { checkDecisionIntegrity } from './decision-integrity.policy';
import { OrchestrationRepository, type EligibilityFacts } from './orchestration.repository';
import type {
  ConfirmSyntheticIntentDto,
  RecordSyntheticDecisionDto,
  StartSyntheticNeedDto,
  TestLoopAuditEntryDto,
  TestLoopCandidatesDto,
  TestLoopDecisionResultDto,
  TestLoopIntentResultDto,
  TestLoopNeedResultDto,
} from './l0-l1-test-loop.dto';
import { decisionTextEquivalent, noActionTextEquivalent, safeStop, toEqualCandidateView } from './l0-l1-test-loop.policy';
import { requireDevSyntheticTestLoop, TEST_LOOP_POLICY_VERSION } from './test-env.policy';
import {
  createMockExecutorReceipt,
  findSyntheticCandidate,
  SYNTHETIC_ADMITTED_CANDIDATES,
  SYNTHETIC_FIXTURE_VERSION,
  SYNTHETIC_INTENT_CHOICES,
  SYNTHETIC_NEED_CHOICES,
} from './test-fixtures/synthetic-admitted-candidates';
import { FamilyLlmGatewayService } from './llm-gateway/family-llm-gateway.service';
import { getFamilyLlmPagePolicy, listFamilyLlmPagePolicies } from './llm-gateway/family-llm-page-policy';
import type { FamilyLlmGatewayResult } from './llm-gateway/family-llm.contract';

const POLICY_VERSION = 'orch-v1';
const SELF_STEWARD = 'family-steward:v1';

export interface RequestHelpResult {
  signal_id: string; proposed_need_type: string | null; proposed_capability_keys: GrowthCapabilityKey[];
  confirm_prompt: string; supported: boolean;
  safety_route: PrincipalRiskRoute;
  next_action: 'CONFIRM_INTENT' | 'REFRAME_NEED' | 'HUMAN_REVIEW' | 'URGENT_HUMAN_SUPPORT';
}
export interface DecideResult {
  decision_id: string; outcome: 'SERVICE_STARTED' | SafeOrchestrationOutcome;
  case_id: string | null; executed_resource_type: string | null;
  ai_coach: { delivered: boolean; risk_route: string; human_handoff: boolean } | null;
  t2_ineligible_offers?: string[];
}

@Injectable()
export class OrchestrationService {
  /** DEV-only 内存审计：仅支持当前进程的内部演示回放，不持久化真实数据，也不是生产审计实现。 */
  private readonly testLoopAudit = new Map<string, TestLoopAuditEntryDto[]>();

  constructor(
    @Inject(OrchestrationRepository) private readonly repo: OrchestrationRepository,
    @Inject(PrincipalAiCoachResource) private readonly aiCoach: PrincipalAiCoachResource,
    @Inject(FamilyLlmGatewayService) private readonly familyLlmGateway: FamilyLlmGatewayService,
  ) {}

  private ctxFor(offer: ResourceOfferDto, facts: EligibilityFacts, safetyNormal: boolean, evaluationRef: string): EligibilityContext {
    const rt = resolveResourceRuntimeState(offer.resource_type);
    return {
      serviceConsentGranted: facts.serviceConsentGranted,
      aiPersonalizationConsentGranted: facts.aiPersonalizationConsentGranted,
      ageInScope: facts.ageInScope,
      safetyRouteNormal: safetyNormal,
      providerQualificationActive: rt.providerQualificationActive,
      available: rt.available,
      externalReferralTargetConfigured: rt.externalReferralTargetConfigured,
      policyVersion: POLICY_VERSION,
      evaluatedAt: new Date().toISOString(),
      evaluationRef,
    };
  }

  /**
   * §21 幂等(顺序重放):同 key+同 request → 重放已存响应;同 key+异 request → 409;首次 → 执行 work 并存响应。
   * 复用共享 idempotency_keys 表。非并发锁(V1 只保障 retry 不产生重复 ServiceCase/AI 交付等)。
   */
  private async withIdempotency<T>(action: string, key: string | undefined, request: unknown, work: () => Promise<T>): Promise<T> {
    if (!key) return work();
    const requestHash = createHash('sha256').update(JSON.stringify(request)).digest('hex');
    await this.repo.query(`insert into idempotency_keys(idempotency_key, action_name, request_hash) values ($1,$2,$3) on conflict (idempotency_key) do nothing`, [key, action, requestHash]);
    const row = (await this.repo.query<{ action_name: string; request_hash: string; response_body: unknown | null }>(
      `select action_name, request_hash, response_body from idempotency_keys where idempotency_key=$1`, [key])).rows[0];
    if (!row || row.action_name !== action || row.request_hash !== requestHash) throw new ConflictException('idempotency_conflict');
    if (row.response_body) return row.response_body as T;
    const response = await work();
    await this.repo.query(`update idempotency_keys set response_code=200, response_body=$2::jsonb where idempotency_key=$1`, [key, JSON.stringify(response)]);
    return response;
  }

  private registryEnv() {
    return {
      approvedPracticeContentRef: process.env.FAMILY_APPROVED_PRACTICE_CONTENT_REF ?? null,
      externalReferralTargetRef: process.env.FAMILY_EXTERNAL_REFERRAL_TARGET ?? null,
    };
  }

  /** ① 表达需求:先校验 subject(家庭/CHILD/12–15)+ SERVICE consent,再写服务层输入 + NON_CANONICAL NeedSignal。 */
  async requestHelp(familyId: string, subjectPersonId: string, actorPersonId: string, rawText: string, source: 'MANUAL' | 'PRINCIPAL' | 'SERVICE_FOLLOWUP', correlationId: string, idempotencyKey?: string): Promise<RequestHelpResult> {
    return this.withIdempotency('RequestGrowthHelp', idempotencyKey, { familyId, subjectPersonId, actorPersonId, rawText, source }, async () => {
    if (!rawText?.trim()) throw new BadRequestException('raw_text_required');
    const subj = await this.repo.checkSubject(familyId, subjectPersonId);
    if (!subj.exists || !subj.inFamily) throw new ForbiddenException('subject_not_in_family');
    if (!subj.isChild) throw new BadRequestException('subject_not_child');
    if (!subj.ageInScope) throw new ForbiddenException('subject_out_of_age_scope_12_15');
    const facts = await this.repo.loadEligibilityFacts(familyId, subjectPersonId);
    if (!facts.serviceConsentGranted) throw new ForbiddenException('service_consent_required'); // 无 SERVICE consent → 0 input / 0 signal

    const safetyRoute = safetyPrecheck({ user_message: rawText });
    const cls = classifyNeed(rawText);
    return this.repo.withTransaction(async (c) => {
      const input = await c.query<{ input_id: string }>(
        `insert into growth_need_inputs(family_id, subject_person_id, actor_person_id, data_class, raw_text)
         values ($1,$2,$3,'FAMILY_PRIVATE_TEXT',$4) returning input_id`,
        [familyId, subjectPersonId, actorPersonId, rawText.trim()],
      );
      const signal = await c.query<{ signal_id: string }>(
        `insert into growth_need_signals(family_id, subject_person_id, source, raw_ref, inferred_need_type, confidence, canonical_family_fact)
         values ($1,$2,$3,$4,$5,$6,false) returning signal_id`,
        [familyId, subjectPersonId, source, input.rows[0].input_id, cls.need_type, cls.confidence],
      );
      const proposedNeedType = safetyRoute === 'NORMAL' ? cls.need_type : null;
      const proposedCapabilityKeys = safetyRoute === 'NORMAL' ? cls.required_capability_keys : [];
      const supported = proposedNeedType != null;
      const nextAction: RequestHelpResult['next_action'] = safetyRoute === 'HIGH_RISK'
        ? 'URGENT_HUMAN_SUPPORT'
        : safetyRoute === 'REVIEW'
          ? 'HUMAN_REVIEW'
          : supported
            ? 'CONFIRM_INTENT'
            : 'REFRAME_NEED';
      const response = {
        signal_id: signal.rows[0].signal_id, proposed_need_type: proposedNeedType, proposed_capability_keys: proposedCapabilityKeys,
        confirm_prompt: safetyRoute === 'HIGH_RISK'
          ? '现在先不要独自处理：请立即联系当地紧急服务、专业危机支持或可信赖的成年人，并确保孩子有人陪伴。'
          : safetyRoute === 'REVIEW'
            ? '这段情况需要先由专业人员复核。普通成长建议已暂停，请优先联系家庭顾问或当地专业支持。'
            : supported
              ? '你现在最想解决的是:先让冲突降下来,并找到今晚重新开口的方式?'
              : '我暂时没完全理解。要不要换句话描述你现在最想解决的问题?',
        supported, safety_route: safetyRoute, next_action: nextAction,
      };
      const occurredAt = new Date().toISOString();
      await c.query(
        `insert into audit_logs(family_id,actor_type,actor_id,action_name,resource_type,resource_id,correlation_id,idempotency_key,result,metadata)
         values ($1,'USER',$2,'RequestGrowthHelp','GrowthNeedSignal',$3,$4,$5,'SUCCESS',$6::jsonb)`,
        [familyId, actorPersonId, response.signal_id, correlationId, idempotencyKey ?? null, JSON.stringify({ source, subject_person_id: subjectPersonId, supported, safety_route: safetyRoute, next_action: nextAction, proposed_need_type: proposedNeedType, raw_text_stored_separately: true })],
      );
      const eventId = randomUUID();
      await c.query(
        `insert into outbox_events(aggregate_type,aggregate_id,event_name,event_version,event_id,correlation_id,payload,occurred_at)
         values ('GrowthNeedSignal',$1,'GrowthHelpRequested',1,$2,$3,$4::jsonb,$5)`,
        [response.signal_id, eventId, correlationId, JSON.stringify({ event_id: eventId, family_id: familyId, subject_person_id: subjectPersonId, signal_id: response.signal_id, source, supported, safety_route: safetyRoute, next_action: nextAction, proposed_need_type: proposedNeedType }), occurredAt],
      );
      return response;
    });
    });
  }

  /** ② 显式确认:subject 从 signal 派生(不信客户端);创建 GrowthIntent(OPEN)。不建 GrowthPriority。 */
  async confirmIntent(familyId: string, actorPersonId: string, signalId: string, goalText: string, idempotencyKey?: string): Promise<{ intent_id: string; subject_person_id: string; required_capability_keys: GrowthCapabilityKey[] }> {
    return this.withIdempotency('ConfirmGrowthIntent', idempotencyKey, { familyId, actorPersonId, signalId, goalText }, async () => {
    const sig = await this.repo.query<{ subject_person_id: string; inferred_need_type: string | null; raw_text: string }>(
      `select gns.subject_person_id, gns.inferred_need_type, gni.raw_text
         from growth_need_signals gns
         join growth_need_inputs gni on gni.input_id=gns.raw_ref
        where gns.signal_id=$1 and gns.family_id=$2`, [signalId, familyId],
    );
    if ((sig.rowCount ?? 0) === 0) throw new BadRequestException('signal_not_found');
    if (safetyPrecheck({ user_message: `${sig.rows[0].raw_text} ${goalText}` }) !== 'NORMAL') {
      throw new ForbiddenException('safety_route_requires_human_support');
    }
    const subjectPersonId = sig.rows[0].subject_person_id; // 服务端派生 subject
    const cls = classifyNeed(goalText);
    const needType = cls.need_type ?? sig.rows[0].inferred_need_type ?? null;
    if (needType !== 'PARENT_CHILD_COMMUNICATION_CONFLICT') throw new BadRequestException('unsupported_need_for_v1_slice');
    const caps = (cls.required_capability_keys.length ? cls.required_capability_keys : (['DE_ESCALATION', 'COMMUNICATION_REOPENING'] as GrowthCapabilityKey[]));
    const intent = await this.repo.query<{ intent_id: string }>(
      `insert into growth_intents(family_id, subject_person_id, signal_ref, need_type, goal_text, required_capability_keys, status, confirmed_by)
       values ($1,$2,$3,$4,$5,$6,'OPEN',$7) returning intent_id`,
      [familyId, subjectPersonId, signalId, needType, goalText.trim(), caps, actorPersonId],
    );
    return { intent_id: intent.rows[0].intent_id, subject_person_id: subjectPersonId, required_capability_keys: caps };
    });
  }

  private async loadOpenIntent(familyId: string, intentId: string): Promise<{ subjectPersonId: string; requiredCaps: GrowthCapabilityKey[]; goalText: string; status: string }> {
    const r = await this.repo.query<{ subject_person_id: string; required_capability_keys: string[]; goal_text: string; status: string }>(
      `select subject_person_id, required_capability_keys, goal_text, status from growth_intents where intent_id=$1 and family_id=$2`, [intentId, familyId],
    );
    if ((r.rowCount ?? 0) === 0) throw new BadRequestException('intent_not_found');
    return { subjectPersonId: r.rows[0].subject_person_id, requiredCaps: r.rows[0].required_capability_keys as GrowthCapabilityKey[], goalText: r.rows[0].goal_text, status: r.rows[0].status };
  }

  /** ③ 推荐:候选原子 Offer → T1 Eligibility(FAIL CLOSED,持久化 offer_snapshot)→ 确定性排序。subject 从 intent 派生。 */
  async recommend(familyId: string, intentId: string, idempotencyKey?: string): Promise<ResourceRecommendationDto> {
    return this.withIdempotency('RequestGrowthRecommendation', idempotencyKey, { familyId, intentId }, async () => {
    const intent = await this.loadOpenIntent(familyId, intentId);
    if (intent.status !== 'OPEN') throw new BadRequestException('intent_not_open');
    const subjectPersonId = intent.subjectPersonId;
    const facts = await this.repo.loadEligibilityFacts(familyId, subjectPersonId);
    const safetyNormal = safetyPrecheck({ user_message: intent.goalText }) === 'NORMAL';
    const candidates = candidateOffersForCommunicationConflict(this.registryEnv());
    const eligible: ResourceOfferDto[] = [];
    return this.repo.withTransaction(async (c) => {
      for (const offer of candidates) {
        const ref = randomUUID();
        const evalDto = evaluateOfferEligibility(offer, 'T1', this.ctxFor(offer, facts, safetyNormal, ref));
        await c.query(
          `insert into eligibility_evaluations(eligibility_evaluation_ref, family_id, intent_ref, stage, offer_ref, eligible, reason_codes, offer_snapshot, policy_version)
           values ($1,$2,$3,'T1',$4,$5,$6,$7::jsonb,$8)`,
          [ref, familyId, intentId, offer.offer_id, evalDto.eligible, evalDto.reason_codes, JSON.stringify(offer), POLICY_VERSION],
        );
        if (evalDto.eligible) eligible.push(offer);
      }
      const rec = buildRecommendation({ recommendationId: randomUUID(), intentId, version: 1, requiredCapabilityKeys: intent.requiredCaps, eligibleOffers: eligible });
      await c.query(
        `insert into resource_recommendations(recommendation_id, family_id, intent_ref, version, candidates, recommended_offer_refs, required_capability_keys, covered_capability_keys, uncovered_capability_keys, why_now, status)
         values ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,'SHOWN')`,
        [rec.recommendation_id, familyId, intentId, rec.version, JSON.stringify(rec.candidates), rec.recommended_offer_refs, rec.required_capability_keys, rec.covered_capability_keys, rec.uncovered_capability_keys, rec.why_now],
      );
      return rec;
    });
    });
  }

  /** 载入某 selected offer 的 exact T1 快照(禁 T2 重新生成猜类型)。 */
  private async loadT1Snapshot(familyId: string, intentId: string, offerRef: string): Promise<ResourceOfferDto | null> {
    const r = await this.repo.query<{ offer_snapshot: ResourceOfferDto }>(
      `select offer_snapshot from eligibility_evaluations where family_id=$1 and intent_ref=$2 and stage='T1' and offer_ref=$3 order by evaluated_at desc limit 1`,
      [familyId, intentId, offerRef],
    );
    return r.rows[0]?.offer_snapshot ?? null;
  }

  /** ④ 决定 → 完整性 → Plan(声明) → T2 exact-offer 复验(FAIL CLOSED) → 按类型分派执行。 */
  async decide(params: {
    familyId: string; actorPersonId: string; intentId: string; recommendationId: string; recommendationVersion: number;
    decisionType: FamilyDecisionType; selectedOfferRefs: string[]; correlationId: string; idempotencyKey?: string;
  }): Promise<DecideResult> {
    const { familyId, actorPersonId, intentId, recommendationId, recommendationVersion, decisionType, selectedOfferRefs, correlationId, idempotencyKey } = params;
    return this.withIdempotency('DecideGrowthService', idempotencyKey, { familyId, intentId, recommendationId, recommendationVersion, decisionType, selectedOfferRefs }, async (): Promise<DecideResult> => {
    const intent = await this.loadOpenIntent(familyId, intentId);
    const subjectPersonId = intent.subjectPersonId; // 服务端派生

    const recRow = await this.repo.query<{ candidates: unknown; recommended_offer_refs: string[]; version: number; required_capability_keys: string[]; covered_capability_keys: string[]; uncovered_capability_keys: string[]; why_now: string }>(
      `select candidates, recommended_offer_refs, version, required_capability_keys, covered_capability_keys, uncovered_capability_keys, why_now
         from resource_recommendations where recommendation_id=$1 and family_id=$2 and intent_ref=$3`, [recommendationId, familyId, intentId],
    );
    if ((recRow.rowCount ?? 0) === 0) throw new BadRequestException('recommendation_not_found');
    const rec: ResourceRecommendationDto = {
      recommendation_id: recommendationId, intent_id: intentId, version: recRow.rows[0].version,
      candidates: recRow.rows[0].candidates as ResourceRecommendationDto['candidates'],
      recommended_offer_refs: recRow.rows[0].recommended_offer_refs,
      required_capability_keys: recRow.rows[0].required_capability_keys as GrowthCapabilityKey[],
      covered_capability_keys: recRow.rows[0].covered_capability_keys as GrowthCapabilityKey[],
      uncovered_capability_keys: recRow.rows[0].uncovered_capability_keys as GrowthCapabilityKey[],
      why_now: recRow.rows[0].why_now, status: 'SHOWN',
    };
    const integrity = checkDecisionIntegrity(rec, decisionType, selectedOfferRefs, recommendationVersion);
    if (!integrity.ok) throw new BadRequestException(`decision_integrity:${integrity.code}`);

    const decisionId = (await this.repo.query<{ decision_id: string }>(
      `insert into family_service_decisions(family_id, subject_person_id, intent_ref, recommendation_ref, recommendation_version, decision_type, selected_offer_refs, actor_person_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8) returning decision_id`,
      [familyId, subjectPersonId, intentId, recommendationId, recommendationVersion, decisionType, selectedOfferRefs, actorPersonId],
    )).rows[0].decision_id;

    if (decisionType === 'DISMISS' || selectedOfferRefs.length === 0) {
      await this.repo.query(`update growth_intents set status='CLOSED', close_reason='NO_ACTION_SELECTED' where intent_id=$1 and family_id=$2`, [intentId, familyId]);
      return { decision_id: decisionId, outcome: 'NO_ACTION', case_id: null, executed_resource_type: 'NO_ACTION', ai_coach: null };
    }

    // 载入每个 selected offer 的 exact T1 快照(不重新生成)。
    const snapshots = new Map<string, ResourceOfferDto>();
    for (const ref of selectedOfferRefs) {
      const snap = await this.loadT1Snapshot(familyId, intentId, ref);
      if (!snap) throw new BadRequestException(`selected_offer_not_in_t1:${ref}`);
      snapshots.set(ref, snap);
    }

    // 声明式 Plan(step 覆盖能力从 candidates 恢复)。
    const candMap = new Map(rec.candidates.map((c) => [c.offer_ref, c.covered_capability_keys]));
    const steps = selectedOfferRefs.map((offerRef, i) => ({
      step_no: i + 1, capability_keys: candMap.get(offerRef) ?? intent.requiredCaps, offer_ref: offerRef,
      covered_capability_keys: candMap.get(offerRef) ?? [], trigger: i === 0 ? 'NOW' : 'AFTER_PREV', condition: null,
    }));
    const planId = (await this.repo.query<{ plan_id: string }>(
      `insert into orchestration_plans(family_id, subject_person_id, intent_ref, version, accepted_by_decision_ref, steps, status)
       values ($1,$2,$3,1,$4,$5::jsonb,'ACCEPTED') returning plan_id`,
      [familyId, subjectPersonId, intentId, decisionId, JSON.stringify(steps)],
    )).rows[0].plan_id;

    // T2 exact-offer 复验(FAIL CLOSED),用各自快照的真实类型/模式,新鲜 facts + runtime state。
    const facts = await this.repo.loadEligibilityFacts(familyId, subjectPersonId);
    const safetyNormal = safetyPrecheck({ user_message: intent.goalText }) === 'NORMAL';
    const t2Ineligible: string[] = [];
    for (const ref of selectedOfferRefs) {
      const snap = snapshots.get(ref)!;
      const evalRef = randomUUID();
      const t2 = evaluateOfferEligibility(snap, 'T2', this.ctxFor(snap, facts, safetyNormal, evalRef));
      await this.repo.query(
        `insert into eligibility_evaluations(eligibility_evaluation_ref, family_id, intent_ref, stage, offer_ref, eligible, reason_codes, offer_snapshot, policy_version)
         values ($1,$2,$3,'T2',$4,$5,$6,$7::jsonb,$8)`,
        [evalRef, familyId, intentId, ref, t2.eligible, t2.reason_codes, JSON.stringify(snap), POLICY_VERSION],
      );
      if (!t2.eligible) t2Ineligible.push(ref);
    }
    if (t2Ineligible.length > 0) {
      return { decision_id: decisionId, outcome: 'RE_RECOMMEND_REQUIRED', case_id: null, executed_resource_type: null, ai_coach: null, t2_ineligible_offers: t2Ineligible };
    }

    // 按【所选 Offer 类型】分派执行(绝不都跑 AI_COACH)。V1:主步取第一顺位。
    const primary = snapshots.get(selectedOfferRefs[0])!;
    const caseId = (await this.repo.query<{ case_id: string }>(
      `insert into service_cases(family_id, subject_person_id, intent_ref, plan_ref, status, owner, collaboration_blueprint_ref, collaboration_blueprint_version, collaboration_blueprint_snapshot)
       values ($1,$2,$3,$4,'IN_PROGRESS',$5,'communication-21day-service-collab',1,(select to_jsonb(b) from service_collaboration_blueprints b where b.blueprint_ref='communication-21day-service-collab' and b.version=1)) returning case_id`,
      [familyId, subjectPersonId, intentId, planId, SELF_STEWARD],
    )).rows[0].case_id;

    let aiCoachResult: DecideResult['ai_coach'] = null;
    let executedType = primary.resource_type;

    if (primary.resource_type === 'AI_COACH') {
      const coach = await this.aiCoach.deliver({ familyId, subjectPersonId, actorPersonId, message: intent.goalText, correlationId });
      aiCoachResult = { delivered: coach.delivered, risk_route: coach.risk_route, human_handoff: coach.human_handoff };
      await this.repo.query(
        `insert into service_contributions(case_ref, provider_ref, role, task_ref, completed_at, quality_state)
         values ($1,$2,'AI_COACH',$3, ${coach.human_handoff ? 'null' : 'now()'}, $4)`,
        [caseId, 'family-self:ai-coach', `principal-session:${coach.session_id}`, coach.human_handoff ? 'HELD' : 'DELIVERED'],
      );
      // 生命周期:交付→WAITING_FAMILY(等回访);扣留/升级→ESCALATED。Intent 保持 OPEN(未 SERVICE_DELIVERED)。
      await this.repo.query(`update service_cases set status=$2, next_action_at = now() + interval '1 day' where case_id=$1`,
        [caseId, coach.human_handoff ? 'ESCALATED' : 'WAITING_FAMILY']);
    } else if (primary.resource_type === 'EXTERNAL_REFERRAL') {
      executedType = 'EXTERNAL_REFERRAL';
      await this.repo.query(
        `insert into service_contributions(case_ref, provider_ref, role, task_ref, quality_state)
         values ($1,null,'EXTERNAL_REFERRAL',$2,'RECORDED')`,
        [caseId, `referral:${primary.external_referral_target_ref}`],
      );
      await this.repo.query(`update service_cases set status='WAITING_FAMILY', next_action_at = now() + interval '1 day' where case_id=$1`, [caseId]);
    } else {
      // PRACTICE 等尚无真实 executor → 不静默替换;标记等待家庭执行。
      await this.repo.query(`update service_cases set status='WAITING_FAMILY', next_action_at = now() + interval '1 day' where case_id=$1`, [caseId]);
    }
    // Intent 保持 OPEN;SERVICE_DELIVERED 只在 follow-up 完成时写(见 submitFollowUp)。

    return { decision_id: decisionId, outcome: 'SERVICE_STARTED', case_id: caseId, executed_resource_type: executedType, ai_coach: aiCoachResult };
    });
  }

  // ===== ARCH-GO-TEST-FULL-FUNCTION-001: DEV synthetic full-loop only =====
  // Never call recommend()/decide() below: those legacy paths rank candidates and/or create Plan/Case/AI/external execution.
  private appendTestLoopAudit(correlationId: string, entry: Omit<TestLoopAuditEntryDto, 'correlation_id'>): void {
    const existing = this.testLoopAudit.get(correlationId) ?? [];
    existing.push({ correlation_id: correlationId, ...entry });
    this.testLoopAudit.set(correlationId, existing);
  }

  private async findSyntheticTestSubject(familyId: string): Promise<string | null> {
    const candidate = await this.repo.query<{ person_id: string }>(
      `select person_id from persons where family_id=$1 and person_type='CHILD' order by person_id asc limit 1`,
      [familyId],
    );
    const personId = candidate.rows[0]?.person_id ?? null;
    if (!personId) return null;
    const check = await this.repo.checkSubject(familyId, personId);
    return check.exists && check.inFamily && check.isChild && check.ageInScope ? personId : null;
  }

  private async requireSyntheticFacts(familyId: string): Promise<{ subjectPersonId: string; facts: EligibilityFacts }> {
    requireDevSyntheticTestLoop();
    const subjectPersonId = await this.findSyntheticTestSubject(familyId);
    if (!subjectPersonId) throw new ForbiddenException('test_loop_synthetic_subject_unavailable');
    const facts = await this.repo.loadEligibilityFacts(familyId, subjectPersonId);
    if (!facts.serviceConsentGranted) throw new ForbiddenException('service_consent_required');
    return { subjectPersonId, facts };
  }

  async testLoopCapability(): Promise<{ enabled: boolean; mode: 'DEV_SYNTHETIC_ONLY'; policy_version: string; environment_status: 'DEV_IMPLEMENTING' | 'DEV_READY_FOR_TEST' | 'TEST_VALIDATED' | 'PROD_HOLD' }> {
    const cap = requireDevSyntheticTestLoop();
    return cap;
  }

  /** L0 synthetic Need: only controlled choices, server-derived synthetic child, no free text. */
  async startSyntheticNeed(familyId: string, actorPersonId: string, dto: StartSyntheticNeedDto, correlationId: string, idempotencyKey?: string): Promise<TestLoopNeedResultDto> {
    const cap = requireDevSyntheticTestLoop();
    if (dto.skip === true && dto.need_choice) throw new BadRequestException('test_loop_need_choice_or_skip');
    if (dto.skip === true) {
      this.appendTestLoopAudit(correlationId, { policy_version: cap.policy_version, fixture_version: SYNTHETIC_FIXTURE_VERSION, input_category: 'NEED', decision_type: 'DISMISS', allowed_state_upper_bound: 'NO_ACTION', safe_stop_reason: null, template_id: null, action_started: false });
      return { need_ref: null, next_state: 'NO_ACTION', allowed_state_upper_bound: 'NO_ACTION', text_equivalent: noActionTextEquivalent() };
    }
    if (!dto.need_choice || !(dto.need_choice in SYNTHETIC_NEED_CHOICES)) throw new BadRequestException('test_loop_need_choice_required');
    const choice = SYNTHETIC_NEED_CHOICES[dto.need_choice];
    return this.withIdempotency('StartSyntheticTestLoopNeed', idempotencyKey, { familyId, actorPersonId, need_choice: dto.need_choice }, async () => {
      const { subjectPersonId } = await this.requireSyntheticFacts(familyId);
      const result = await this.repo.withTransaction(async (c) => {
        const input = await c.query<{ input_id: string }>(
          `insert into growth_need_inputs(family_id, subject_person_id, actor_person_id, data_class, raw_text)
           values ($1,$2,$3,'FAMILY_PRIVATE_TEXT',$4) returning input_id`,
          [familyId, subjectPersonId, actorPersonId, `[TEST_ONLY_SYNTHETIC_FIXTURE] ${choice.text}`],
        );
        const signal = await c.query<{ signal_id: string }>(
          `insert into growth_need_signals(family_id, subject_person_id, source, raw_ref, inferred_need_type, confidence, canonical_family_fact)
           values ($1,$2,'MANUAL',$3,'PARENT_CHILD_COMMUNICATION_CONFLICT',1,false) returning signal_id`,
          [familyId, subjectPersonId, input.rows[0].input_id],
        );
        return signal.rows[0].signal_id;
      });
      this.appendTestLoopAudit(correlationId, { policy_version: cap.policy_version, fixture_version: SYNTHETIC_FIXTURE_VERSION, input_category: 'NEED', decision_type: null, allowed_state_upper_bound: 'NEED', safe_stop_reason: null, template_id: null, action_started: false });
      return { need_ref: result, next_state: 'INTENT', allowed_state_upper_bound: 'NEED', text_equivalent: `已记录内部演示的当下需要：${choice.text}。这不是诊断、评分或成长结论。你可以继续确认支持偏好，或返回。` };
    });
  }

  /** L0 synthetic Intent: controlled choice only; no-action never creates Plan/Case/Task/Reminder. */
  async confirmSyntheticIntent(familyId: string, actorPersonId: string, dto: ConfirmSyntheticIntentDto, correlationId: string, idempotencyKey?: string): Promise<TestLoopIntentResultDto> {
    const cap = requireDevSyntheticTestLoop();
    if (dto.no_action === true && (dto.intent_choice || dto.need_ref)) throw new BadRequestException('test_loop_intent_choice_or_no_action');
    if (dto.no_action === true) {
      this.appendTestLoopAudit(correlationId, { policy_version: cap.policy_version, fixture_version: SYNTHETIC_FIXTURE_VERSION, input_category: 'INTENT', decision_type: 'DISMISS', allowed_state_upper_bound: 'NO_ACTION', safe_stop_reason: null, template_id: null, action_started: false });
      return { intent_id: null, next_state: 'NO_ACTION', allowed_state_upper_bound: 'NO_ACTION', text_equivalent: noActionTextEquivalent() };
    }
    if (!dto.need_ref || !dto.intent_choice || !(dto.intent_choice in SYNTHETIC_INTENT_CHOICES)) throw new BadRequestException('test_loop_need_ref_and_intent_choice_required');
    const choice = SYNTHETIC_INTENT_CHOICES[dto.intent_choice];
    return this.withIdempotency('ConfirmSyntheticTestLoopIntent', idempotencyKey, { familyId, actorPersonId, need_ref: dto.need_ref, intent_choice: dto.intent_choice }, async () => {
      const { subjectPersonId } = await this.requireSyntheticFacts(familyId);
      const signal = await this.repo.query<{ subject_person_id: string }>(
        `select subject_person_id from growth_need_signals where signal_id=$1 and family_id=$2`,
        [dto.need_ref, familyId],
      );
      if ((signal.rowCount ?? 0) !== 1 || signal.rows[0].subject_person_id !== subjectPersonId) throw new ForbiddenException('test_loop_need_ref_not_in_synthetic_family');
      const intent = await this.repo.query<{ intent_id: string }>(
        `insert into growth_intents(family_id, subject_person_id, signal_ref, need_type, goal_text, required_capability_keys, status, confirmed_by)
         values ($1,$2,$3,'PARENT_CHILD_COMMUNICATION_CONFLICT',$4,$5,'OPEN',$6) returning intent_id`,
        [familyId, subjectPersonId, dto.need_ref, `[TEST_ONLY_SYNTHETIC_FIXTURE] ${choice.text}`, ['DE_ESCALATION', 'COMMUNICATION_REOPENING'], actorPersonId],
      );
      this.appendTestLoopAudit(correlationId, { policy_version: cap.policy_version, fixture_version: SYNTHETIC_FIXTURE_VERSION, input_category: 'INTENT', decision_type: null, allowed_state_upper_bound: 'INTENT', safe_stop_reason: null, template_id: null, action_started: false });
      return { intent_id: intent.rows[0].intent_id, next_state: 'CANDIDATES', allowed_state_upper_bound: 'INTENT', text_equivalent: `已确认内部演示的支持偏好：${choice.text}。接下来只会显示合成、已标记为 test-only 的候选；平台不会排序或替家庭决定。` };
    });
  }

  async getSyntheticAdmittedCandidates(familyId: string, intentId: string, correlationId: string): Promise<TestLoopCandidatesDto> {
    const cap = requireDevSyntheticTestLoop();
    const intent = await this.loadOpenIntent(familyId, intentId);
    const facts = await this.repo.loadEligibilityFacts(familyId, intent.subjectPersonId);
    if (!facts.serviceConsentGranted) {
      const stop = safeStop('SERVICE_CONSENT_REQUIRED');
      this.appendTestLoopAudit(correlationId, { policy_version: cap.policy_version, fixture_version: SYNTHETIC_FIXTURE_VERSION, input_category: 'CANDIDATES', decision_type: null, allowed_state_upper_bound: stop.allowed_state_upper_bound, safe_stop_reason: stop.reason, template_id: stop.template_id, action_started: false });
      return { intent_id: intentId, fixture_version: SYNTHETIC_FIXTURE_VERSION, candidates: [], safe_stop: stop, allowed_state_upper_bound: stop.allowed_state_upper_bound, text_equivalent: stop.message };
    }
    const views = SYNTHETIC_ADMITTED_CANDIDATES.map(toEqualCandidateView);
    this.appendTestLoopAudit(correlationId, { policy_version: cap.policy_version, fixture_version: SYNTHETIC_FIXTURE_VERSION, input_category: 'CANDIDATES', decision_type: null, allowed_state_upper_bound: 'READ_ONLY_ADMITTED_CANDIDATES', safe_stop_reason: null, template_id: null, action_started: false });
    return {
      intent_id: intentId,
      fixture_version: SYNTHETIC_FIXTURE_VERSION,
      candidates: views,
      safe_stop: null,
      allowed_state_upper_bound: 'READ_ONLY_ADMITTED_CANDIDATES',
      text_equivalent: '以下是用于内部演示的合成已准入候选。它们以相同字段展示，不表达排序、推荐、效果或真实服务资格。你可以查看说明、返回、暂停或现在先不行动。',
    };
  }

  /** L1 decision-only route: writes FamilyServiceDecision only; never Plan/Case/AI/external execution. */
  async recordSyntheticDecision(familyId: string, actorPersonId: string, dto: RecordSyntheticDecisionDto, correlationId: string, idempotencyKey?: string): Promise<TestLoopDecisionResultDto> {
    const cap = requireDevSyntheticTestLoop();
    if (dto.fixture_version !== SYNTHETIC_FIXTURE_VERSION) throw new BadRequestException('test_loop_fixture_version_mismatch');
    if (dto.decision_type === 'SELECT' && !dto.candidate_ref) throw new BadRequestException('test_loop_candidate_ref_required');
    if (dto.decision_type === 'DISMISS' && dto.candidate_ref) throw new BadRequestException('test_loop_dismiss_requires_empty_candidate');
    return this.withIdempotency('RecordSyntheticTestLoopDecision', idempotencyKey, { familyId, actorPersonId, ...dto }, async () => {
      const intent = await this.loadOpenIntent(familyId, dto.intent_id);
      const facts = await this.repo.loadEligibilityFacts(familyId, intent.subjectPersonId);
      if (!facts.serviceConsentGranted) throw new ForbiddenException('service_consent_required');
      const fixture = dto.candidate_ref ? findSyntheticCandidate(dto.candidate_ref) : null;
      if (dto.decision_type === 'SELECT' && !fixture) throw new BadRequestException('test_loop_candidate_not_admitted');
      const recommendation = await this.repo.query<{ recommendation_id: string; version: number }>(
        `select recommendation_id, version from resource_recommendations where family_id=$1 and intent_ref=$2 and status='SHOWN' order by created_at desc limit 1`,
        [familyId, dto.intent_id],
      );
      let recommendationId = recommendation.rows[0]?.recommendation_id;
      let recommendationVersion = recommendation.rows[0]?.version;
      if (!recommendationId) {
        const inserted = await this.repo.query<{ recommendation_id: string; version: number }>(
          `insert into resource_recommendations(recommendation_id, family_id, intent_ref, version, candidates, recommended_offer_refs, required_capability_keys, covered_capability_keys, uncovered_capability_keys, why_now, status)
           values (gen_random_uuid(),$1,$2,1,$3::jsonb,'{}',$4,'{}',$4,$5,'SHOWN') returning recommendation_id, version`,
          [familyId, dto.intent_id, JSON.stringify(SYNTHETIC_ADMITTED_CANDIDATES.map((candidate) => ({ offer_ref: candidate.offer_ref, title: candidate.title, source_label: candidate.source_label, admission_version: candidate.admission_version }))), ['DE_ESCALATION', 'COMMUNICATION_REOPENING'], '[TEST_ONLY_SYNTHETIC_FIXTURE] candidate view only; no ranking, effect claim, or real execution.'],
        );
        recommendationId = inserted.rows[0].recommendation_id;
        recommendationVersion = inserted.rows[0].version;
      }
      const decision = await this.repo.query<{ decision_id: string }>(
        `insert into family_service_decisions(family_id, subject_person_id, intent_ref, recommendation_ref, recommendation_version, decision_type, selected_offer_refs, actor_person_id)
         values ($1,$2,$3,$4,$5,$6,$7,$8) returning decision_id`,
        [familyId, intent.subjectPersonId, dto.intent_id, recommendationId, recommendationVersion, dto.decision_type === 'DISMISS' ? 'DISMISS' : 'SELECT_ALTERNATIVE', dto.decision_type === 'DISMISS' ? [] : [fixture!.offer_ref], actorPersonId],
      );
      const noAction = dto.decision_type === 'DISMISS';
      this.appendTestLoopAudit(correlationId, { policy_version: cap.policy_version, fixture_version: SYNTHETIC_FIXTURE_VERSION, input_category: 'DECISION', decision_type: dto.decision_type, allowed_state_upper_bound: noAction ? 'NO_ACTION' : 'DECISION', safe_stop_reason: null, template_id: null, action_started: false });
      return {
        decision_id: decision.rows[0].decision_id,
        outcome: noAction ? 'NO_ACTION' : 'DECISION_RECORDED',
        allowed_state_upper_bound: noAction ? 'NO_ACTION' : 'DECISION',
        action_started: false,
        plan_id: null,
        case_id: null,
        mock_executor: noAction ? null : createMockExecutorReceipt(),
        text_equivalent: noAction ? noActionTextEquivalent() : decisionTextEquivalent(),
      };
    });
  }

  /**
   * Real LLM page explanation for the 34-page Family DEV experience.
   * Client input is limited to a registered page ID and a correlation/journey alias;
   * use case, model policy, state bound, candidates, fixture, scope and audit are derived server-side.
   */
  async generateFamilyLlmPageDraft(
    familyId: string,
    actorPersonId: string,
    input: { page_id?: string; journey_id?: string; fixture_version?: string },
    correlationId: string,
  ): Promise<FamilyLlmGatewayResult> {
    const cap = requireDevSyntheticTestLoop();
    const pageId = input.page_id?.trim();
    if (!pageId) throw new BadRequestException('family_llm_page_id_required');
    if (input.fixture_version && input.fixture_version !== SYNTHETIC_FIXTURE_VERSION) {
      throw new BadRequestException('family_llm_fixture_version_mismatch');
    }
    const pagePolicy = getFamilyLlmPagePolicy(pageId);
    if (!pagePolicy) throw new BadRequestException('family_llm_page_not_registered');
    await this.requireSyntheticFacts(familyId);

    const result = await this.familyLlmGateway.generate({
      family_id: familyId,
      actor_person_id: actorPersonId,
      trace_id: correlationId,
      context: {
        environment: cap.environment_status === 'TEST_VALIDATED' ? 'TEST' : 'DEV',
        fixture_id: 'family-34-page-dev-fixture',
        fixture_version: SYNTHETIC_FIXTURE_VERSION,
        journey_id: input.journey_id?.trim() || correlationId,
        page_id: pagePolicy.page_id,
        use_case: pagePolicy.use_case,
        policy_version: cap.policy_version,
        schema_version: 'family-llm-draft.v1',
        allowed_state_upper_bound: pagePolicy.allowed_state_upper_bound,
        mock_state: `TEST_PAGE_${pagePolicy.page_id}`,
        admitted_candidates: SYNTHETIC_ADMITTED_CANDIDATES.map((candidate) => ({
          alias: candidate.offer_ref,
          title: candidate.title,
          admission_version: candidate.admission_version,
        })),
        supported_actions: pagePolicy.supported_actions,
      },
    });
    this.appendTestLoopAudit(correlationId, {
      policy_version: cap.policy_version,
      fixture_version: SYNTHETIC_FIXTURE_VERSION,
      input_category: 'STUB',
      decision_type: null,
      allowed_state_upper_bound: result.audit.allowed_state_upper_bound,
      safe_stop_reason: result.stop_code,
      template_id: result.decision === 'ALLOW_DRAFT' ? null : result.stop_code,
      action_started: false,
    });
    return result;
  }

  listFamilyLlmPages() {
    requireDevSyntheticTestLoop();
    return listFamilyLlmPagePolicies().map((policy) => ({
      page_id: policy.page_id,
      use_case: policy.use_case,
      allowed_state_upper_bound: policy.allowed_state_upper_bound,
    }));
  }

  async replayFamilyLlm(familyId: string, correlationId: string) {
    requireDevSyntheticTestLoop();
    return this.familyLlmGateway.replay(familyId, correlationId);
  }

  /** Patch 4: 建立家庭与服务方的关系；关系本身不授予 ServiceCase 读取权。 */
  async establishServiceRelationship(
    familyId: string,
    actorPersonId: string,
    counterpartyPartyId: string,
    providerProfileId: string | null,
    purpose: string,
    correlationId: string,
    idempotencyKey?: string,
  ) {
    return this.withIdempotency('EstablishServiceRelationship', idempotencyKey, { familyId, counterpartyPartyId, providerProfileId, purpose }, async () => {
      if (!['SERVICE_DELIVERY', 'EDUCATION_SUPPORT', 'ASSESSMENT_SUPPORT'].includes(purpose)) throw new BadRequestException('invalid_relationship_purpose');
      const tenant = await this.repo.query<{ tenant_id: string }>(
        `select tenant_id from tenant_family_bindings where family_id=$1 and status='ACTIVE'
          and effective_from <= now() and (effective_to is null or effective_to > now()) limit 1`, [familyId]);
      if (!tenant.rows[0]) throw new ForbiddenException('family_tenant_context_missing');
      const party = await this.repo.query(
        `select p.party_id from parties p where p.party_id=$1 and p.status='ACTIVE'`, [counterpartyPartyId]);
      if (!party.rows[0]) throw new ForbiddenException('counterparty_not_active');
      if (providerProfileId) {
        const provider = await this.repo.query(
          `select pp.provider_profile_id from provider_profiles pp
             join provider_admissions pa on pa.provider_profile_id=pp.provider_profile_id
            where pp.provider_profile_id=$1 and pp.owner_party_id=$2 and pp.status='ACTIVE'
              and pa.tenant_id=$3 and pa.status='ADMITTED'`,
          [providerProfileId, counterpartyPartyId, tenant.rows[0].tenant_id]);
        if (!provider.rows[0]) throw new ForbiddenException('provider_not_admitted_for_tenant');
      }
      const existing = await this.repo.query<{ service_relationship_id: string }>(
        `select service_relationship_id from service_relationships
          where family_id=$1 and tenant_id=$2 and counterparty_party_id=$3
            and provider_profile_id is not distinct from $4::uuid and purpose=$5 and status='ACTIVE'
          order by created_at desc limit 1`,
        [familyId, tenant.rows[0].tenant_id, counterpartyPartyId, providerProfileId, purpose]);
      if (existing.rows[0]) return { service_relationship_id: existing.rows[0].service_relationship_id, status: 'ACTIVE', replayed: true };
      const created = await this.repo.query<{ service_relationship_id: string }>(
        `insert into service_relationships(family_id, tenant_id, counterparty_party_id, provider_profile_id, purpose, created_by_person_id, correlation_id)
         values ($1,$2,$3,$4,$5,$6,$7) returning service_relationship_id`,
        [familyId, tenant.rows[0].tenant_id, counterpartyPartyId, providerProfileId, purpose, actorPersonId, correlationId]);
      await this.repo.query(
        `insert into audit_logs(family_id,actor_type,actor_id,action_name,resource_type,resource_id,correlation_id,result,metadata)
         values ($1,'USER',$2,'EstablishServiceRelationship','ServiceRelationship',$3,$4,'SUCCESS',$5::jsonb)`,
        [familyId, actorPersonId, created.rows[0].service_relationship_id, correlationId, JSON.stringify({ purpose, counterparty_party_id: counterpartyPartyId, provider_profile_id: providerProfileId })],
      );
      return { service_relationship_id: created.rows[0].service_relationship_id, status: 'ACTIVE', replayed: false };
    });
  }

  /** Patch 4: 针对具体 ServiceCase 签发最小授权；没有关系或 consent 时 fail closed。 */
  async grantCaseAccess(
    familyId: string,
    actorPersonId: string,
    caseId: string,
    relationshipId: string,
    granteePartyId: string,
    scope: Record<string, unknown>,
    purpose: string,
    consentSnapshotRef: string,
    expiresAt: string | null,
    riskLevel: string,
    humanGateRef: string | null,
    correlationId: string,
    idempotencyKey?: string,
  ) {
    return this.withIdempotency('GrantCaseAccess', idempotencyKey, { familyId, caseId, relationshipId, granteePartyId, scope, purpose, consentSnapshotRef, expiresAt, riskLevel, humanGateRef }, async () => {
      if (!scope || typeof scope !== 'object' || Array.isArray(scope) || Object.keys(scope).length === 0) throw new BadRequestException('access_scope_required');
      if (!['SERVICE_DELIVERY', 'EDUCATION_SUPPORT', 'ASSESSMENT_SUPPORT'].includes(purpose)) throw new BadRequestException('invalid_access_purpose');
      if (!['STANDARD', 'ELEVATED', 'HIGH'].includes(riskLevel)) throw new BadRequestException('invalid_risk_level');
      if (!consentSnapshotRef?.trim()) throw new BadRequestException('consent_snapshot_ref_required');
      const own = await this.repo.query<{ subject_person_id: string; tenant_id: string }>(
        `select sc.subject_person_id, tfb.tenant_id from service_cases sc
          join tenant_family_bindings tfb on tfb.family_id=sc.family_id and tfb.status='ACTIVE'
         where sc.case_id=$1 and sc.family_id=$2 limit 1`, [caseId, familyId]);
      if (!own.rows[0]) throw new ForbiddenException('case_not_in_family');
      const relation = await this.repo.query(
        `select service_relationship_id from service_relationships
          where service_relationship_id=$1 and family_id=$2 and tenant_id=$3
            and counterparty_party_id=$4 and purpose=$5 and status='ACTIVE'
            and effective_from <= now() and (effective_to is null or effective_to > now())`,
        [relationshipId, familyId, own.rows[0].tenant_id, granteePartyId, purpose]);
      if (!relation.rows[0]) throw new ForbiddenException('active_service_relationship_required');
      const consent = await this.repo.query(
        `select consent_id from consents where family_id=$1 and subject_person_id=$2 and purpose='SERVICE'
          and status='GRANTED' and granted_at <= now() and (withdrawn_at is null or withdrawn_at > now()) limit 1`,
        [familyId, own.rows[0].subject_person_id]);
      if (!consent.rows[0]) throw new ForbiddenException('service_consent_required');
      const created = await this.repo.query<{ case_access_grant_id: string }>(
        `insert into case_access_grants(family_id, service_case_id, service_relationship_id, grantee_party_id, scope, purpose, consent_snapshot_ref, expires_at, risk_level, human_gate_ref, created_by_person_id, correlation_id)
         values ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11,$12) returning case_access_grant_id`,
        [familyId, caseId, relationshipId, granteePartyId, JSON.stringify(scope), purpose, consentSnapshotRef, expiresAt, riskLevel, humanGateRef, actorPersonId, correlationId]);
      await this.repo.query(
        `insert into audit_logs(family_id,actor_type,actor_id,action_name,resource_type,resource_id,correlation_id,result,metadata)
         values ($1,'USER',$2,'GrantCaseAccess','CaseAccessGrant',$3,$4,'SUCCESS',$5::jsonb)`,
        [familyId, actorPersonId, created.rows[0].case_access_grant_id, correlationId, JSON.stringify({ case_id: caseId, relationship_id: relationshipId, purpose, risk_level: riskLevel })],
      );
      return { case_access_grant_id: created.rows[0].case_access_grant_id, status: 'ACTIVE' };
    });
  }

  async listCaseAccess(familyId: string, caseId: string) {
    const result = await this.repo.query(
            `select g.case_access_grant_id, g.service_relationship_id, g.grantee_party_id, g.scope, g.purpose, g.consent_snapshot_ref,
              g.effective_from, g.expires_at, g.revoked_at, g.risk_level, g.human_gate_ref
         from case_access_grants g
         join service_relationships sr on sr.service_relationship_id=g.service_relationship_id
         join service_cases sc on sc.case_id=g.service_case_id and sc.family_id=g.family_id
         where g.family_id=$1 and g.service_case_id=$2
           and g.revoked_at is null and g.effective_from <= now() and (g.expires_at is null or g.expires_at > now())
           and sr.status='ACTIVE' and sr.effective_from <= now() and (sr.effective_to is null or sr.effective_to > now())
           and exists (
             select 1 from consents c
              where c.family_id=g.family_id and c.subject_person_id=sc.subject_person_id
                and c.purpose='SERVICE' and c.status='GRANTED'
                and c.granted_at <= now() and (c.withdrawn_at is null or c.withdrawn_at > now())
           )
         order by g.created_at asc`, [familyId, caseId]);
    return { family_id: familyId, service_case_id: caseId, grants: result.rows };
  }

  /** Phase A: Party 侧最小 Case projection；不接受客户端声明 party，必须从 account session 解析。 */
  async getGrantedCaseProjection(caseId: string, accountId: string) {
    const party = await this.repo.query<{ party_id: string }>(
      `select apb.party_id from account_party_bindings apb
        join parties p on p.party_id=apb.party_id and p.status='ACTIVE'
       where apb.account_id=$1 and apb.status='ACTIVE'
         and apb.valid_from <= now() and (apb.valid_to is null or apb.valid_to > now())
       limit 2`, [accountId]);
    if (party.rows.length !== 1) throw new ForbiddenException('active_party_context_required');
    const result = await this.repo.query<{
      case_id: string; family_id: string; status: string; opened_at: string; next_action_at: string | null;
      scope: Record<string, unknown>;
    }>(
      `select sc.case_id, sc.family_id, sc.status, sc.opened_at, sc.next_action_at, g.scope
         from case_access_grants g
         join service_cases sc on sc.case_id=g.service_case_id and sc.family_id=g.family_id
         join service_relationships sr on sr.service_relationship_id=g.service_relationship_id
        where g.service_case_id=$1 and g.grantee_party_id=$2
          and g.revoked_at is null and g.effective_from <= now() and (g.expires_at is null or g.expires_at > now())
          and sr.status='ACTIVE' and sr.effective_from <= now() and (sr.effective_to is null or sr.effective_to > now())
          and exists (
            select 1 from consents c where c.family_id=sc.family_id and c.subject_person_id=sc.subject_person_id
              and c.purpose='SERVICE' and c.status='GRANTED' and c.granted_at <= now()
              and (c.withdrawn_at is null or c.withdrawn_at > now())
          )
        limit 1`, [caseId, party.rows[0].party_id]);
    const row = result.rows[0];
    if (!row) throw new ForbiddenException('case_access_not_granted');
    const rawScope = row.scope ?? {};
    const scope = Object.fromEntries(
      Object.entries(rawScope).filter(([key, value]) => {
        return (key === 'service_case' && (value === 'summary' || value === 'status'))
          || (key === 'child_profile' && value === 'minimum');
      }),
    );
    const projection: Record<string, unknown> = {
      case_id: row.case_id,
      family_id: row.family_id,
      status: row.status,
    };
    if (scope.service_case === 'summary' || scope.service_case === 'status') {
      projection.opened_at = row.opened_at;
      projection.next_action_at = row.next_action_at;
    }
    return { projection, granted_scope: scope };
  }

  async revokeCaseAccess(familyId: string, actorPersonId: string, caseId: string, grantId: string, correlationId: string, idempotencyKey?: string) {
    return this.withIdempotency('RevokeCaseAccess', idempotencyKey, { familyId, caseId, grantId }, async () => {
      const result = await this.repo.query(
        `update case_access_grants set revoked_at=coalesce(revoked_at, now())
          where case_access_grant_id=$1 and family_id=$2 and service_case_id=$3 returning case_access_grant_id, revoked_at`,
        [grantId, familyId, caseId]);
      if (!result.rows[0]) throw new ForbiddenException('case_access_grant_not_in_family');
      await this.repo.query(
        `insert into audit_logs(family_id,actor_type,actor_id,action_name,resource_type,resource_id,correlation_id,result,metadata)
         values ($1,'USER',$2,'RevokeCaseAccess','CaseAccessGrant',$3,$4,'SUCCESS',$5::jsonb)`,
        [familyId, actorPersonId, grantId, correlationId, JSON.stringify({ case_id: caseId })],
      );
      return { ...result.rows[0], status: 'REVOKED' };
    });
  }

  getSyntheticTestLoopAudit(correlationId: string): TestLoopAuditEntryDto[] {
    requireDevSyntheticTestLoop();
    return [...(this.testLoopAudit.get(correlationId) ?? [])];
  }

  async getCase(familyId: string, caseId: string): Promise<Record<string, unknown> | null> {
    const r = await this.repo.query(
      `select case_id, status, owner, opened_at, next_action_at, closed_at, intent_ref, plan_ref from service_cases where case_id=$1 and family_id=$2`,
      [caseId, familyId],
    );
    return r.rows[0] ?? null;
  }

  /** DEV 履约协作：为既有 Case 建立一个最小任务。一个 Case 可有多个 task_key，但同一 key 幂等。 */
  async createServiceTask(params: { familyId: string; caseId: string; blueprintRef: string; taskKey: string; title: string; description: string; dueAt?: string | null; idempotencyKey?: string }): Promise<ServiceTaskDto> {
    return this.withIdempotency('CreateServiceTask', params.idempotencyKey, params, async () => {
      if (!params.taskKey.trim() || !params.title.trim() || !params.description.trim()) throw new BadRequestException('task_key_title_description_required');
      const own = await this.repo.query<{ case_id: string; collaboration_blueprint_ref: string | null; collaboration_blueprint_version: number | null; collaboration_blueprint_snapshot: Record<string, unknown> | null }>('select case_id, collaboration_blueprint_ref, collaboration_blueprint_version, collaboration_blueprint_snapshot from service_cases where case_id=$1 and family_id=$2', [params.caseId, params.familyId]);
      if (!own.rowCount) throw new ForbiddenException('case_not_in_family');
      let blueprint = own.rows[0].collaboration_blueprint_snapshot;
      if (!blueprint) {
        const blueprintRow = await this.repo.query<Record<string, unknown>>(`select blueprint_ref, version, applicable_program_ref, roles, task_templates, assignment_rules, required_capability_keys, allocation_policy, release_rules, status, checksum from service_collaboration_blueprints where blueprint_ref=$1 and status='ACTIVE' order by version desc limit 1`, [params.blueprintRef]);
        if (!blueprintRow.rows[0]) throw new ForbiddenException('active_collaboration_blueprint_required');
        blueprint = blueprintRow.rows[0];
        // 代码层校验,与 database/migrations/0058 的 CHECK 约束形成双重一致(约束挡不住旧快照/未来数据源迁移,
        // 这里挡运行时读到的值),呼应 assertTheoryRefsAreWhitelisted 同类"运行时也要挡"的设计哲学。
        const programRef = typeof blueprint.applicable_program_ref === 'string' ? blueprint.applicable_program_ref : null;
        if (!programRef || !SERVICE_PRODUCT_REGISTRY.some((product) => product.product_ref === programRef)) {
          throw new ConflictException('collaboration_blueprint_program_ref_not_registered');
        }
        await this.repo.query(`update service_cases set collaboration_blueprint_ref=$2, collaboration_blueprint_version=$3, collaboration_blueprint_snapshot=$4::jsonb where case_id=$1 and family_id=$5 and collaboration_blueprint_snapshot is null`, [params.caseId, params.blueprintRef, blueprint.version, JSON.stringify(blueprint), params.familyId]);
      }
      const frozenBlueprintRef = typeof blueprint.blueprint_ref === 'string' ? blueprint.blueprint_ref : null;
      if (!frozenBlueprintRef || frozenBlueprintRef !== params.blueprintRef) throw new ConflictException('case_blueprint_mismatch');
      const templates = Array.isArray(blueprint.task_templates) ? blueprint.task_templates as Array<{ task_key?: string; role_key?: string; weight?: number }> : [];
      const template = templates.find((candidate) => candidate.task_key === params.taskKey.trim());
      if (!template || !template.role_key) throw new BadRequestException('task_not_in_collaboration_blueprint');
      const row = await this.repo.query<ServiceTaskDto>(
        `insert into service_tasks(case_ref, blueprint_ref, task_key, title, description, role_key, required_capability_keys, task_weight, due_at)
         values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9) on conflict (case_ref, task_key) do update set updated_at=service_tasks.updated_at
         returning task_id, case_ref as case_id, blueprint_ref, task_key, title, description, status, responsible_ref, role_key, required_capability_keys, task_weight, due_at, deliverable, verified_at`,
        [params.caseId, frozenBlueprintRef, params.taskKey.trim(), params.title.trim(), params.description.trim(), template.role_key, JSON.stringify(Array.isArray(blueprint.required_capability_keys) ? blueprint.required_capability_keys : []), template.weight ?? 1, params.dueAt ?? null],
      );
      return row.rows[0];
    });
  }

  /** DEV 履约协作：一个任务只保留一个当前 ACCEPTED 责任人；新责任人会撤销旧分配。 */
  async assignServiceTask(params: { familyId: string; caseId: string; taskId: string; assigneeRef: string; idempotencyKey?: string }): Promise<TaskAssignmentDto> {
    return this.withIdempotency('AssignServiceTask', params.idempotencyKey, params, async () => this.repo.withTransaction(async (client) => {
      if (!params.assigneeRef.trim()) throw new BadRequestException('assignee_ref_required');
      const task = await client.query<{ task_id: string; status: string; role_key: string | null; required_capability_keys: string[] }>(`select st.task_id, st.status, st.role_key, st.required_capability_keys from service_tasks st join service_cases sc on sc.case_id=st.case_ref where st.task_id=$1 and sc.case_id=$2 and sc.family_id=$3 for update`, [params.taskId, params.caseId, params.familyId]);
      if (!task.rowCount) throw new ForbiddenException('task_not_in_family_case');
      if (['VERIFIED', 'CLOSED', 'CANCELLED'].includes(task.rows[0].status)) throw new ConflictException('task_not_assignable');
      const roleKey = task.rows[0].role_key;
      if (!roleKey) throw new ConflictException('task_blueprint_role_required');
      const roleCheck = await client.query<{ ok: boolean }>(`select exists (select 1 from service_cases sc join service_tasks st on st.case_ref=sc.case_id where st.task_id=$1 and sc.collaboration_blueprint_snapshot @> jsonb_build_object('roles', jsonb_build_array(jsonb_build_object('role_key',$2)))) as ok`, [params.taskId, roleKey]);
      if (!roleCheck.rows[0]?.ok) throw new ForbiddenException('role_not_in_blueprint');
      if (roleKey === 'CASE_STEWARD') {
        const steward = await client.query(`select 1 from service_tasks where case_ref=$1 and role_key='CASE_STEWARD' and responsible_ref is not null and task_id <> $2 and status in ('ACCEPTED','IN_PROGRESS','DELIVERED','VERIFIED')`, [params.caseId, params.taskId]);
        if (steward.rowCount) throw new ConflictException('case_steward_already_assigned');
      }
      if (['DELIVERY_RESOURCE', 'HUMAN_COACH'].includes(roleKey)) {
        const provider = await client.query(`select pp.provider_profile_id from provider_profiles pp join provider_admissions pa on pa.provider_profile_id=pp.provider_profile_id join service_cases sc on sc.case_id=$2 join tenant_family_bindings tfb on tfb.family_id=sc.family_id and tfb.status='ACTIVE' where pp.provider_ref=$1 and pp.status='ACTIVE' and pa.tenant_id=tfb.tenant_id and pa.status='ADMITTED'`, [params.assigneeRef.trim(), params.caseId]);
        if (!provider.rowCount) throw new ForbiddenException('assignee_provider_not_admitted');
        const capabilities = await client.query(`select count(distinct tc.capability_ref)::int as count from teacher_capabilities tc join teacher_profiles tp on tp.teacher_profile_id=tc.teacher_profile_id join provider_profiles pp on pp.owner_party_id=tp.party_id where pp.provider_ref=$1 and tc.status='ACTIVE' and tc.capability_ref = any($2::text[])`, [params.assigneeRef.trim(), task.rows[0].required_capability_keys ?? []]);
        if ((task.rows[0].required_capability_keys ?? []).length > 0 && capabilities.rows[0].count !== (task.rows[0].required_capability_keys ?? []).length) throw new ForbiddenException('assignee_capability_mismatch');
      }
      const access = await client.query(`select 1 from service_relationships sr join provider_profiles pp on pp.provider_profile_id=sr.provider_profile_id where sr.family_id=$1 and sr.status='ACTIVE' and sr.purpose='SERVICE_DELIVERY' and sr.effective_from <= now() and (sr.effective_to is null or sr.effective_to > now()) and pp.provider_ref=$2 and exists (select 1 from case_access_grants g where g.service_case_id=$3 and g.service_relationship_id=sr.service_relationship_id and g.revoked_at is null and g.effective_from <= now() and (g.expires_at is null or g.expires_at > now()))`, [params.familyId, params.assigneeRef.trim(), params.caseId]);
      if (['DELIVERY_RESOURCE', 'HUMAN_COACH'].includes(roleKey) && !access.rowCount) throw new ForbiddenException('active_case_access_required');
      await client.query(`update task_assignments set status='REVOKED', revoked_at=now() where task_id=$1 and status in ('OFFERED','ACCEPTED')`, [params.taskId]);
      const row = await client.query<TaskAssignmentDto>(
        `insert into task_assignments(task_id, assignee_ref, assignee_kind, status, accepted_at)
         values ($1,$2,'EXPERT','ACCEPTED',now())
         returning assignment_id, task_id, assignee_ref, assignee_kind, status, accepted_at`, [params.taskId, params.assigneeRef.trim()],
      );
      await client.query(`update service_tasks set responsible_ref=$2, role_key=$3, status=case when status='PENDING' then 'ACCEPTED' else status end, updated_at=now() where task_id=$1`, [params.taskId, params.assigneeRef.trim(), roleKey]);
      return { ...row.rows[0], role_key: roleKey };
    }));
  }

  /** DEV 履约协作：责任人提交交付物，仍未形成贡献，必须经过 VERIFY。 */
  async deliverServiceTask(params: { familyId: string; caseId: string; taskId: string; deliverable: Record<string, unknown>; idempotencyKey?: string }): Promise<ServiceTaskDto> {
    return this.withIdempotency('DeliverServiceTask', params.idempotencyKey, params, async () => {
      const row = await this.repo.query<ServiceTaskDto>(
        `update service_tasks set status='DELIVERED', deliverable=$4::jsonb, updated_at=now()
         where task_id=$1 and case_ref=$2 and exists (select 1 from service_cases where case_id=$2 and family_id=$3)
           and status in ('ACCEPTED','IN_PROGRESS')
         returning task_id, case_ref as case_id, blueprint_ref, task_key, title, description, status, responsible_ref, due_at, deliverable, verified_at`,
        [params.taskId, params.caseId, params.familyId, JSON.stringify(params.deliverable ?? {})],
      );
      if (!row.rows[0]) throw new ConflictException('task_not_deliverable');
      return row.rows[0];
    });
  }

  /** DEV 履约协作：验收通过后才记录贡献；贡献分配先 HELD，Case 回访闭环后释放。 */
  async verifyServiceTask(params: { familyId: string; caseId: string; taskId: string; reviewerRef: string; qualityState: 'PASSED' | 'REWORK_REQUIRED' | 'REJECTED'; reviewNote?: string | null; idempotencyKey?: string }): Promise<{ task: ServiceTaskDto; contribution: { contribution_id: string } | null; allocations: ServiceContributionAllocationDto[] }> {
    return this.withIdempotency('VerifyServiceTask', params.idempotencyKey, params, async () => this.repo.withTransaction(async (client) => {
      const task = await client.query<ServiceTaskDto>(`select task_id, case_ref as case_id, blueprint_ref, task_key, title, description, status, responsible_ref, role_key, required_capability_keys, task_weight, due_at, deliverable, verified_at from service_tasks where task_id=$1 and case_ref=$2 and exists (select 1 from service_cases where case_id=$2 and family_id=$3) for update`, [params.taskId, params.caseId, params.familyId]);
      if (!task.rows[0]) throw new ForbiddenException('task_not_in_family_case');
      if (task.rows[0].status !== 'DELIVERED') throw new ConflictException('task_requires_delivered_state');
      if (task.rows[0].role_key === 'DELIVERY_RESOURCE' && task.rows[0].responsible_ref === params.reviewerRef) throw new ForbiddenException('reviewer_must_differ_from_delivery');
      await client.query(`insert into task_quality_reviews(task_id, reviewer_ref, quality_state, review_note, reviewed_at) values ($1,$2,$3,$4,now())`, [params.taskId, params.reviewerRef, params.qualityState, params.reviewNote ?? null]);
      if (params.qualityState !== 'PASSED') {
        const next = params.qualityState === 'REWORK_REQUIRED' ? 'IN_PROGRESS' : 'CANCELLED';
        const updated = await client.query<ServiceTaskDto>(`update service_tasks set status=$2, updated_at=now() where task_id=$1 returning task_id, case_ref as case_id, blueprint_ref, task_key, title, description, status, responsible_ref, due_at, deliverable, verified_at`, [params.taskId, next]);
        return { task: updated.rows[0], contribution: null, allocations: [] };
      }
      const updated = await client.query<ServiceTaskDto>(`update service_tasks set status='VERIFIED', verified_at=now(), updated_at=now() where task_id=$1 returning task_id, case_ref as case_id, blueprint_ref, task_key, title, description, status, responsible_ref, role_key, required_capability_keys, task_weight, due_at, deliverable, verified_at`, [params.taskId]);
      const contribution = await client.query<{ contribution_id: string }>(`insert into service_contributions(case_ref, provider_ref, role, task_ref, completed_at, quality_state) values ($1,$2,$3,$4,now(),'VERIFIED') returning contribution_id`, [params.caseId, task.rows[0].responsible_ref, task.rows[0].role_key ?? 'DELIVERY_RESOURCE', params.taskId]);
      return { task: updated.rows[0], contribution: contribution.rows[0], allocations: [] };
    }));
  }

  /** 案件级影子分配：同一案件只计算一次，严格封顶 100，不产生支付或结算副作用。 */
  async finalizeShadowAllocation(params: { familyId: string; caseId: string; helpfulness?: 'HELPFUL' | 'SOMEWHAT_HELPFUL' | 'NOT_HELPFUL_YET' | 'UNANSWERED'; idempotencyKey?: string }): Promise<{ case_id: string; finalized: boolean; allocations: ServiceContributionAllocationDto[] }> {
    return this.withIdempotency('FinalizeShadowAllocation', params.idempotencyKey, params, async () => this.repo.withTransaction(async (client) => {
      const own = await client.query<{ case_id: string; blueprint_ref: string | null; blueprint_version: number | null; shadow_allocation_finalized_at: string | null }>(`select case_id, collaboration_blueprint_ref as blueprint_ref, collaboration_blueprint_version as blueprint_version, shadow_allocation_finalized_at from service_cases where case_id=$1 and family_id=$2 for update`, [params.caseId, params.familyId]);
      if (!own.rows[0]) throw new ForbiddenException('case_not_in_family');
      if (own.rows[0].shadow_allocation_finalized_at) return { case_id: params.caseId, finalized: true, allocations: [] };
      const contributions = await client.query<{ contribution_id: string; provider_ref: string | null; role: string; task_ref: string; task_weight: number }>(`select c.contribution_id, c.provider_ref, c.role, c.task_ref, st.task_weight from service_contributions c join service_tasks st on st.task_id=c.task_ref where c.case_ref=$1 and c.quality_state='VERIFIED' order by c.completed_at asc`, [params.caseId]);
      if (!contributions.rows.length) throw new ConflictException('verified_contribution_required');
      if (!own.rows[0].blueprint_ref || !own.rows[0].blueprint_version) throw new ConflictException('case_blueprint_snapshot_required');
      const policyRef = own.rows[0].blueprint_ref;
      const policyVersion = own.rows[0].blueprint_version;
      const qualityState = params.helpfulness === 'HELPFUL' || params.helpfulness === 'SOMEWHAT_HELPFUL' ? 'RELEASED' : 'HELD';
      const allocations: ServiceContributionAllocationDto[] = [];
      const add = async (contribution: typeof contributions.rows[number], bucket: string, units: number, beneficiaryRef: string, roleKey: string, basisType: string, basisRef: string, releaseState = 'HELD') => {
        const row = await client.query<ServiceContributionAllocationDto>(`insert into service_contribution_allocations(contribution_ref, case_ref, task_ref, allocation_bucket, units, release_state, reason, beneficiary_ref, beneficiary_kind, role_key, policy_ref, policy_version, basis_type, basis_ref) values ($1,$2,$3,$4,$5,$6,$7,$8,'INTERNAL_ACTOR',$9,$10,$11,$12,$13) on conflict (case_ref, allocation_bucket, beneficiary_ref, role_key) do update set units=excluded.units, release_state=excluded.release_state returning allocation_id, case_ref, task_ref, allocation_bucket, units, release_state, reason, beneficiary_ref, beneficiary_kind, role_key, policy_ref, policy_version, basis_type, basis_ref`, [contribution.contribution_id, params.caseId, contribution.task_ref, bucket, units, releaseState, `CASE_SHADOW_ALLOCATION_${policyVersion}`, beneficiaryRef, roleKey, policyRef, policyVersion, basisType, basisRef]);
        allocations.push(row.rows[0]);
      };
      const first = contributions.rows[0];
      await add(first, 'PLATFORM', 20, 'PLATFORM', 'PLATFORM', 'CASE', params.caseId);
      const content = contributions.rows.find((item) => item.role === 'CONTENT_RESOURCE');
      if (content) await add(content, 'CONTENT_RESOURCE', 15, content.provider_ref ?? 'CONTENT_RESOURCE', 'CONTENT_RESOURCE', 'CONTRIBUTION', content.contribution_id);
      const steward = contributions.rows.find((item) => item.role === 'CASE_STEWARD' || item.role === 'STEWARD');
      if (steward) await add(steward, 'CASE_STEWARD', 15, steward.provider_ref ?? 'CASE_STEWARD', 'CASE_STEWARD', 'CONTRIBUTION', steward.contribution_id);
      const delivery = contributions.rows.filter((item) => item.role === 'DELIVERY_RESOURCE' || item.role === 'DELIVERY');
      const totalWeight = delivery.reduce((sum, item) => sum + Number(item.task_weight || 1), 0);
      for (const item of delivery) {
        const units = totalWeight ? 40 * Number(item.task_weight || 1) / totalWeight : 0;
        await add(item, 'DELIVERY_RESOURCE', units, item.provider_ref ?? item.contribution_id, 'DELIVERY_RESOURCE', 'CONTRIBUTION_WEIGHT', item.contribution_id);
      }
      await add(first, 'QUALITY_RESERVE', 10, 'QUALITY_RESERVE', 'QUALITY_RESERVE', 'CASE', params.caseId, qualityState);
      const totalUnits = allocations.reduce((sum, allocation) => sum + Number(allocation.units), 0);
      if (totalUnits > 100.0001) throw new ConflictException('shadow_allocation_total_exceeds_100');
      await client.query(`update service_cases set shadow_allocation_finalized_at=now(), shadow_allocation_policy_ref=$2, shadow_allocation_policy_version=$3 where case_id=$1`, [params.caseId, policyRef, policyVersion]);
      return { case_id: params.caseId, finalized: true, allocations };
    }));
  }

  async listServiceTasks(familyId: string, caseId: string): Promise<ServiceTaskDto[]> {
    const rows = await this.repo.query<ServiceTaskDto>(`select task_id, case_ref as case_id, blueprint_ref, task_key, title, description, status, responsible_ref, due_at, deliverable, verified_at from service_tasks where case_ref=$1 and exists (select 1 from service_cases where case_id=$1 and family_id=$2) order by created_at asc`, [caseId, familyId]);
    return rows.rows;
  }

  /** ⑤ 回访 + helpfulness(actor provenance;非 Observation)。有效反馈→完成服务环:Case COMPLETED + Intent CLOSED/SERVICE_DELIVERED。 */
  async submitFollowUp(familyId: string, actorPersonId: string, caseId: string, helpfulness: string, text: string | null, idempotencyKey?: string): Promise<{ followup_id: string }> {
    return this.withIdempotency('SubmitServiceFollowUp', idempotencyKey, { familyId, actorPersonId, caseId, helpfulness, text }, async () => {
    const allowed = ['HELPFUL', 'SOMEWHAT_HELPFUL', 'NOT_HELPFUL_YET', 'UNANSWERED'];
    if (!allowed.includes(helpfulness)) throw new BadRequestException('invalid_helpfulness');
    const own = await this.repo.query<{ intent_ref: string; status: string }>(`select intent_ref, status from service_cases where case_id=$1 and family_id=$2`, [caseId, familyId]);
    if ((own.rowCount ?? 0) === 0) throw new ForbiddenException('case_not_in_family');
    const r = await this.repo.query<{ followup_id: string }>(
      `insert into service_followup_responses(case_ref, actor_person_id, response_ref, helpfulness, truth_class)
       values ($1,$2,$3,$4,'SERVICE_NOTE') returning followup_id`,
      [caseId, actorPersonId, text, helpfulness],
    );
    if (helpfulness === 'NOT_HELPFUL_YET') {
      await this.repo.query(`update service_contribution_allocations set release_state='HELD', released_at=null where case_ref=$1 and allocation_bucket='QUALITY_RESERVE'`, [caseId]);
      await this.repo.query(`update service_cases set status='OPEN' where case_id=$1 and status='WAITING_FAMILY'`, [caseId]);
    }
    // 只有正向回访才释放质量储备并完成服务环。
    if ((helpfulness === 'HELPFUL' || helpfulness === 'SOMEWHAT_HELPFUL') && own.rows[0].status === 'WAITING_FAMILY') {
      await this.repo.query(`update service_cases set status='COMPLETED', closed_at=now() where case_id=$1`, [caseId]);
      await this.repo.query(`update growth_intents set status='CLOSED', close_reason='SERVICE_DELIVERED' where intent_id=$1 and family_id=$2`, [own.rows[0].intent_ref, familyId]);
      await this.repo.query(`update service_contribution_allocations set release_state='RELEASED', released_at=now() where case_ref=$1 and allocation_bucket='QUALITY_RESERVE' and release_state='HELD'`, [caseId]);
    }
    return { followup_id: r.rows[0].followup_id };
    });
  }

  /** ⑥ Context Reuse(只读;按 need_type 过滤,同类才复用;禁因果)。 */
  async contextReuse(familyId: string, subjectPersonId: string): Promise<ContextReuseProjectionDto> {
    const prior = await this.repo.query<{ case_id: string; plan_ref: string }>(
      `select sc.case_id, sc.plan_ref from service_cases sc
        join growth_intents gi on gi.intent_id = sc.intent_ref
        where sc.family_id=$1 and sc.subject_person_id=$2 and gi.need_type='PARENT_CHILD_COMMUNICATION_CONFLICT'
        order by sc.opened_at desc limit 1`,
      [familyId, subjectPersonId],
    );
    const priorCase = prior.rows[0] ?? null;
    let helpfulness: ContextReuseProjectionDto['prior_helpfulness'] = null;
    const priorOffers: string[] = [];
    const statements: string[] = [];
    if (priorCase) {
      const fu = await this.repo.query<{ helpfulness: string }>(`select helpfulness from service_followup_responses where case_ref=$1 order by captured_at desc limit 1`, [priorCase.case_id]);
      helpfulness = (fu.rows[0]?.helpfulness as ContextReuseProjectionDto['prior_helpfulness']) ?? null;
      const plan = await this.repo.query<{ steps: Array<{ offer_ref: string }> }>(`select steps from orchestration_plans where plan_id=$1`, [priorCase.plan_ref]);
      for (const s of (plan.rows[0]?.steps ?? [])) priorOffers.push(s.offer_ref);
      statements.push('上次类似情况,你选择了先让冲突降下来,再找机会重新开口。');
      if (helpfulness) statements.push(helpfulness === 'HELPFUL' ? '你上次反馈:有帮助。' : helpfulness === 'SOMEWHAT_HELPFUL' ? '你上次反馈:有一点帮助。' : '你上次反馈:暂时没有帮助。');
    }
    return {
      family_id: familyId, subject_person_id: subjectPersonId, need_type: 'PARENT_CHILD_COMMUNICATION_CONFLICT',
      prior_case_ref: priorCase?.case_id ?? null, prior_selected_offer_refs: priorOffers, prior_helpfulness: helpfulness,
      reuse_statements: statements,
    };
  }
}
