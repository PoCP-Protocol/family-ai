import { Inject, Injectable } from '@nestjs/common';
import type { FamilyHomeProjection, FamilyHomeRecommendation, GrowthActionDto, Ui01FeatureAvailability } from '@family/contracts';
import { projectTodayTask, UI01_HOME_FEATURES } from '@family/contracts';
import { FamilyRepository } from './family.repository';
import { GrowthActionService } from './growth-action.service';

type HomeFacts = {
  familyName: string;
  allowedPages: string[];
  growthHelpSubjects: FamilyHomeProjection['growth_help']['subjects'];
  journey: FamilyHomeProjection['journey'];
  recommendations: FamilyHomeRecommendation[];
};

const FEATURE_TARGET_UI: Readonly<Record<string, string>> = {
  assessment_campaign: 'UI-02', assessment_cta: 'UI-02', ai_diagnostic: 'UI-03', challenge_21: 'UI-14',
  plan_90: 'UI-04', growth_cases: 'UI-12', expert_live: 'UI-19', family_advisor: 'UI-19',
  today_tasks: 'UI-09', task_communication: 'UI-09', task_reading: 'UI-09', task_emotion: 'UI-09',
  recommended_content: 'UI-13', recommended_card_1: 'UI-13', recommended_card_2: 'UI-13', recommended_card_3: 'UI-13',
  nav_plan: 'UI-04', nav_community: 'UI-11', nav_mine: 'UI-34', notification: 'UI-34', header_more: 'UI-34',
};

@Injectable()
export class FamilyHomeService {
  constructor(
    @Inject(FamilyRepository) private readonly repository: FamilyRepository,
    @Inject(GrowthActionService) private readonly growthActions: GrowthActionService,
  ) {}

  async getHome(familyId: string, tenantId: string, actorId: string): Promise<FamilyHomeProjection> {
    const [actions, facts] = await Promise.all([
      this.growthActions.listTodayActions(familyId, actorId),
      this.readFacts(familyId, tenantId),
    ]);
    const asOf = new Date().toISOString();
    const tasks = actions.map((action) => projectTodayTask(action, asOf));
    const allowed = new Set(facts.allowedPages);
    const policyAllows = (ui: string) => allowed.size === 0 || allowed.has(ui);
    const supplyAvailable = facts.recommendations.length > 0;
    const availabilityFor = (featureId: string): Ui01FeatureAvailability => {
      const targetUi = FEATURE_TARGET_UI[featureId];
      if (targetUi && !policyAllows(targetUi)) return 'POLICY_BLOCKED';
      if (featureId === 'notification') return 'NOT_CONFIGURED';
      if ((featureId === 'expert_live' || featureId === 'family_advisor') && !facts.recommendations.some((item) => item.source_type === 'SERVICE_OFFERING')) return 'SUPPLY_UNAVAILABLE';
      if (featureId.startsWith('recommended_') && !supplyAvailable) return 'SUPPLY_UNAVAILABLE';
      return 'AVAILABLE';
    };
    const quickEntries: FamilyHomeProjection['quick_entries'] = [
      { feature_id: 'ai_diagnostic', title: 'AI成长说明', target_ui: 'UI-03', availability: availabilityFor('ai_diagnostic') },
      { feature_id: 'challenge_21', title: '21天挑战营', target_ui: 'UI-14', availability: availabilityFor('challenge_21') },
      { feature_id: 'plan_90', title: '90天成长计划', target_ui: 'UI-04', availability: availabilityFor('plan_90') },
      { feature_id: 'growth_cases', title: '成长案例', target_ui: 'UI-12', availability: availabilityFor('growth_cases') },
      { feature_id: 'expert_live', title: '专家直播', target_ui: 'UI-19', availability: availabilityFor('expert_live') },
      { feature_id: 'family_advisor', title: '家庭顾问', target_ui: 'UI-19', availability: availabilityFor('family_advisor') },
    ];
    const availableGrowthHelpSubjects = facts.growthHelpSubjects.filter((subject) => subject.availability === 'AVAILABLE');
    const hasConsentRequiredSubject = facts.growthHelpSubjects.some((subject) => subject.availability === 'CONSENT_REQUIRED');
    const growthHelpState: FamilyHomeProjection['growth_help']['state'] = !policyAllows('UI-03')
      ? 'POLICY_BLOCKED'
      : availableGrowthHelpSubjects.length > 0
        ? 'AVAILABLE'
        : hasConsentRequiredSubject
          ? 'CONSENT_REQUIRED'
          : 'NO_ELIGIBLE_SUBJECT';
    return {
      projection_version: 'UI01_FAMILY_HOME_V1', tenant_id: tenantId, family_id: familyId, as_of: asOf,
      entry_state: tasks.length > 0 || facts.journey || facts.recommendations.length > 0 || growthHelpState === 'AVAILABLE' ? 'READY' : 'EMPTY',
      family: { display_name: facts.familyName, actor_scope: 'AUTHORIZED_FAMILY_MANAGER' },
      greeting: { time_segment: timeSegment(new Date()), text_key: 'GROW_TOGETHER_TODAY' },
      notification: { state: 'NOT_CONFIGURED', unread_count: 0, target_ui: 'UI-34' },
      assessment_campaign: { state: policyAllows('UI-02') ? 'AVAILABLE' : 'POLICY_BLOCKED', target_ui: 'UI-02' },
      quick_entries: quickEntries,
      growth_help: {
        state: growthHelpState,
        subjects: facts.growthHelpSubjects,
        named_action: 'REQUEST_GROWTH_HELP',
        endpoint: '/orchestration/needs',
        safety_boundary: 'EXPLICIT_SUBMISSION_REQUIRED',
      },
      primary_action: tasks.find((task) => task.task_state === 'NOT_STARTED') ?? tasks[0] ?? null,
      today_tasks: tasks,
      journey: facts.journey,
      recommendations: facts.recommendations,
      feature_availability: UI01_HOME_FEATURES.map((feature) => ({ feature_id: feature.feature_id, target_route: feature.target_route, availability: availabilityFor(feature.feature_id) })),
      ai_assistance: { use_cases: ['HOME_GROWTH_SUMMARY', 'NEXT_BEST_GROWTH_HELP'], state: 'NOT_INVOKED', named_action: 'REQUEST_GROWTH_HELP', evidence_boundary: 'NO_MODEL_CONCLUSION_IN_HOME_READ' },
      provenance: { source_refs: ['families', 'persons', 'life_stage_assignments', 'consents', 'tenant_policy_profiles', 'growth_actions', 'family_journey_plans', 'family_product_offerings', 'family_service_offerings'], recommendation_policy: 'ACTIVE_ADMITTED_CATALOG_ONLY', as_of: asOf },
    };
  }

