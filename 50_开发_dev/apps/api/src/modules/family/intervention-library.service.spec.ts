import { describe, expect, it } from 'vitest';
import { InterventionLibraryService } from './intervention-library.service';

describe('InterventionLibraryService', () => {
  it('只返回已发布且可追溯的家庭干预目录，不产生状态变更', async () => {
    const queries: string[] = [];
    const client = {
      query: async (sql: string) => {
        queries.push(sql);
        if (sql.includes('from family_memberships')) {
          return { rows: [{ role: 'OWNER_GUARDIAN', status: 'ACTIVE' }], rowCount: 1 };
        }
        if (sql.includes('from tenant_family_bindings')) {
          return { rows: [{ tenant_id: '11111111-1111-4111-8111-111111111111' }], rowCount: 1 };
        }
        if (sql.includes('from interventions i')) {
          return {
            rows: [{
              intervention_id: 'INTERVENTION-001',
              intervention_code: 'LISTEN_BEFORE_RESPOND',
              tenant_id: null,
              evidence_grade: 'E1',
              risk_level: 'LOW',
              human_requirement: 'PARENT_CONFIRMATION',
              version: 1,
              review_status: 'PUBLISHED',
              reviewed_by_actor_id: 'reviewer-1',
              reviewed_at: new Date('2026-08-22T00:00:00.000Z'),
              content: {
                name_zh: '先听后回应',
                duration_days: 7,
                why: 'why',
                target: 'target',
                behavior: 'behavior',
                applicability: ['R03'],
                contraindications: [],
                safety_notes: ['safe'],
                expected_mediator: 'mediator',
                expected_outcome: 'not guaranteed',
                action_plan: ['day1', 'day2'],
                policy_version: 'M2_105_DETERMINISTIC_V1',
              },
              required_consent_purposes: ['SERVICE', 'ASSESSMENT', 'GROWTH_TRACKING'],
              source_refs: [{ source_type: 'INTERNAL_BASELINE', source_ref: '35UI', evidence_grade: 'E1' }],
            }],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      },
    };
    const repository = { withTransaction: async <T>(work: (tx: typeof client) => Promise<T>) => work(client) };
    const service = new InterventionLibraryService(repository as never);

    const projection = await service.listPublishedForFamily('22222222-2222-4222-8222-222222222222', 'actor-1');

    expect(projection.boundary).toBe('READ_ONLY_APPROVED_INTERVENTION_LIBRARY');
    expect(projection.items).toHaveLength(1);
    expect(projection.items[0]).toMatchObject({
      scope: 'GLOBAL',
      review_status: 'PUBLISHED',
      evidence_grade: 'E1',
      evidence_boundary: 'PRACTICE_CONTENT_NOT_DIAGNOSIS_OR_GUARANTEED_OUTCOME',
      required_consent_purposes: ['SERVICE', 'ASSESSMENT', 'GROWTH_TRACKING'],
      intervention: { intervention_code: 'LISTEN_BEFORE_RESPOND', action_template: 'day1\nday2' },
    });
    expect(queries.some((sql) => /insert|update|delete/i.test(sql))).toBe(false);
  });
});
