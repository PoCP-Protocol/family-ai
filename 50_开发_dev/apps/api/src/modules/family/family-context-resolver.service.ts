import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type pg from 'pg';
import type {
  FamilyConsentResolutionDto,
  FamilyContextPurpose,
  FamilyContextResolutionDto,
  MinimalFamilyGrowthContextDto,
} from '@family/contracts';
import {
  buildPrincipalFamilyContext,
  resolvePrincipalConsent,
  type CanonicalConsentRow,
} from '@family/principal-runtime';
import { FamilyRepository } from './family.repository';
import { assertFamilyManagePermission } from './family-permission';

const GROWTH_GUIDANCE_PURPOSES = ['SERVICE', 'ASSESSMENT', 'GROWTH_TRACKING'] as const;

@Injectable()
export class FamilyContextResolverService {
  constructor(@Inject(FamilyRepository) private readonly repository: FamilyRepository) {}

  async resolve(input: {
    familyId: string;
    subjectPersonId: string;
    purpose: FamilyContextPurpose;
    actorId: string;
  }): Promise<FamilyContextResolutionDto> {
    if (!['GROWTH_GUIDANCE', 'AI_PERSONALIZATION'].includes(input.purpose)) {
      throw new BadRequestException('unsupported_context_purpose');
    }
    return this.repository.withTransaction(async (client) => {
      await assertFamilyManagePermission(client, input.familyId, input.actorId);
      await assertSubjectBelongsToFamily(client, input.familyId, input.subjectPersonId);

      const consents = await loadCanonicalConsents(client, input.familyId, input.subjectPersonId);
      const growthConsent = resolvePurposeSet(consents, GROWTH_GUIDANCE_PURPOSES);
      const aiDecision = resolvePrincipalConsent(consents, input.subjectPersonId);
      const aiConsent = toConsentResolution(aiDecision.allowed, ['AI_PERSONALIZATION'], consents, aiDecision.reason);
      const rawContext = await loadMinimalContext(client, input.familyId, input.subjectPersonId);
      const ruleBasedContext = growthConsent.allowed ? toDto(rawContext) : null;
      const principalContext = buildPrincipalFamilyContext(rawContext, aiDecision);
      const approvedInterventionCodes = await loadApprovedInterventionCodes(client, input.familyId);

      const requestedConsent = input.purpose === 'AI_PERSONALIZATION' ? aiConsent : growthConsent;
      return {
        family_id: input.familyId,
        subject_person_id: input.subjectPersonId,
        purpose: input.purpose,
        consent: requestedConsent,
        ai_personalization: aiConsent,
        rule_based_context: ruleBasedContext,
        ai_context: principalContext ? {
          context_version: principalContext.contextVersion,
          family_ref: principalContext.familyRef,
          subject_ref: principalContext.subjectRef,
          life_stage: principalContext.lifeStage,
          confirmed_growth_priority: [...principalContext.confirmedGrowthPriority],
          active_intervention: [...principalContext.activeIntervention],
          recent_growth_action_state: [...principalContext.recentGrowthActionState],
          recent_permitted_observation_summary: [...principalContext.recentPermittedObservationSummary],
        } : null,
        approved_intervention_codes: approvedInterventionCodes,
        recommendation_source: 'APPROVED_INTERVENTION_LIBRARY',
        model_gateway_status: aiDecision.allowed ? 'NOT_CALLED' : 'BLOCKED_BY_CONSENT',
        action_bridge_status: 'HUMAN_CONFIRMATION_REQUIRED',
        boundaries: {
          context: 'MINIMUM_NECESSARY_ALLOWLIST',
          recommendation: 'PROPOSAL_NOT_DECISION',
          action: 'NAMED_ACTION_ONLY',
          ontology: 'AI_CANNOT_WRITE_CORE_ONTOLOGY',
        },
      };
    });
  }
}

async function assertSubjectBelongsToFamily(client: pg.PoolClient, familyId: string, subjectPersonId: string): Promise<void> {
  const result = await client.query(
    `select 1 from family_memberships
     where family_id = $1 and person_id = $2 and status = 'ACTIVE'
     limit 1`,
    [familyId, subjectPersonId],
  );
  if (result.rowCount === 0) throw new NotFoundException('family_subject_not_found');
}

