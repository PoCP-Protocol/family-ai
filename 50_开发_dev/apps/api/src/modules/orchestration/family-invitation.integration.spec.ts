import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { createHash, randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../../app.module';
import { bindTestAccountToFamilyTenant, cleanFamilyCoreTables, createTestPool } from '../../test/test-database';

/**
 * Verifies the growth-loop referral slice (database/migrations/0056_family_invitations.sql
 * + family-invitation.service.ts): a family creates a shareable code, another family
 * redeems it, attribution is recorded — and nothing else. No reward, discount, or
 * entitlement is granted anywhere in this path; that's a deliberately separate, unbuilt
 * decision (see the service's class-level comment).
 */

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

async function seed(label: string): Promise<{ familyId: string; guardianId: string; token: string }> {
  const familyId = (await pool.query(`insert into families(display_name) values ($1) returning family_id`, [`Invitation ${label} 家庭`])).rows[0].family_id;
  const guardianId = (await pool.query(`insert into persons(family_id, person_type, parent_role, display_name) values ($1,'PARENT','GUARDIAN','监护人') returning person_id`, [familyId])).rows[0].person_id;
  const accountId = (await pool.query(`insert into accounts(status) values ('ACTIVE') returning account_id`)).rows[0].account_id;
  await pool.query(`insert into account_person_bindings(account_id, person_id, status) values ($1,$2,'ACTIVE')`, [accountId, guardianId]);
  await pool.query(`insert into family_memberships(family_id, person_id, role, status, joined_at) values ($1,$2,'OWNER_GUARDIAN','ACTIVE',now())`, [familyId, guardianId]);
  await bindTestAccountToFamilyTenant(pool, accountId, familyId);
  const token = `invite_${label}_${randomUUID()}`;
  await pool.query(`insert into identity_sessions(token_hash, account_ref, expires_at) values ($1,$2,now()+interval '1 day')`, [sha256(token), accountId]);
  return { familyId, guardianId, token };
}

function headers(token: string, extra: Record<string, string> = {}) {
  return { 'content-type': 'application/json', cookie: `fam_session=${token}`, 'x-correlation-id': `invite-${randomUUID()}`, ...extra };
}
async function request(path: string, token: string, method: 'GET' | 'POST', body?: unknown) {
  const response = await fetch(`${baseUrl}${path}`, { method, headers: headers(token), ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, body: await response.json() };
}

describe('DEV growth-loop referral — invitation creation, redemption, attribution', () => {
  it('创建邀请码 -> 另一家庭兑换 -> 记录归因，且邀请码只能兑换一次', async () => {
    const inviter = await seed('inviter');
    const invitee = await seed('invitee');

    const created = await request(`/families/${inviter.familyId}/orchestration/invitations`, inviter.token, 'POST', { campaign_ref: 'SUMMER_2026', channel: 'WECHAT' });
    expect(created.status).toBe(201);
    expect(created.body.status).toBe('PENDING');
    expect(created.body.invitation_code).toMatch(/^[A-Z0-9]{8}$/);

    const accept = await request(`/families/${invitee.familyId}/orchestration/invitations/accept`, invitee.token, 'POST', { invitation_code: created.body.invitation_code });
    expect(accept.status).toBe(201);
    expect(accept.body.inviting_family_id).toBe(inviter.familyId);

    const list = await request(`/families/${inviter.familyId}/orchestration/invitations`, inviter.token, 'GET');
    expect(list.status).toBe(200);
    expect(list.body.invitations).toHaveLength(1);
    expect(list.body.invitations[0].status).toBe('ACCEPTED');
    expect(list.body.invitations[0].accepted_by_family_id).toBe(invitee.familyId);

    // Same code cannot be redeemed twice, even by a third family.
    const thirdFamily = await seed('third');
    const secondAttempt = await request(`/families/${thirdFamily.familyId}/orchestration/invitations/accept`, thirdFamily.token, 'POST', { invitation_code: created.body.invitation_code });
    expect(secondAttempt.status).toBe(400);
    expect(secondAttempt.body.message).toBe('invitation_code_invalid_or_already_used');
  });

  it('拒绝自己家庭兑换自己发出的邀请码', async () => {
    const family = await seed('self');
    const created = await request(`/families/${family.familyId}/orchestration/invitations`, family.token, 'POST', {});
    expect(created.status).toBe(201);

    const selfAccept = await request(`/families/${family.familyId}/orchestration/invitations/accept`, family.token, 'POST', { invitation_code: created.body.invitation_code });
    expect(selfAccept.status).toBe(400);
    expect(selfAccept.body.message).toBe('invitation_code_invalid_or_already_used');
  });

  it('无效/不存在的邀请码兑换失败，不产生任何记录', async () => {
    const family = await seed('bogus');
    const accept = await request(`/families/${family.familyId}/orchestration/invitations/accept`, family.token, 'POST', { invitation_code: 'NOTAREAL' });
    expect(accept.status).toBe(400);
    expect(accept.body.message).toBe('invitation_code_invalid_or_already_used');
  });
});
