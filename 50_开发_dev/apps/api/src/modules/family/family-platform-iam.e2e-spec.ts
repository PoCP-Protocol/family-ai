import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../../app.module';
import { AuthService } from '../auth/auth.service';
import { cleanFamilyCoreTables, createTestPool, getTestDatabaseUrl } from '../../test/test-database';

/**
 * PLATFORM-IAM-104 gate 证明:PLATFORM_AUTH_MODE=required 下,Family controller
 * CONSUMER_X_ACTOR_ID_TRUST=0 —— 仅 x-actor-id 必拒;Bearer→family scope;跨家庭 403。
 */
const BACKFILL = `
  INSERT INTO tenants (tenant_ref, display_name, tenant_type, status)
    VALUES ('TEST_RUNTIME', 'Family Automated Test Tenant', 'INTERNAL_SANDBOX', 'ACTIVE')
    ON CONFLICT (tenant_ref) DO UPDATE SET status='ACTIVE', updated_at=now();
  INSERT INTO accounts (external_ref) SELECT DISTINCT p.account_id FROM persons p
    WHERE p.account_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM accounts a WHERE a.external_ref=p.account_id);
  INSERT INTO account_person_bindings (account_id, person_id)
    SELECT a.account_id, p.person_id FROM persons p JOIN accounts a ON a.external_ref=p.account_id
    WHERE p.account_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM account_person_bindings b WHERE b.account_id=a.account_id AND b.person_id=p.person_id);
  INSERT INTO family_memberships (family_id, person_id, role, status, joined_at)
    SELECT p.family_id, p.person_id, 'OWNER_GUARDIAN'::family_role, 'ACTIVE'::family_membership_status, p.created_at
    FROM persons p WHERE NOT EXISTS (SELECT 1 FROM family_memberships m WHERE m.family_id=p.family_id AND m.person_id=p.person_id);
  INSERT INTO tenant_family_bindings(tenant_id, family_id, status, effective_from, migration_ref)
    SELECT t.tenant_id, f.family_id, 'ACTIVE'::tenant_binding_status, now(), 'TEST_PLATFORM_IAM'
    FROM tenants t CROSS JOIN families f
    WHERE t.tenant_ref='TEST_RUNTIME'
      AND NOT EXISTS (SELECT 1 FROM tenant_family_bindings tfb WHERE tfb.family_id=f.family_id AND tfb.status='ACTIVE');
  INSERT INTO tenant_account_memberships(tenant_id, account_id, role, status, valid_from)
    SELECT DISTINCT tfb.tenant_id, b.account_id, 'TENANT_VIEWER'::tenant_membership_role, 'ACTIVE'::tenant_membership_status, now()
    FROM account_person_bindings b
    JOIN family_memberships fm ON fm.person_id=b.person_id AND fm.status='ACTIVE'
    JOIN tenant_family_bindings tfb ON tfb.family_id=fm.family_id AND tfb.status='ACTIVE'
    ON CONFLICT (tenant_id, account_id) DO UPDATE SET status='ACTIVE', valid_to=null, updated_at=now();`;