async function loadCanonicalConsents(
  client: pg.PoolClient,
  familyId: string,
  subjectPersonId: string,
): Promise<CanonicalConsentRow[]> {
  const result = await client.query<CanonicalConsentRow>(
    `select subject_person_id, guardian_person_id, purpose, status, policy_version
     from consents
     where family_id = $1 and subject_person_id = $2`,
    [familyId, subjectPersonId],
  );
  return result.rows;
}

function resolvePurposeSet(
  rows: CanonicalConsentRow[],
  required: readonly string[],
): FamilyConsentResolutionDto {
  const granted = new Set(rows.filter((row) => row.status === 'GRANTED').map((row) => row.purpose));
  const missing = required.filter((purpose) => !granted.has(purpose as CanonicalConsentRow['purpose']));
  return {
    allowed: missing.length === 0,
    required_purposes: [...required],
    granted_purposes: required.filter((purpose) => granted.has(purpose as CanonicalConsentRow['purpose'])),
    missing_purposes: missing,
    reason: missing.length === 0 ? 'required consents granted' : `missing consent: ${missing.join(',')}`,
  };
}

function toConsentResolution(
  allowed: boolean,
  required: string[],
  rows: CanonicalConsentRow[],
  reason: string,
): FamilyConsentResolutionDto {
  const granted = new Set(rows.filter((row) => row.status === 'GRANTED').map((row) => row.purpose));
  return {
    allowed,
    required_purposes: required,
    granted_purposes: required.filter((purpose) => granted.has(purpose as CanonicalConsentRow['purpose'])),
    missing_purposes: required.filter((purpose) => !granted.has(purpose as CanonicalConsentRow['purpose'])),
    reason,
  };
}

async function loadMinimalContext(
  client: pg.PoolClient,
  familyId: string,
  subjectPersonId: string,
): Promise<{
  familyRef: string;
  subjectRef: string;
  lifeStage: string;
  confirmedGrowthPriority: string[];
  activeIntervention: string[];
  recentGrowthActionState: string[];
  recentPermittedObservationSummary: string[];
}> {
  const [lifeStage, priorities, interventions, actions] = await Promise.all([
    client.query<{ life_stage_code: string }>(
      `select life_stage_code from life_stage_assignments
       where family_id = $1 and child_id = $2 order by effective_from desc limit 1`,
      [familyId, subjectPersonId],
    ),
    client.query<{ dimension_id: string }>(
      `select dimension_id from growth_priorities
       where family_id = $1 and status = 'ACTIVE' order by created_at desc limit 5`,
      [familyId],
    ),
    client.query<{ intervention_code: string }>(
      `select intervention_code from intervention_episodes
       where family_id = $1 and status = 'ACTIVE' order by created_at desc limit 5`,
      [familyId],
    ),
    client.query<{ status: string }>(
      `select status from growth_actions
       where family_id = $1 order by created_at desc limit 7`,
      [familyId],
    ),
  ]);
  return {
    familyRef: familyId,
    subjectRef: subjectPersonId,
    lifeStage: lifeStage.rows[0]?.life_stage_code ?? 'UNKNOWN',
    confirmedGrowthPriority: priorities.rows.map((row) => row.dimension_id),
    activeIntervention: interventions.rows.map((row) => row.intervention_code),
    recentGrowthActionState: actions.rows.map((row) => row.status),
    recentPermittedObservationSummary: [],
  };
}

function toDto(context: Awaited<ReturnType<typeof loadMinimalContext>>): MinimalFamilyGrowthContextDto {
  return {
    context_version: 'v1',
    family_ref: context.familyRef,
    subject_ref: context.subjectRef,
    life_stage: context.lifeStage,
    confirmed_growth_priority: [...context.confirmedGrowthPriority],
    active_intervention: [...context.activeIntervention],
    recent_growth_action_state: [...context.recentGrowthActionState],
    recent_permitted_observation_summary: [],
  };
}

async function loadApprovedInterventionCodes(client: pg.PoolClient, familyId: string): Promise<string[]> {
  const tenantResult = await client.query<{ tenant_id: string }>(
    `select tenant_id from tenant_family_bindings
     where family_id = $1 and status = 'ACTIVE' order by created_at desc limit 1`,
    [familyId],
  );
  const tenantId = tenantResult.rows[0]?.tenant_id ?? null;
  const result = await client.query<{ intervention_code: string }>(
    `select intervention_code from interventions
     where status = 'ACTIVE' and review_status = 'PUBLISHED'
       and (tenant_id is null or tenant_id = $1::uuid)
     order by tenant_id nulls last, intervention_code`,
    [tenantId],
  );
  return result.rows.map((row) => row.intervention_code);
}
