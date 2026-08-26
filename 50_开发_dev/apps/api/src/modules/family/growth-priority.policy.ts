import { createHash } from 'node:crypto';
import type {
  AgreementLevel,
  GrowthDimensionTheoryBasis,
  GrowthPriorityCandidateDto,
  GrowthPriorityDecision,
  GrowthPriorityDraftDto,
  GrowthPriorityEligibility,
  GrowthPriorityLimitation,
  GrowthPriorityReasonCode,
  GrowthState,
  M2GrowthDimensionId,
  ProfileConfidence,
  ProfileLimitation,
} from '@family/contracts';

export const GROWTH_PRIORITY_POLICY_VERSION = 'M2_104_DETERMINISTIC_V2' as const;
export const GROWTH_PRIORITY_BOUNDARY = 'PRIORITY_IS_HUMAN_CONFIRMED_PRACTICE_FOCUS' as const;
export const GROWTH_PRIORITY_DIMENSIONS: M2GrowthDimensionId[] = ['P03', 'R03', 'R04', 'R05'];
const PRIMARY_GROWTH_PRIORITY_DIMENSION: M2GrowthDimensionId = 'R03';

/**
 * docs/GROWTH_MODEL_24D_REVERSE_VALIDATION.md(2026-08-26)反向核验决策的工程落地。
 * P03/R03被核验列为"维度必要性待重新考虑"(未下最终结论,THEORY_UNRESOLVED如实反映这个未决状态,
 * 不是回避)；R04/R05的Gottman构念(四骑士/修复尝试)有描述性研究支持,但2023年一篇论文判定作为
 * 干预疗法证据不足,因此评级为INTERVENTION_EFFICACY_INSUFFICIENT而非CONSTRUCT_SUPPORTED。
 */
export const GROWTH_PRIORITY_DIMENSION_THEORY_BASIS: Record<M2GrowthDimensionId, GrowthDimensionTheoryBasis> = {
  P03: {
    dimension_id: 'P03',
    theory_label: 'Rogers主动倾听(人本主义传统,来访者中心疗法三条件)',
    evidence_grade: 'INTERVENTION_EFFICACY_INSUFFICIENT',
    citation_boundary: '冲突场景下的因果效力证据薄弱(Hahlweg 1984/Gottman本人质疑)，仅可用于观察性描述，不得暗示掌握此技巧能解决冲突。',
  },
  R03: {
    dimension_id: 'R03',
    theory_label: '暂无单一权威构念(多个通用人际沟通理论综合,尚待核验确认)',
    evidence_grade: 'THEORY_UNRESOLVED',
    citation_boundary: '维度理论根基未决，AI输出不得援引任何具体理论出处，只能用中性、不含理论背书的描述。',
  },
  R04: {
    dimension_id: 'R04',
    theory_label: 'Gottman Four Horsemen(批评/防御/蔑视/筑墙，描述性构念)',
    evidence_grade: 'INTERVENTION_EFFICACY_INSUFFICIENT',
    citation_boundary: '不得暗示"练习这个方法能修复关系"，只能用于观察性描述（如"观察到高频批评/蔑视模式"）。',
  },
  R05: {
    dimension_id: 'R05',
    theory_label: 'Gottman Repair Attempts(修复尝试，与冲突调节水平分开讨论的独立构念)',
    evidence_grade: 'INTERVENTION_EFFICACY_INSUFFICIENT',
    citation_boundary: '构念定义清楚，但受R04同样的干预有效性证据限制，不得暗示这套方法本身已被证明有效。',
  },
};

const CAUSAL_PROMISE_PHRASES = ['能改善', '会修复', '有效解决', '保证'];

/**
 * 唯一真正的拦截点：任何生成的why文案如果暗示因果/疗效承诺，而该维度的evidence_grade不支持
 * (即不是CONSTRUCT_SUPPORTED)，直接拒绝而非静默放行。当前buildWhy()是硬编码文案，本身不会
 * 触发；这个校验点是为未来LLM生成/文案迭代设的安全网——同assertTheoryRefsAreWhitelisted
 * "确定性路径天然安全，风险在未来变动"的设计哲学。
 */
export function assertGrowthPriorityCitationBoundary(dimensionId: M2GrowthDimensionId, whyText: string): void {
  const basis = GROWTH_PRIORITY_DIMENSION_THEORY_BASIS[dimensionId];
  if (basis.evidence_grade !== 'CONSTRUCT_SUPPORTED' && CAUSAL_PROMISE_PHRASES.some((phrase) => whyText.includes(phrase))) {
    throw new Error(`growth_priority_citation_boundary_violated:${dimensionId}`);
  }
}

