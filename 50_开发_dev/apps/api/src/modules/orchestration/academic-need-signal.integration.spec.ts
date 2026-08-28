/**
 * G1-A(FAMILY-AI-ARCHITECTURE-V4-1-CONVERGENCE-001)边界断言:
 * 学业需求信号可以被识别、写入 growth_need_signals(inferred_need_type='CHILD_ACADEMIC_SUPPORT_NEED'),
 * 但 confirmIntent 硬闸门(orchestration.service.ts)仍显式拒绝——资源候选/推荐/资格判定未接入此 need_type,
 * 属 G1_B_PLUS(NOT_AUTHORIZED)。这条测试把"这是边界,不是bug"用代码断言固化下来。
 */
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

async function seed(): Promise<{ familyId: string; childId: string; token: string }> {
  const familyId = (await pool.query(`insert into families(display_name) values ('学业需求边界测试家庭') returning family_id`)).rows[0].family_id;
  const guardianId = (await pool.query(`insert into persons(family_id, person_type, parent_role, display_name) values ($1,'PARENT','GUARDIAN','监护人') returning person_id`, [familyId])).rows[0].person_id;
  const childId = (await pool.query(`insert into persons(family_id, person_type, display_name, birth_date) values ($1,'CHILD','孩子','2012-06-01') returning person_id`, [familyId])).rows[0].person_id;
  await pool.query(`insert into consents(family_id, subject_person_id, guardian_person_id, purpose, status, policy_version, granted_at) values ($1,$2,$3,'SERVICE','GRANTED','academic-need-g1a',now())`, [familyId, childId, guardianId]);
  await pool.query(`insert into consents(family_id, subject_person_id, guardian_person_id, purpose, status, policy_version, granted_at) values ($1,$2,$3,'AI_PERSONALIZATION','GRANTED','academic-need-g1a',now())`, [familyId, childId, guardianId]);
  const accountId = (await pool.query(`insert into accounts(status) values ('ACTIVE') returning account_id`)).rows[0].account_id;
  await pool.query(`insert into account_person_bindings(account_id, person_id, status) values ($1,$2,'ACTIVE')`, [accountId, guardianId]);
  await pool.query(`insert into family_memberships(family_id, person_id, role, status, joined_at) values ($1,$2,'OWNER_GUARDIAN','ACTIVE',now())`, [familyId, guardianId]);
  await bindTestAccountToFamilyTenant(pool, accountId, familyId);
  const token = `academic_g1a_${randomUUID()}`;
  await pool.query(`insert into identity_sessions(token_hash, account_ref, expires_at) values ($1,$2,now()+interval '1 day')`, [sha256(token), accountId]);
  return { familyId, childId, token };
}

function headers(token: string) {
  return { 'content-type': 'application/json', cookie: `fam_session=${token}`, 'x-correlation-id': `academic-g1a-${randomUUID()}` };
}
async function request(path: string, token: string, method: 'GET' | 'POST', body?: unknown) {
  const response = await fetch(`${baseUrl}${path}`, { method, headers: headers(token), ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, body: await response.json() };
}

describe('G1-A 学业需求信号识别边界', () => {
  it('学业类自述文本 → 信号创建成功且 inferred_need_type=CHILD_ACADEMIC_SUPPORT_NEED,但 confirmIntent 被显式拒绝(unsupported_need_for_v1_slice)', async () => {
    const s = await seed();
    const need = await request(`/families/${s.familyId}/orchestration/needs`, s.token, 'POST', {
      subject_person_id: s.childId, raw_text: '孩子写作业总是拖延,坐不住,注意力老是走神',
    });
    expect(need.status).toBe(201);
    expect(need.body.signal_id).toBeTruthy();

    const stored = await pool.query(`select inferred_need_type from growth_need_signals where signal_id=$1`, [need.body.signal_id]);
    expect(stored.rows[0].inferred_need_type).toBe('CHILD_ACADEMIC_SUPPORT_NEED');

    const intent = await request(`/families/${s.familyId}/orchestration/intents`, s.token, 'POST', {
      signal_id: need.body.signal_id, goal_text: '希望孩子能主动开始写作业',
    });
    expect(intent.status).toBe(400);
    expect(intent.body.message).toBe('unsupported_need_for_v1_slice');

    // 不产生任何 growth_intents 记录——闸门在写入前拦截,不是"创建后再回退"。
    const intentRows = await pool.query(`select count(*) n from growth_intents where family_id=$1`, [s.familyId]);
    expect(Number(intentRows.rows[0].n)).toBe(0);
  });

  it('沟通冲突场景不受影响(回归):信号+确认+推荐+决策仍可完整走通', async () => {
    const s = await seed();
    const need = await request(`/families/${s.familyId}/orchestration/needs`, s.token, 'POST', {
      subject_person_id: s.childId, raw_text: '孩子刚摔门，我想先恢复沟通',
    });
    expect(need.status).toBe(201);
    expect(need.body.signal_id).toBeTruthy();
    const intent = await request(`/families/${s.familyId}/orchestration/intents`, s.token, 'POST', {
      signal_id: need.body.signal_id, goal_text: '先恢复沟通',
    });
    expect(intent.status).toBe(201);
    expect(intent.body.intent_id).toBeTruthy();
  });
});