  private async readFacts(familyId: string, tenantId: string): Promise<HomeFacts> {
    return this.repository.withTransaction(async (client) => {
      // A pg transaction client is deliberately used sequentially; concurrent
      // client.query calls are deprecated and can make a commercial read flaky.
      const family = await client.query<{ display_name: string }>('select display_name from families where family_id=$1', [familyId]);
      const policy = await client.query<{ allowed_pages: string[] | null }>(`select allowed_pages from tenant_policy_profiles where tenant_id=$1 and status='ACTIVE' order by created_at desc limit 1`, [tenantId]);
      const children = await client.query<{ person_id: string; display_name: string; age_in_scope: boolean; service_consent_granted: boolean }>(
        `select p.person_id, p.display_name,
                ((p.birth_date is not null and date_part('year', age(current_date, p.birth_date)) between 12 and 15)
                  or (p.birth_date is null and exists (
                    select 1 from life_stage_assignments lsa
                     where lsa.family_id=p.family_id and lsa.child_id=p.person_id
                       and lsa.life_stage_code='EARLY_ADOLESCENCE_12_15'
                       and lsa.effective_from<=current_date
                       and (lsa.effective_to is null or lsa.effective_to>current_date)
                  ))) as age_in_scope,
                exists (
                  select 1 from consents c
                   where c.family_id=p.family_id and c.subject_person_id=p.person_id
                     and c.purpose='SERVICE' and c.status='GRANTED'
                ) as service_consent_granted
           from persons p
          where p.family_id=$1 and p.person_type='CHILD'
          order by p.created_at, p.person_id`,
        [familyId],
      );
      const journey = await client.query<{ plan_id: string; title: string; status: 'ACTIVE' | 'PAUSED'; current_phase: string; current_day: number }>(`select plan_id,title,status,current_phase,current_day from family_journey_plans where family_id=$1 and status in ('ACTIVE','PAUSED') order by updated_at desc limit 1`, [familyId]);
      const products = await client.query<{ product_id: string; title: string }>(`select product_id,title from family_product_offerings where status='ACTIVE' and admission_status='ADMITTED' and effective_from<=now() and (effective_to is null or effective_to>now()) and (scope_type='PLATFORM' or tenant_id=$1) order by scope_type desc,effective_from desc,product_ref limit 3`, [tenantId]);
      const services = await client.query<{ service_offering_id: string; title: string }>(`select service_offering_id,title from family_service_offerings where tenant_id=$1 and status='ACTIVE' and admission_status='ADMITTED' and effective_from<=now() and (effective_to is null or effective_to>now()) order by effective_from desc,service_offering_ref limit 3`, [tenantId]);
      const recommendations: FamilyHomeRecommendation[] = [
        ...products.rows.map((row) => ({ recommendation_id: row.product_id, source_type: 'PRODUCT_OFFERING' as const, title: row.title, target_ui: 'UI-13' as const, availability: 'AVAILABLE' as const, ordering_basis: 'ACTIVE_ADMITTED_CATALOG_ORDER' as const })),
        ...services.rows.map((row) => ({ recommendation_id: row.service_offering_id, source_type: 'SERVICE_OFFERING' as const, title: row.title, target_ui: 'UI-19' as const, availability: 'AVAILABLE' as const, ordering_basis: 'ACTIVE_ADMITTED_CATALOG_ORDER' as const })),
      ].slice(0, 3);
      const j = journey.rows[0];
      return {
        familyName: family.rows[0]?.display_name ?? '我的家庭',
        allowedPages: policy.rows[0]?.allowed_pages ?? [],
        growthHelpSubjects: children.rows.map((row) => ({
          person_id: row.person_id,
          display_name: row.display_name,
          availability: row.age_in_scope ? (row.service_consent_granted ? 'AVAILABLE' : 'CONSENT_REQUIRED') : 'OUT_OF_SCOPE',
        })),
        journey: j ? { ...j, total_days: 90, boundary: 'PLAN_PROGRESS_IS_PROCESS_NOT_OUTCOME' } : null,
        recommendations,
      };
    });
  }
}

function timeSegment(now: Date): FamilyHomeProjection['greeting']['time_segment'] {
  const hour = now.getHours();
  return hour < 12 ? 'MORNING' : hour < 18 ? 'AFTERNOON' : 'EVENING';
}