export interface ConfirmedProfileForPriority {
  profile_id: string;
  family_id: string;
  dimension_id: M2GrowthDimensionId;
  state: GrowthState;
  confidence: ProfileConfidence;
  version: number;
  basis: {
    supporting_evidence_ids?: string[];
    limitations?: ProfileLimitation[];
    agreement_level?: AgreementLevel;
    confidence?: ProfileConfidence;
    candidate_state?: GrowthState | 'UNRESOLVED';
  };
  evidence_snapshot: {
    evidence_ids?: string[];
  };
  confirmed_at: string;
}

export interface BuildGrowthPriorityDraftInput {
  familyId: string;
  onboardingId: string;
  profiles: ConfirmedProfileForPriority[];
  createdAt: string;
}

export function buildGrowthPriorityDraft(input: BuildGrowthPriorityDraftInput): GrowthPriorityDraftDto {
  const candidates = input.profiles
    .filter((profile) => GROWTH_PRIORITY_DIMENSIONS.includes(profile.dimension_id))
    .map((profile) => buildCandidate(profile, input.createdAt));
  const selected = candidates.find((candidate) => candidate.dimension_id === PRIMARY_GROWTH_PRIORITY_DIMENSION && candidate.eligibility === 'ELIGIBLE') ?? null;
  const eligibleCandidates = candidates.filter((candidate) => candidate.dimension_id === PRIMARY_GROWTH_PRIORITY_DIMENSION && candidate.eligibility === 'ELIGIBLE');
  const allEvidenceRefs = Array.from(new Set(candidates.flatMap((candidate) => candidate.evidence_summary.supporting_evidence_count > 0
    ? getEvidenceRefsForCandidate(candidate, input.profiles)
    : [])));
  const profileRefs = candidates.map((candidate) => ({
    profile_id: candidate.profile_id,
    version: candidate.profile_version,
    dimension_id: candidate.dimension_id,
  }));
  const decision: GrowthPriorityDecision = selected?.dimension_id ?? 'NO_PRIORITY_YET';

  return {
    draft_id: createDraftId(input.familyId, input.onboardingId, profileRefs, decision),
    family_id: input.familyId,
    onboarding_id: input.onboardingId,
    decision,
    candidate: selected,
    profile_refs: profileRefs,
    evidence_refs: selected ? getEvidenceRefsForCandidate(selected, input.profiles) : allEvidenceRefs,
    confidence: selected?.evidence_summary.confidence ?? 'LOW',
    policy_version: GROWTH_PRIORITY_POLICY_VERSION,
    profile_snapshot: {
      profile_refs: profileRefs,
      candidate_count: candidates.length,
      eligible_candidate_count: eligibleCandidates.length,
      boundary: GROWTH_PRIORITY_BOUNDARY,
    },
    created_at: input.createdAt,
  };
}

export function assertDecisionMatchesDraft(draft: GrowthPriorityDraftDto, decision: GrowthPriorityDecision): void {
  if (decision === 'NO_PRIORITY_YET') {
    // A guardian may explicitly defer even when a deterministic candidate exists.
    // This writes no hidden priority state and keeps human confirmation authoritative.
    return;
  }

  if (!draft.candidate || draft.candidate.dimension_id !== decision || draft.candidate.eligibility !== 'ELIGIBLE') {
    throw new Error('growth_priority_decision_not_eligible');
  }
}

function buildCandidate(profile: ConfirmedProfileForPriority, createdAt: string): GrowthPriorityCandidateDto {
  const evidenceIds = getEvidenceRefs(profile);
  const limitations = mapLimitations(profile);
  const reasonCodes = mapReasonCodes(profile, evidenceIds.length);
  const eligibility = determineEligibility(profile, evidenceIds.length);
  const why = buildWhy(profile.dimension_id, profile.state, eligibility);
  assertGrowthPriorityCitationBoundary(profile.dimension_id, why);

  return {
    dimension_id: profile.dimension_id,
    profile_id: profile.profile_id,
    profile_version: profile.version,
    state_snapshot: profile.state,
    reason_codes: reasonCodes,
    evidence_summary: {
      supporting_evidence_count: evidenceIds.length,
      limitations: profile.basis.limitations ?? [],
      agreement_level: profile.basis.agreement_level ?? 'INSUFFICIENT',
      confidence: profile.basis.confidence ?? profile.confidence,
    },
    eligibility,
    boundary: GROWTH_PRIORITY_BOUNDARY,
    why,
    expected_change: '未来七天只作为练习焦点观察沟通过程变化，不承诺结果改善。',
    limitations,
    theory_basis: GROWTH_PRIORITY_DIMENSION_THEORY_BASIS[profile.dimension_id],
    policy_version: GROWTH_PRIORITY_POLICY_VERSION,
    created_at: createdAt,
  };
}

