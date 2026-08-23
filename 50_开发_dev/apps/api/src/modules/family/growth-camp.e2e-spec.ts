import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../../app.module';
import { cleanFamilyCoreTables, createTestPool, getTestDatabaseUrl } from '../../test/test-database';
import { AuthService } from '../auth/auth.service';

describe('UI-35 commercial growth-camp lifecycle', () => {
  let app: INestApplication;
  let baseUrl: string;
  let pool: pg.Pool;
  let auth: AuthService;
  let familyId: string;
  let childId: string;
  let token: string;
  const previousMode = process.env.PLATFORM_AUTH_MODE;

  beforeAll(async () => {
    process.env.DATABASE_URL = getTestDatabaseUrl();
    process.env.PLATFORM_AUTH_MODE = 'required';
    pool = createTestPool();
    app = await NestFactory.create(AppModule, { logger: ['error'] });
    auth = app.get(AuthService);
    await app.listen(0);
    baseUrl = await app.getUrl();
  });
  afterAll(async () => { await app.close(); await pool.end(); process.env.PLATFORM_AUTH_MODE = previousMode; });

  beforeEach(async () => {
    await cleanFamilyCoreTables(pool);
    const tenantId = (await pool.query<{ tenant_id: string }>(`insert into tenants(tenant_ref,display_name,tenant_type,status) values ('CAMP_E2E','Camp E2E','INTERNAL_SANDBOX','ACTIVE') returning tenant_id`)).rows[0].tenant_id;
    const accountId = (await pool.query<{ account_id: string }>(`insert into accounts(external_ref,status) values ('camp:e2e:guardian','ACTIVE') returning account_id`)).rows[0].account_id;
    familyId = (await pool.query<{ family_id: string }>(`insert into families(display_name) values ('成长营测试家庭') returning family_id`)).rows[0].family_id;
    const guardianId = (await pool.query<{ person_id: string }>(`insert into persons(family_id,person_type,parent_role,display_name,account_id) values ($1,'PARENT','GUARDIAN','测试家长','camp:e2e:guardian') returning person_id`, [familyId])).rows[0].person_id;
    childId = (await pool.query<{ person_id: string }>(`insert into persons(family_id,person_type,display_name,birth_date) values ($1,'CHILD','测试孩子','2013-05-01') returning person_id`, [familyId])).rows[0].person_id;
    await pool.query(`insert into account_person_bindings(account_id,person_id,status) values ($1,$2,'ACTIVE')`, [accountId, guardianId]);
    await pool.query(`insert into family_memberships(family_id,person_id,role,status,joined_at) values ($1,$2,'OWNER_GUARDIAN','ACTIVE',now()),($1,$3,'CHILD_SUBJECT','ACTIVE',now())`, [familyId, guardianId, childId]);
    await pool.query(`insert into tenant_account_memberships(tenant_id,account_id,role,status,valid_from) values ($1,$2,'TENANT_VIEWER','ACTIVE',now())`, [tenantId, accountId]);
    await pool.query(`insert into tenant_family_bindings(tenant_id,family_id,status,effective_from,migration_ref) values ($1,$2,'ACTIVE',now(),'CAMP_E2E')`, [tenantId, familyId]);
    await pool.query(`insert into tenant_policy_profiles(tenant_id,policy_version,status,allowed_pages,allowed_tools) values ($1,'camp-e2e-v1','ACTIVE','["UI-01","UI-09","UI-35"]'::jsonb,'[]'::jsonb)`, [tenantId]);
    await pool.query(`insert into consents(family_id,subject_person_id,guardian_person_id,purpose,status,policy_version,granted_at) values ($1,$2,$3,'SERVICE','GRANTED','camp-v1',now())`, [familyId, childId, guardianId]);
    token = (await auth.issueAccountSession('camp:e2e:guardian')).token;
  });

  const post = (path: string, body: unknown, key: string) => fetch(`${baseUrl}${path}`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'idempotency-key': key, 'x-correlation-id': `corr-${key}`, 'x-source': 'camp-e2e' }, body: JSON.stringify(body) });

  it('enrolls once, records the current day, advances progress and replays safely', async () => {
    const projectionResponse = await fetch(`${baseUrl}/families/${familyId}/ui/35/growth-camp`, { headers: { authorization: `Bearer ${token}` } });
    expect(projectionResponse.status).toBe(200);
    const projection = await projectionResponse.json() as any;
    expect(projection).toMatchObject({ projection_version: 'UI35_GROWTH_CAMP_V1', availability: 'AVAILABLE', enrollment: null, boundary: 'ACTION_RECORD_IS_NOT_CHILD_SCORE_DIAGNOSIS_OR_GROWTH_OUTCOME' });
    expect(projection.program).toMatchObject({ program_ref: 'PARENT_GROWTH_21', version_no: 1, evidence_level: 'E1' });
    expect(projection.program.days).toHaveLength(21);

    const enrolledResponse = await post(`/families/${familyId}/growth-camps/enrollments`, { subject_person_id: childId }, 'camp-enroll');
    expect(enrolledResponse.status).toBe(201);
    const enrolled = await enrolledResponse.json() as any;
    expect(enrolled).toMatchObject({ action: 'ENROLL_GROWTH_CAMP', replayed: false, enrollment: { status: 'ACTIVE', current_day: 1, subject_person_id: childId } });
    const enrollmentId = enrolled.enrollment.enrollment_id;
    const replay = await (await post(`/families/${familyId}/growth-camps/enrollments`, { subject_person_id: childId }, 'camp-enroll')).json() as any;
    expect(replay).toMatchObject({ replayed: true, enrollment: { enrollment_id: enrollmentId } });

    const future = await post(`/families/${familyId}/growth-camps/${enrollmentId}/days/2/check-ins`, { completion_status: 'COMPLETED', reflection: '', occurred_at: '2026-08-23T10:00:00.000Z' }, 'camp-day-future');
    expect(future.status).toBe(409);
    const checkedResponse = await post(`/families/${familyId}/growth-camps/${enrollmentId}/days/1/check-ins`, { completion_status: 'COMPLETED', reflection: '我先听完了。', occurred_at: '2026-08-23T10:00:00.000Z' }, 'camp-day-1');
    expect(checkedResponse.status).toBe(201);
    const checked = await checkedResponse.json() as any;
    expect(checked).toMatchObject({ action: 'CHECK_IN_GROWTH_CAMP_DAY', replayed: false, enrollment: { current_day: 2, status: 'ACTIVE' }, checkin: { day_no: 1, reflection: '我先听完了。', reflection_boundary: 'PARENT_REFLECTION_NOT_CHILD_FACT_OR_OUTCOME' } });
    const checkinReplay = await (await post(`/families/${familyId}/growth-camps/${enrollmentId}/days/1/check-ins`, { completion_status: 'COMPLETED', reflection: '我先听完了。', occurred_at: '2026-08-23T10:00:00.000Z' }, 'camp-day-1')).json() as any;
    expect(checkinReplay.replayed).toBe(true);
    const updated = await (await fetch(`${baseUrl}/families/${familyId}/ui/35/growth-camp`, { headers: { authorization: `Bearer ${token}` } })).json() as any;
    expect(updated).toMatchObject({ enrollment: { enrollment_id: enrollmentId, current_day: 2 }, checkins: [{ day_no: 1, completion_status: 'COMPLETED' }] });
    const counts = await pool.query(`select (select count(*) from family_growth_camp_enrollments where family_id=$1)::int enrollments,(select count(*) from family_growth_camp_day_checkins where enrollment_id=$2)::int checkins,(select count(*) from audit_logs where family_id=$1 and resource_type='GROWTH_CAMP_ENROLLMENT')::int audits`, [familyId, enrollmentId]);
    expect(counts.rows[0]).toEqual({ enrollments: 1, checkins: 1, audits: 2 });
  });

  it('fails closed when service consent is withdrawn', async () => {
    await pool.query(`update consents set status='WITHDRAWN',withdrawn_at=now() where family_id=$1 and purpose='SERVICE'`, [familyId]);
    const projection = await (await fetch(`${baseUrl}/families/${familyId}/ui/35/growth-camp`, { headers: { authorization: `Bearer ${token}` } })).json() as any;
    expect(projection).toMatchObject({ availability: 'CONSENT_REQUIRED', subjects: [{ person_id: childId, availability: 'CONSENT_REQUIRED' }] });
    expect((await post(`/families/${familyId}/growth-camps/enrollments`, { subject_person_id: childId }, 'camp-no-consent')).status).toBe(403);
  });
});
