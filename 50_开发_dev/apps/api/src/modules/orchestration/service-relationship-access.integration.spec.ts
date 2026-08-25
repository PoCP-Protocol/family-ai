import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { createHash, randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../../app.module';
import { bindTestAccountToFamilyTenant, cleanFamilyCoreTables, createTestPool } from '../../test/test-database';

let app: INestApplication;
let baseUrl = '';
let pool: pg.Pool;
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

beforeAll(async () => {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('REQUIRED_REAL_POSTGRESQL: TEST_DATABASE_URL is not set');
  process.env.DATABASE_URL = url;
  pool = createTestPool();
  await pool.query('select 1');
  app = await NestFactory.create(AppModule, { logger: ['error'] });
  await app.listen(0);
  baseUrl = await app.getUrl();
});
beforeEach(async () => cleanFamilyCoreTables(pool));
afterAll(async () => { await app?.close(); await pool?.end(); });

async function seed(): Promise<{ familyId: string; guardianId: string; childId: string; token: string; accountId: string }> {
  const familyId = (await pool.query(`insert into families(display_name) values ('Patch 4 家庭') returning family_id`)).rows[0].family_id;
  const guardianId = (await pool.query(`insert into persons(family_id, person_type, parent_role, display_name) values ($1,'PARENT','GUARDIAN','监护人') returning person_id`, [familyId])).rows[0].person_id;
  const childId = (await pool.query(`insert into persons(family_id, person_type, display_name, birth_date) values ($1,'CHILD','孩子','2012-06-01') returning person_id`, [familyId])).rows[0].person_id;
  await pool.query(`insert into consents(family_id, subject_person_id, guardian_person_id, purpose, status, policy_version, granted_at) values ($1,$2,$3,'SERVICE','GRANTED','patch4',now())`, [familyId, childId, guardianId]);
  await pool.query(`insert into consents(family_id, subject_person_id, guardian_person_id, purpose, status, policy_version, granted_at) values ($1,$2,$3,'AI_PERSONALIZATION','GRANTED','patch4',now())`, [familyId, childId, guardianId]);
  const accountId = (await pool.query(`insert into accounts(status) values ('ACTIVE') returning account_id`)).rows[0].account_id;
  await pool.query(`insert into account_person_bindings(account_id, person_id, status) values ($1,$2,'ACTIVE')`, [accountId, guardianId]);
  await pool.query(`insert into family_memberships(family_id, person_id, role, status, joined_at) values ($1,$2,'OWNER_GUARDIAN','ACTIVE',now())`, [familyId, guardianId]);
  await bindTestAccountToFamilyTenant(pool, accountId, familyId);
  const token = `patch4_${randomUUID()}`;
  await pool.query(`insert into identity_sessions(token_hash, account_ref, expires_at) values ($1,$2,now()+interval '1 day')`, [sha256(token), accountId]);
  return { familyId, guardianId, childId, token, accountId };
}

function headers(token: string, extra: Record<string, string> = {}) {
  return { 'content-type': 'application/json', cookie: `fam_session=${token}`, 'x-correlation-id': `patch4-${randomUUID()}`, ...extra };
}
async function request(path: string, token: string, method: 'GET' | 'POST', body?: unknown, extra: Record<string, string> = {}) {
  const response = await fetch(`${baseUrl}${path}`, { method, headers: headers(token, extra), ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, body: await response.json() };
}

async function createCase(seedData: Awaited<ReturnType<typeof seed>>) {
  const need = (await request(`/families/${seedData.familyId}/orchestration/needs`, seedData.token, 'POST', { subject_person_id: seedData.childId, raw_text: '孩子刚摔门，我想先恢复沟通' })).body;
  const intent = (await request(`/families/${seedData.familyId}/orchestration/intents`, seedData.token, 'POST', { signal_id: need.signal_id, goal_text: '先恢复沟通' })).body;
  const recommendation = (await request(`/families/${seedData.familyId}/orchestration/intents/${intent.intent_id}/recommendations`, seedData.token, 'POST', {})).body;
  return (await request(`/families/${seedData.familyId}/orchestration/decisions`, seedData.token, 'POST', {
    intent_id: intent.intent_id, recommendation_id: recommendation.recommendation_id, recommendation_version: recommendation.version,
    decision_type: 'ACCEPT_RECOMMENDATION', selected_offer_refs: recommendation.recommended_offer_refs,
  })).body.case_id as string;
}

describe('Patch 4 ServiceRelationship / CaseAccessGrant', () => {
  it('关系不等于访问权，授权可签发、读取和撤销', async () => {
    const s = await seed();
    const caseId = await createCase(s);
    const partyId = (await pool.query(`insert into parties(party_kind, display_name) values ('INDIVIDUAL','服务教师') returning party_id`)).rows[0].party_id;
    const relationship = await request(`/families/${s.familyId}/orchestration/service-relationships`, s.token, 'POST', {
      counterparty_party_id: partyId, purpose: 'SERVICE_DELIVERY',
    });
    expect(relationship.status).toBe(201);
    expect(relationship.body.status).toBe('ACTIVE');

    const empty = await request(`/families/${s.familyId}/orchestration/cases/${caseId}/access-grants`, s.token, 'GET');
    expect(empty.status).toBe(200);
    expect(empty.body.grants).toHaveLength(0);

    const grant = await request(`/families/${s.familyId}/orchestration/cases/${caseId}/access-grants`, s.token, 'POST', {
      relationship_id: relationship.body.service_relationship_id, grantee_party_id: partyId,
      scope: { service_case: 'summary', child_profile: 'minimum' }, purpose: 'SERVICE_DELIVERY',
      consent_snapshot_ref: 'consent:patch4:1', risk_level: 'STANDARD',
    });
    expect(grant.status).toBe(201);
    expect(grant.body.status).toBe('ACTIVE');

    const listed = await request(`/families/${s.familyId}/orchestration/cases/${caseId}/access-grants`, s.token, 'GET');
    expect(listed.body.grants).toHaveLength(1);
    expect(listed.body.grants[0]).toMatchObject({ grantee_party_id: partyId, revoked_at: null });

    const revoked = await request(`/families/${s.familyId}/orchestration/cases/${caseId}/access-grants/${grant.body.case_access_grant_id}/revoke`, s.token, 'POST', {});
    expect(revoked.status).toBe(201);
    expect(revoked.body.status).toBe('REVOKED');
    const after = await request(`/families/${s.familyId}/orchestration/cases/${caseId}/access-grants`, s.token, 'GET');
    expect(after.body.grants).toHaveLength(0);
    expect((await pool.query(`select revoked_at from case_access_grants where case_access_grant_id=$1`, [grant.body.case_access_grant_id])).rows[0].revoked_at).not.toBeNull();
  });

  it('没有 ServiceRelationship 时默认拒绝 CaseAccessGrant', async () => {
    const s = await seed();
    const caseId = await createCase(s);
    const partyId = (await pool.query(`insert into parties(party_kind, display_name) values ('INDIVIDUAL','未授权教师') returning party_id`)).rows[0].party_id;
    const response = await request(`/families/${s.familyId}/orchestration/cases/${caseId}/access-grants`, s.token, 'POST', {
      relationship_id: randomUUID(), grantee_party_id: partyId, scope: { service_case: 'summary' },
      purpose: 'SERVICE_DELIVERY', consent_snapshot_ref: 'consent:patch4:missing',
    });
    expect(response.status).toBe(403);
    expect((await pool.query(`select count(*)::int as n from case_access_grants`)).rows[0].n).toBe(0);
  });

  it('Service consent 撤回或关系终止后，已签发授权立即 fail closed', async () => {
    const s = await seed();
    const caseId = await createCase(s);
    const partyId = (await pool.query(`insert into parties(party_kind, display_name) values ('INDIVIDUAL','撤回测试教师') returning party_id`)).rows[0].party_id;
    const relationship = await request(`/families/${s.familyId}/orchestration/service-relationships`, s.token, 'POST', { counterparty_party_id: partyId, purpose: 'SERVICE_DELIVERY' });
    const grant = await request(`/families/${s.familyId}/orchestration/cases/${caseId}/access-grants`, s.token, 'POST', {
      relationship_id: relationship.body.service_relationship_id, grantee_party_id: partyId,
      scope: { service_case: 'summary' }, purpose: 'SERVICE_DELIVERY', consent_snapshot_ref: 'consent:patch4:2',
    });
    expect(grant.status).toBe(201);
    await pool.query(`update consents set status='WITHDRAWN', withdrawn_at=now() where family_id=$1 and purpose='SERVICE'`, [s.familyId]);
    expect((await request(`/families/${s.familyId}/orchestration/cases/${caseId}/access-grants`, s.token, 'GET')).body.grants).toHaveLength(0);
    await pool.query(`update service_relationships set status='TERMINATED', terminated_at=now() where service_relationship_id=$1`, [relationship.body.service_relationship_id]);
    expect((await pool.query(`select count(*)::int as n from case_access_grants`)).rows[0].n).toBe(1);
  });

  it('Account → Party → Grant 执行最小 Case projection，未绑定 Party 默认拒绝', async () => {
    const s = await seed();
    const caseId = await createCase(s);
    const teacherParty = (await pool.query(`insert into parties(party_kind, display_name) values ('INDIVIDUAL','投影教师') returning party_id`)).rows[0].party_id;
    await pool.query(`insert into account_party_bindings(account_id, party_id, status) values ($1,$2,'ACTIVE')`, [s.accountId, teacherParty]);
    const relationship = await request(`/families/${s.familyId}/orchestration/service-relationships`, s.token, 'POST', { counterparty_party_id: teacherParty, purpose: 'SERVICE_DELIVERY' });
    const grant = await request(`/families/${s.familyId}/orchestration/cases/${caseId}/access-grants`, s.token, 'POST', {
      relationship_id: relationship.body.service_relationship_id, grantee_party_id: teacherParty,
      scope: { service_case: 'summary' }, purpose: 'SERVICE_DELIVERY', consent_snapshot_ref: 'consent:patch4:projection',
    });
    expect(grant.status).toBe(201);
    const projection = await request(`/orchestration/case-access/${caseId}/projection`, s.token, 'GET');
    expect(projection.status).toBe(200);
    expect(projection.body.projection).toMatchObject({ case_id: caseId, status: expect.any(String) });
    expect(projection.body.projection).not.toHaveProperty('subject_person_id');
    await pool.query(`update account_party_bindings set status='REVOKED', valid_to=now() where account_id=$1 and party_id=$2`, [s.accountId, teacherParty]);
    expect((await request(`/orchestration/case-access/${caseId}/projection`, s.token, 'GET')).status).toBe(403);
  });
});