describe('PLATFORM-IAM-104 Family controller bearer enforcement (required mode)', () => {
  let app: INestApplication; let baseUrl: string; let pool: pg.Pool; let auth: AuthService;
  const prev = process.env.PLATFORM_AUTH_MODE;

  beforeAll(async () => {
    process.env.DATABASE_URL = getTestDatabaseUrl();
    process.env.PLATFORM_AUTH_MODE = 'required';
    pool = createTestPool();
    app = await NestFactory.create(AppModule, { logger: ['error'] });
    auth = app.get(AuthService);
    await app.listen(0); baseUrl = await app.getUrl();
  });
  afterAll(async () => { await app.close(); await pool.end(); process.env.PLATFORM_AUTH_MODE = prev; });

  let famA: string; let famB: string;
  beforeEach(async () => {
    await cleanFamilyCoreTables(pool);   // 完整清理(含 growth/principal/consent + 新表 + primary_contact FK)
    famA = (await pool.query(`insert into families(display_name) values ('甲') returning family_id`)).rows[0].family_id;
    famB = (await pool.query(`insert into families(display_name) values ('乙') returning family_id`)).rows[0].family_id;
    await pool.query(`insert into persons(family_id,person_type,parent_role,display_name,account_id) values ($1,'PARENT','GUARDIAN','妈A','phone:A')`, [famA]);
    await pool.query(`insert into persons(family_id,person_type,parent_role,display_name,account_id) values ($1,'PARENT','GUARDIAN','妈B','phone:B')`, [famB]);
    await pool.query(BACKFILL);
  });

  const get = (path: string, headers: Record<string, string>) => fetch(`${baseUrl}${path}`, { headers });

  it('VALID_BEARER member(OWNER_GUARDIAN)→ GET family 200(成员↔领域权限桥接后)', async () => {
    // 成员角色→领域权限已桥接:ACTIVE OWNER_GUARDIAN 成员经 FamilyScopeGuard + assertFamilyManagePermission 均放行。
    const { token } = await auth.issueAccountSession('phone:A');
    const r = await get(`/families/${famA}`, { authorization: `Bearer ${token}` });
    expect(r.status).toBe(200);
  });
  it('VALID_BEARER → UI-01 trusted Tenant/Family home projection; cross-family remains forbidden', async () => {
    const { token } = await auth.issueAccountSession('phone:A');
    const response = await get(`/families/${famA}/ui/01/home`, { authorization: `Bearer ${token}` });
    expect(response.status).toBe(200);
    const body = await response.json() as Record<string, any>;
    expect(body).toMatchObject({ projection_version: 'UI01_FAMILY_HOME_V1', family_id: famA, entry_state: 'EMPTY' });
    expect(body.tenant_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.family).toMatchObject({ display_name: '甲', actor_scope: 'AUTHORIZED_FAMILY_MANAGER' });
    expect(body.feature_availability).toHaveLength(25);
    expect(body.ai_assistance).toMatchObject({ state: 'NOT_INVOKED', named_action: 'REQUEST_GROWTH_HELP' });
    expect(body.growth_help).toMatchObject({ state: 'NO_ELIGIBLE_SUBJECT', subjects: [], named_action: 'REQUEST_GROWTH_HELP' });
    expect((await get(`/families/${famB}/ui/01/home`, { authorization: `Bearer ${token}` })).status).toBe(403);
  });
  it('UI-01 returns every child availability and never selects a first child on the server', async () => {
    const guardianId = (await pool.query(`select person_id from persons where family_id=$1 and display_name='妈A'`, [famA])).rows[0].person_id;
    const childA = (await pool.query(`insert into persons(family_id,person_type,display_name,birth_date) values ($1,'CHILD','晨晨','2012-06-01') returning person_id`, [famA])).rows[0].person_id;
    const childB = (await pool.query(`insert into persons(family_id,person_type,display_name,birth_date) values ($1,'CHILD','星星','2013-06-01') returning person_id`, [famA])).rows[0].person_id;
    await pool.query(`insert into consents(family_id,subject_person_id,guardian_person_id,purpose,status,policy_version,granted_at) values ($1,$2,$3,'SERVICE','GRANTED','ui01-test',now())`, [famA, childA, guardianId]);
    const { token } = await auth.issueAccountSession('phone:A');

    const response = await get(`/families/${famA}/ui/01/home`, { authorization: `Bearer ${token}` });
    expect(response.status).toBe(200);
    const body = await response.json() as Record<string, any>;
    expect(body.entry_state).toBe('READY');
    expect(body.growth_help.state).toBe('AVAILABLE');
    expect(body.growth_help.subjects).toEqual([
      { person_id: childA, display_name: '晨晨', availability: 'AVAILABLE' },
      { person_id: childB, display_name: '星星', availability: 'CONSENT_REQUIRED' },
    ]);
    expect(JSON.stringify(body.growth_help)).not.toContain('selected');
  });
  it('x-actor-id ONLY (no bearer) → 401 (CONSUMER_X_ACTOR_ID_TRUST=0)', async () => {
    const r = await get(`/families/${famA}`, { 'x-actor-id': 'anyone' });
    expect(r.status).toBe(401);
  });
  it('NO auth → 401', async () => {
    expect((await get(`/families/${famA}`, {})).status).toBe(401);
  });
  it('CROSS_FAMILY (account A → family B) → 403', async () => {
    const { token } = await auth.issueAccountSession('phone:A');
    const r = await get(`/families/${famB}`, { authorization: `Bearer ${token}` });
    expect(r.status).toBe(403);
  });
  it('forged familyId → 403/401 (no membership)', async () => {
    const { token } = await auth.issueAccountSession('phone:A');
    const r = await get(`/families/00000000-0000-0000-0000-000000000000`, { authorization: `Bearer ${token}` });
    expect([401, 403]).toContain(r.status);
  });
});