function determineEligibility(profile: ConfirmedProfileForPriority, evidenceCount: number): GrowthPriorityEligibility {
  if (profile.dimension_id !== PRIMARY_GROWTH_PRIORITY_DIMENSION) {
    return 'NO_PRIORITY_YET';
  }
  if (evidenceCount < 1) {
    return 'NO_PRIORITY_YET';
  }
  if ((profile.basis.limitations ?? []).includes('PERSPECTIVE_DIVERGENCE')) {
    return 'REVIEW_REQUIRED';
  }
  if (profile.state === 'STABILIZING') {
    return 'REVIEW_REQUIRED';
  }
  return 'ELIGIBLE';
}

function mapReasonCodes(profile: ConfirmedProfileForPriority, evidenceCount: number): GrowthPriorityReasonCode[] {
  const reasonCodes: GrowthPriorityReasonCode[] = ['RECENTLY_CONFIRMED_PROFILE'];
  if (profile.state === 'DEVELOPING' || profile.state === 'EMERGING' || profile.state === 'PRACTICING') {
    reasonCodes.push('PRACTICE_READY');
  }
  if (profile.state === 'STABILIZING') {
    reasonCodes.push('PROFILE_UNRESOLVED');
  }
  if (evidenceCount < 1) {
    reasonCodes.push('INSUFFICIENT_EVIDENCE');
  }
  if ((profile.basis.limitations ?? []).includes('PERSPECTIVE_DIVERGENCE')) {
    reasonCodes.push('PERSPECTIVE_DIVERGENCE');
  }
  return reasonCodes;
}

function mapLimitations(profile: ConfirmedProfileForPriority): GrowthPriorityLimitation[] {
  const limitations = new Set<GrowthPriorityLimitation>();
  const profileLimitations = profile.basis.limitations ?? [];
  if (getEvidenceRefs(profile).length < 1 || profileLimitations.includes('INSUFFICIENT_EVIDENCE')) {
    limitations.add('INSUFFICIENT_EVIDENCE');
  }
  if (profileLimitations.includes('PERSPECTIVE_DIVERGENCE')) {
    limitations.add('PERSPECTIVE_DIVERGENCE');
  }
  return Array.from(limitations);
}

function getEvidenceRefsForCandidate(candidate: GrowthPriorityCandidateDto, profiles: ConfirmedProfileForPriority[]): string[] {
  const profile = profiles.find((item) => item.profile_id === candidate.profile_id);
  return profile ? getEvidenceRefs(profile) : [];
}

function getEvidenceRefs(profile: ConfirmedProfileForPriority): string[] {
  return profile.evidence_snapshot.evidence_ids ?? profile.basis.supporting_evidence_ids ?? [];
}

function createDraftId(
  familyId: string,
  onboardingId: string,
  profileRefs: GrowthPriorityDraftDto['profile_refs'],
  decision: GrowthPriorityDecision,
): string {
  const hex = createHash('sha256')
    .update(JSON.stringify({ familyId, onboardingId, profileRefs, decision, policy: GROWTH_PRIORITY_POLICY_VERSION }))
    .digest('hex')
    .slice(0, 32);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `5${hex.slice(13, 16)}`,
    `8${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join('-');
}

function buildWhy(dimensionId: M2GrowthDimensionId, state: GrowthState, eligibility: GrowthPriorityEligibility): string {
  if (eligibility !== 'ELIGIBLE') {
    return '当前资料还不足以形成下一步练习焦点。';
  }
  const labels: Record<M2GrowthDimensionId, string> = {
    P03: '家长先听见孩子表达，再回应。',
    R03: '亲子沟通先确认理解，再进入建议。',
    R04: '冲突时先降低对抗，再处理问题。',
    R05: '共同约定一个可以执行的小行动。',
  };
  return `${labels[dimensionId]}当前状态为 ${state}，适合作为七天练习焦点。`;
}
