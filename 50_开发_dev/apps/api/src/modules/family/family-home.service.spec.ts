import { describe, expect, it, vi } from 'vitest';
import type { GrowthActionDto } from '@family/contracts';
import { FamilyHomeService } from './family-home.service';

describe('FamilyHomeService', () => {
  it('projects all UI-01 features from trusted facts and never claims an AI call', async () => {
    const client = { query: vi.fn(async (sql: string) => {
      if (sql.includes('from families')) return { rows: [{ display_name: '林家' }] };
      if (sql.includes('tenant_policy_profiles')) return { rows: [{ allowed_pages: ['UI-02', 'UI-03', 'UI-04', 'UI-09', 'UI-12', 'UI-13', 'UI-19', 'UI-34', 'UI-35'] }] };
      if (sql.includes('from persons p')) return { rows: [
        { person_id: 'child-1', display_name: '小林', age_in_scope: true, service_consent_granted: true },
        { person_id: 'child-2', display_name: '小木', age_in_scope: true, service_consent_granted: false },
        { person_id: 'child-3', display_name: '小苗', age_in_scope: false, service_consent_granted: true },
      ] };
      if (sql.includes('family_journey_plans')) return { rows: [{ plan_id: 'plan-1', title: '90天家庭成长旅程', status: 'ACTIVE', current_phase: 'SEE', current_day: 6 }] };
      if (sql.includes('family_product_offerings')) return { rows: [{ product_id: 'product-1', title: '家庭沟通课程' }] };
      if (sql.includes('family_service_offerings')) return { rows: [{ service_offering_id: 'service-1', title: '家庭顾问咨询' }] };
      throw new Error(`unexpected query: ${sql}`);
    }) };
    const repository = { withTransaction: vi.fn((work: (tx: typeof client) => unknown) => work(client)) };
    const action = {
      action_id: 'action-1', family_id: 'family-1', onboarding_id: 'onboarding-1', priority_id: 'priority-1',
      intervention_episode_id: null, journey_plan_id: 'plan-1', journey_phase: 'SEE', day_index: 6,
      status: 'PENDING', assignment_text: '今晚先倾听十分钟', due_date: '2026-08-23', completed_at: null,
      completion_status: null, reflection: null, reflection_boundary: 'REFLECTION_IS_PERSPECTIVE_NOT_OUTCOME',
      boundary: 'ACTION_IS_NOT_OUTCOME', created_at: '2026-08-23T00:00:00.000Z',
    } as GrowthActionDto;
    const growthActions = { listTodayActions: vi.fn(async () => [action]) };
    const service = new FamilyHomeService(repository as never, growthActions as never);

    const projection = await service.getHome('family-1', 'tenant-1', 'actor-1');

    expect(projection.family.display_name).toBe('林家');
    expect(projection.primary_action?.assignment_text).toBe('今晚先倾听十分钟');
    expect(projection.journey?.current_day).toBe(6);
    expect(projection.recommendations.map((item) => item.source_type)).toEqual(['PRODUCT_OFFERING', 'SERVICE_OFFERING']);
    expect(projection.feature_availability).toHaveLength(25);
    expect(new Set(projection.feature_availability.map((item) => item.feature_id)).size).toBe(25);
    expect(projection.ai_assistance).toMatchObject({ state: 'NOT_INVOKED', named_action: 'REQUEST_GROWTH_HELP' });
    expect(projection.growth_help).toMatchObject({ state: 'AVAILABLE', named_action: 'REQUEST_GROWTH_HELP', safety_boundary: 'EXPLICIT_SUBMISSION_REQUIRED' });
    expect(projection.growth_help.subjects).toEqual([
      { person_id: 'child-1', display_name: '小林', availability: 'AVAILABLE' },
      { person_id: 'child-2', display_name: '小木', availability: 'CONSENT_REQUIRED' },
      { person_id: 'child-3', display_name: '小苗', availability: 'OUT_OF_SCOPE' },
    ]);
    expect(JSON.stringify(projection)).not.toMatch(/score|ranking|diagnosis|model_output/i);
  });

  it('returns truthful empty and supply-unavailable states', async () => {
    const client = { query: vi.fn(async (sql: string) => {
      if (sql.includes('from families')) return { rows: [{ display_name: '空态家庭' }] };
      if (sql.includes('tenant_policy_profiles')) return { rows: [{ allowed_pages: [] }] };
      return { rows: [] };
    }) };
    const repository = { withTransaction: vi.fn((work: (tx: typeof client) => unknown) => work(client)) };
    const service = new FamilyHomeService(repository as never, { listTodayActions: vi.fn(async () => []) } as never);

    const projection = await service.getHome('family-1', 'tenant-1', 'actor-1');

    expect(projection.entry_state).toBe('EMPTY');
    expect(projection.primary_action).toBeNull();
    expect(projection.recommendations).toEqual([]);
    expect(projection.feature_availability.find((item) => item.feature_id === 'recommended_content')?.availability).toBe('SUPPLY_UNAVAILABLE');
    expect(projection.notification).toEqual({ state: 'NOT_CONFIGURED', unread_count: 0, target_ui: 'UI-34' });
    expect(projection.growth_help).toMatchObject({ state: 'NO_ELIGIBLE_SUBJECT', subjects: [] });
  });

  it('does not choose a first child when several eligible subjects exist', async () => {
    const client = { query: vi.fn(async (sql: string) => {
      if (sql.includes('from families')) return { rows: [{ display_name: '双子家庭' }] };
      if (sql.includes('tenant_policy_profiles')) return { rows: [{ allowed_pages: [] }] };
      if (sql.includes('from persons p')) return { rows: [
        { person_id: 'child-a', display_name: '晨晨', age_in_scope: true, service_consent_granted: true },
        { person_id: 'child-b', display_name: '星星', age_in_scope: true, service_consent_granted: true },
      ] };
      return { rows: [] };
    }) };
    const repository = { withTransaction: vi.fn((work: (tx: typeof client) => unknown) => work(client)) };
    const service = new FamilyHomeService(repository as never, { listTodayActions: vi.fn(async () => []) } as never);

    const projection = await service.getHome('family-1', 'tenant-1', 'actor-1');

    expect(projection.growth_help.state).toBe('AVAILABLE');
    expect(projection.growth_help.subjects.map((subject) => subject.person_id)).toEqual(['child-a', 'child-b']);
    expect(JSON.stringify(projection.growth_help)).not.toContain('selected');
  });
});
