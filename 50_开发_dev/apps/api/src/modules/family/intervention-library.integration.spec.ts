import pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestPool } from '../../test/test-database';
import { FAMILY_PLATFORM_FIXTURE, seedFamilyPlatformFixture } from '../../test-fixtures/family-platform.integration.fixture';
import { FamilyRepository } from './family.repository';
import { InterventionLibraryService } from './intervention-library.service';

let pool: pg.Pool;
let repository: FamilyRepository;
let service: InterventionLibraryService;

beforeAll(async () => {
  if (!process.env.TEST_DATABASE_URL) throw new Error('REQUIRED_REAL_POSTGRESQL: TEST_DATABASE_URL is not set');
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  pool = createTestPool();
  await pool.query('select 1');
  repository = new FamilyRepository();
  service = new InterventionLibraryService(repository);
});

beforeEach(async () => {
  await seedFamilyPlatformFixture(pool);
  const f = FAMILY_PLATFORM_FIXTURE;
  await pool.query(
    `insert into interventions(
       intervention_id, intervention_code, name, life_stage_code, target_dimensions, applicable_conditions,
       contraindications, mechanism, action_templates, risk_level, human_requirement, evidence_grade, version, status,
       tenant_id, review_status, reviewed_by_actor_id, reviewed_at
     ) values
       ('TEST-TENANT-LISTEN-V2', 'LISTEN_BEFORE_RESPOND', '先听后回应·租户版', 'EARLY_ADOLESCENCE_12_15', '["P03"]'::jsonb, '[]'::jsonb,
        '["高风险信号先人工处理"]'::jsonb, '先听完再回应', '["先听完再回应"]'::jsonb, 'LOW', 'HUMAN_CONFIRM', 'E1', 2, 'ACTIVE',
        $1, 'PUBLISHED', $2, now()),
       ('TEST-DRAFT-CARD', 'DRAFT_NOT_VISIBLE', '草稿卡', 'EARLY_ADOLESCENCE_12_15', '["P03"]'::jsonb, '[]'::jsonb,
        '[]'::jsonb, '不可见', '["不可见"]'::jsonb, 'LOW', 'HUMAN_CONFIRM', 'E1', 1, 'ACTIVE',
        $1, 'DRAFT', null, null)
     on conflict (intervention_id) do nothing`,
    [f.tenantId, f.guardianId],
  );
  await pool.query(
    `insert into intervention_versions(
       intervention_id, version, status, content, required_consent_purposes, source_refs,
       created_by_actor_id, reviewed_by_actor_id, reviewed_at, published_at
     ) values
       ('TEST-TENANT-LISTEN-V2', 2, 'PUBLISHED',
        '{"name_zh":"先听后回应·租户版","duration_days":7,"why":"租户审核后的家庭练习。","target":"家庭沟通","behavior":"先听完再回应","applicability":["P03"],"contraindications":["高风险信号先人工处理"],"safety_notes":["不作诊断或效果承诺"],"expected_mediator":"练习记录","expected_outcome":"不承诺结果","action_plan":["先听完再回应"],"policy_version":"TEST_LIBRARY_V2"}'::jsonb,
        '["SERVICE","GROWTH_TRACKING"]'::jsonb,
        '[{"source_type":"TENANT_REVIEW","source_ref":"TEST_LIBRARY_REVIEW","evidence_grade":"E1"}]'::jsonb,
        $1, $1, now(), now()),
       ('TEST-DRAFT-CARD', 1, 'DRAFT',
        '{"name_zh":"草稿卡","duration_days":1,"action_plan":["不可见"]}'::jsonb,
        '[]'::jsonb, '[]'::jsonb, $1, null, null, null)
     on conflict (intervention_id, version) do nothing`,
    [f.guardianId],
  );
});

afterAll(async () => {
  await repository?.onModuleDestroy();
  await pool?.end();
});

describe('Intervention Library PostgreSQL integration', () => {
  it('returns only reviewed published global and tenant content with explicit evidence and consent boundaries', async () => {
    const f = FAMILY_PLATFORM_FIXTURE;
    const projection = await service.listPublishedForFamily(f.familyId, f.guardianId);

    expect(projection.boundary).toBe('READ_ONLY_APPROVED_INTERVENTION_LIBRARY');
    expect(projection.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ scope: 'GLOBAL', review_status: 'PUBLISHED', evidence_boundary: 'PRACTICE_CONTENT_NOT_DIAGNOSIS_OR_GUARANTEED_OUTCOME' }),
      expect.objectContaining({ scope: 'TENANT', content_version: 2, tenant_id: f.tenantId, review_status: 'PUBLISHED', required_consent_purposes: ['SERVICE', 'GROWTH_TRACKING'] }),
    ]));
    expect(projection.items.some((item) => item.intervention.intervention_code === 'DRAFT_NOT_VISIBLE')).toBe(false);
    expect(projection.items[0]?.scope).toBe('TENANT');
  });

  it('fails closed when the actor cannot manage the family', async () => {
    const f = FAMILY_PLATFORM_FIXTURE;
    await expect(service.listPublishedForFamily(f.familyId, f.childId)).rejects.toBeDefined();
  });
});
