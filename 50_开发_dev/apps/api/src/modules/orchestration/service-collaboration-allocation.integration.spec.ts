import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { createHash, randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../../app.module';
import { bindTestAccountToFamilyTenant, cleanFamilyCoreTables, createTestPool } from '../../test/test-database';

/**
 * Verifies two fixes made to the DEV service collaboration allocation slice
 * (database/migrations/0055_service_collaboration_allocation_policy.sql):
 *
 * 1. finalizeShadowAllocation now reads bucket percentages from the case's frozen
 *    collaboration_blueprint_snapshot.allocation_policy instead of a hardcoded
 *    20/15/15/40/10 literal — this test asserts the allocation actually reflects the
 *    seeded blueprint's policy, not a coincidentally-matching constant.
 * 2. verifyServiceTask now rejects a reviewer who was never assigned the
 *    QUALITY_REVIEWER role on this case, even if they aren't the delivery person.
 *
 * Uses CASE_STEWARD / CONTENT_RESOURCE / QUALITY_REVIEWER roles (not
 * DELIVERY_RESOURCE/HUMAN_COACH) to avoid needing a real provider_admissions +
 * teacher_capabilities + case_access_grants setup, which is orthogonal to what's
 * being verified here.
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
beforeEach(async () => {
  await cleanFamilyCoreTables(pool);
  // This suite's "different blueprint version" test seeds a v2 row for the shared
  // blueprint_ref and only ever flips its status afterward (blueprint history is meant to
  // be immutable — no test here deletes a blueprint row). A prior run of this suite (or
  // an aborted one) can leave that v2 row ACTIVE, which would make every other test in
  // this file freeze new cases onto v2 instead of v1. Force it back to a known starting
  // state before every test, not just after the one test that creates it.
  await pool.query(`update service_collaboration_blueprints set status='RETIRED' where blueprint_ref=$1 and version=2`, [BLUEPRINT_REF]);
});
// cleanFamilyCoreTables doesn't cover the service_tasks/task_assignments/
// service_contributions chain this suite creates directly against service_cases (via
// createServiceTask), so clean it here in FK-safe order — otherwise a failed/aborted test
// leaves rows that break the next test's cleanFamilyCoreTables delete on service_cases.
afterEach(async () => {
  await pool.query('delete from service_followup_responses');
  await pool.query('delete from service_contribution_allocations');
  await pool.query('delete from service_contributions');
  await pool.query('delete from task_quality_reviews');
  await pool.query('delete from task_assignments');
  await pool.query('delete from service_tasks');
  // The "different blueprint version" test inserts a v2 row for the shared blueprint_ref
  // and never deletes it (blueprint history is meant to be immutable, not a per-test
  // fixture) — retire it here so later tests in this suite go back to freezing onto v1,
  // matching what they assert. Real blueprint retirement is exactly this: flip status, keep
  // the row for any case that already froze onto it.
  await pool.query(`update service_collaboration_blueprints set status='RETIRED' where blueprint_ref=$1 and version=2`, [BLUEPRINT_REF]);
});
afterAll(async () => { await app?.close(); await pool?.end(); });

async function seed(): Promise<{ familyId: string; guardianId: string; childId: string; token: string; accountId: string }> {
  const familyId = (await pool.query(`insert into families(display_name) values ('Collab Allocation 家庭') returning family_id`)).rows[0].family_id;
  const guardianId = (await pool.query(`insert into persons(family_id, person_type, parent_role, display_name) values ($1,'PARENT','GUARDIAN','监护人') returning person_id`, [familyId])).rows[0].person_id;
  const childId = (await pool.query(`insert into persons(family_id, person_type, display_name, birth_date) values ($1,'CHILD','孩子','2012-06-01') returning person_id`, [familyId])).rows[0].person_id;
  await pool.query(`insert into consents(family_id, subject_person_id, guardian_person_id, purpose, status, policy_version, granted_at) values ($1,$2,$3,'SERVICE','GRANTED','collab-alloc',now())`, [familyId, childId, guardianId]);
  await pool.query(`insert into consents(family_id, subject_person_id, guardian_person_id, purpose, status, policy_version, granted_at) values ($1,$2,$3,'AI_PERSONALIZATION','GRANTED','collab-alloc',now())`, [familyId, childId, guardianId]);
  const accountId = (await pool.query(`insert into accounts(status) values ('ACTIVE') returning account_id`)).rows[0].account_id;
  await pool.query(`insert into account_person_bindings(account_id, person_id, status) values ($1,$2,'ACTIVE')`, [accountId, guardianId]);
  await pool.query(`insert into family_memberships(family_id, person_id, role, status, joined_at) values ($1,$2,'OWNER_GUARDIAN','ACTIVE',now())`, [familyId, guardianId]);
  await bindTestAccountToFamilyTenant(pool, accountId, familyId);
  const token = `collab_alloc_${randomUUID()}`;
  await pool.query(`insert into identity_sessions(token_hash, account_ref, expires_at) values ($1,$2,now()+interval '1 day')`, [sha256(token), accountId]);
  return { familyId, guardianId, childId, token, accountId };
}

function headers(token: string, extra: Record<string, string> = {}) {
  return { 'content-type': 'application/json', cookie: `fam_session=${token}`, 'x-correlation-id': `collab-alloc-${randomUUID()}`, ...extra };
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

const BLUEPRINT_REF = 'communication-21day-service-collab';

async function openAndVerifyTask(s: Awaited<ReturnType<typeof seed>>, caseId: string, taskKey: string, title: string, assigneeRef: string, reviewerRef: string) {
  const task = (await request(`/families/${s.familyId}/orchestration/cases/${caseId}/tasks`, s.token, 'POST', {
    blueprint_ref: BLUEPRINT_REF, task_key: taskKey, title, description: title,
  })).body;
  await request(`/families/${s.familyId}/orchestration/cases/${caseId}/tasks/${task.task_id}/assign`, s.token, 'POST', { assignee_ref: assigneeRef });
  await request(`/families/${s.familyId}/orchestration/cases/${caseId}/tasks/${task.task_id}/deliver`, s.token, 'POST', { deliverable: { note: 'done' } });
  return request(`/families/${s.familyId}/orchestration/cases/${caseId}/tasks/${task.task_id}/verify`, s.token, 'POST', { reviewer_ref: reviewerRef, quality_state: 'PASSED' });
}

describe('DEV service collaboration allocation — policy-driven buckets and reviewer role check', () => {
  it('finalizeShadowAllocation 分配比例来自 blueprint.allocation_policy，不是硬编码常量', async () => {
    const s = await seed();
    const caseId = await createCase(s);

    // Assign a QUALITY_REVIEWER-role task first so a real reviewer identity exists for
    // the CASE_STEWARD task's verify step below.
    const reviewerTask = (await request(`/families/${s.familyId}/orchestration/cases/${caseId}/tasks`, s.token, 'POST', {
      blueprint_ref: BLUEPRINT_REF, task_key: 'CLOSURE_QUALITY_REVIEW', title: '结案质量审核', description: '结案质量审核',
    })).body;
    await request(`/families/${s.familyId}/orchestration/cases/${caseId}/tasks/${reviewerTask.task_id}/assign`, s.token, 'POST', { assignee_ref: 'reviewer-1' });

    const stewardVerify = await openAndVerifyTask(s, caseId, 'CASE_OPEN_AND_STEWARD', '开案与管家', 'steward-1', 'reviewer-1');
    expect(stewardVerify.status).toBe(201);
    expect(stewardVerify.body.task.status).toBe('VERIFIED');

    const finalize = await request(`/families/${s.familyId}/orchestration/cases/${caseId}/shadow-allocation/finalize`, s.token, 'POST', { helpfulness: 'HELPFUL' });
    expect(finalize.status).toBe(201);
    expect(finalize.body.finalized).toBe(true);

    const buckets: Record<string, number> = {};
    for (const allocation of finalize.body.allocations) buckets[allocation.allocation_bucket] = Number(allocation.units);

    // These values come from the seeded blueprint (0055 migration)'s allocation_policy.buckets,
    // not a copy of the same numbers hardcoded in orchestration.service.ts — if the fix
    // regressed to reading a local constant instead, this test would still pass (same
    // numbers), so the real assertion is in the next test: a blueprint with *different*
    // numbers must change the output.
    expect(buckets.PLATFORM).toBe(20);
    expect(buckets.CASE_STEWARD).toBe(15);
    expect(buckets.QUALITY_RESERVE).toBe(10);
    const total = Object.values(buckets).reduce((sum, units) => sum + units, 0);
    expect(total).toBeLessThanOrEqual(100.0001);
  });

  it('修改 blueprint 的 allocation_policy 后新 case 的分配比例随之改变（证明真正读取 policy 而非硬编码）', async () => {
    // Seed a second, differently-weighted version of the same blueprint_ref so this case
    // freezes onto it instead of v1.
    await pool.query(
      `insert into service_collaboration_blueprints (blueprint_ref, version, applicable_program_ref, roles, task_templates, assignment_rules, required_capability_keys, allocation_policy, release_rules, status, checksum)
       values ($1, 2, 'communication-21day',
         '[{"role_key":"CASE_STEWARD","resource_type":"INTERNAL_ACTOR"},{"role_key":"CONTENT_RESOURCE","resource_type":"CATALOG_RESOURCE"},{"role_key":"DELIVERY_RESOURCE","resource_type":"ADMITTED_PROVIDER"},{"role_key":"QUALITY_REVIEWER","resource_type":"INTERNAL_ACTOR"}]'::jsonb,
         '[{"task_key":"CASE_OPEN_AND_STEWARD","role_key":"CASE_STEWARD","weight":1},{"task_key":"CONTENT_ACTIVATION","role_key":"CONTENT_RESOURCE","weight":1},{"task_key":"AI_GUIDANCE_DELIVERY","role_key":"DELIVERY_RESOURCE","weight":1},{"task_key":"HUMAN_HANDOFF","role_key":"DELIVERY_RESOURCE","weight":1,"conditional":true},{"task_key":"CLOSURE_QUALITY_REVIEW","role_key":"QUALITY_REVIEWER","weight":1}]'::jsonb,
         '{"one_steward":true,"one_accepted_assignment_per_task":true,"provider_validation":"ACTIVE_ADMITTED_CAPABILITY_RELATION_GRANT","reviewer_must_differ_from_delivery":true}'::jsonb,
         '[]'::jsonb,
         '{"total_units":100,"buckets":{"PLATFORM":30,"CONTENT_RESOURCE":10,"CASE_STEWARD":25,"DELIVERY_RESOURCE":25,"QUALITY_RESERVE":10},"basis":"SERVICE_CONTRIBUTION_AND_QUALITY","delivery_split":"WEIGHTED_VERIFIED_CONTRIBUTIONS"}'::jsonb,
         '{"quality_reserve_default":"HELD","helpful":"RELEASE","somewhat_helpful":"RELEASE","not_helpful_yet":"HELD_AND_REWORK","unanswered":"HELD"}'::jsonb,
         'ACTIVE', 'test:v2:different-weights')
       on conflict (blueprint_ref, version) do update set status='ACTIVE'`,
      [BLUEPRINT_REF],
    );

    const s = await seed();
    const caseId = await createCase(s);

    const reviewerTask = (await request(`/families/${s.familyId}/orchestration/cases/${caseId}/tasks`, s.token, 'POST', {
      blueprint_ref: BLUEPRINT_REF, task_key: 'CLOSURE_QUALITY_REVIEW', title: '结案质量审核', description: '结案质量审核',
    })).body;
    await request(`/families/${s.familyId}/orchestration/cases/${caseId}/tasks/${reviewerTask.task_id}/assign`, s.token, 'POST', { assignee_ref: 'reviewer-2' });
    const stewardVerify = await openAndVerifyTask(s, caseId, 'CASE_OPEN_AND_STEWARD', '开案与管家', 'steward-2', 'reviewer-2');
    expect(stewardVerify.status).toBe(201);

    const finalize = await request(`/families/${s.familyId}/orchestration/cases/${caseId}/shadow-allocation/finalize`, s.token, 'POST', { helpfulness: 'HELPFUL' });
    expect(finalize.status).toBe(201);
    const buckets: Record<string, number> = {};
    for (const allocation of finalize.body.allocations) buckets[allocation.allocation_bucket] = Number(allocation.units);

    // This case picked up blueprint v2 (PLATFORM:30, CASE_STEWARD:25, QUALITY_RESERVE:10) —
    // different from v1's (PLATFORM:20, CASE_STEWARD:15). If the code were still reading a
    // hardcoded constant, these would come out as 20/15 regardless of which blueprint
    // version the case froze onto.
    expect(buckets.PLATFORM).toBe(30);
    expect(buckets.CASE_STEWARD).toBe(25);
  });

  it('verify 拒绝未被分配 QUALITY_REVIEWER 角色的审核人，即使该人不是交付人本人', async () => {
    const s = await seed();
    const caseId = await createCase(s);

    const task = (await request(`/families/${s.familyId}/orchestration/cases/${caseId}/tasks`, s.token, 'POST', {
      blueprint_ref: BLUEPRINT_REF, task_key: 'CASE_OPEN_AND_STEWARD', title: '开案与管家', description: '开案与管家',
    })).body;
    await request(`/families/${s.familyId}/orchestration/cases/${caseId}/tasks/${task.task_id}/assign`, s.token, 'POST', { assignee_ref: 'steward-3' });
    await request(`/families/${s.familyId}/orchestration/cases/${caseId}/tasks/${task.task_id}/deliver`, s.token, 'POST', { deliverable: { note: 'done' } });

    // 'random-person-not-assigned-anything' is not the delivery person (steward-3), so the
    // old reviewer_must_differ_from_delivery check alone would let this through. It also
    // was never assigned a QUALITY_REVIEWER-role task on this case, so the new check must
    // reject it.
    const verify = await request(`/families/${s.familyId}/orchestration/cases/${caseId}/tasks/${task.task_id}/verify`, s.token, 'POST', {
      reviewer_ref: 'random-person-not-assigned-anything', quality_state: 'PASSED',
    });
    expect(verify.status).toBe(403);
    expect(verify.body.message).toBe('reviewer_not_assigned_quality_reviewer_role');
  });
});

/**
 * Verifies the result three-way classification (behavioral / subjective /
 * verifiable_candidates), activating service_followup_responses.truth_class (migration
 * 0020's PERSPECTIVE/SERVICE_NOTE/OBSERVATION_CANDIDATE enum) instead of the previous
 * hardcoded 'SERVICE_NOTE' literal on every submitFollowUp call.
 */
describe('DEV service collaboration result triage — behavioral/subjective/verifiable_candidates', () => {
  it('纯满意度回访归类为 PERSPECTIVE，且不影响既有 release_state 分配副作用', async () => {
    const s = await seed();
    const caseId = await createCase(s);
    await request(`/families/${s.familyId}/orchestration/cases/${caseId}/tasks`, s.token, 'POST', {
      blueprint_ref: BLUEPRINT_REF, task_key: 'CASE_OPEN_AND_STEWARD', title: '开案与管家', description: '开案与管家',
    });
    await pool.query(`update service_cases set status='WAITING_FAMILY' where case_id=$1`, [caseId]);

    const followUp = await request(`/families/${s.familyId}/orchestration/cases/${caseId}/followups`, s.token, 'POST', { helpfulness: 'HELPFUL', text: '感觉这周好一些了' });
    expect(followUp.status).toBe(201);

    const caseRow = await pool.query(`select status from service_cases where case_id=$1`, [caseId]);
    expect(caseRow.rows[0].status).toBe('COMPLETED');

    const truthClassRow = await pool.query(`select truth_class from service_followup_responses where followup_id=$1`, [followUp.body.followup_id]);
    expect(truthClassRow.rows[0].truth_class).toBe('PERSPECTIVE');

    const summary = await request(`/families/${s.familyId}/orchestration/cases/${caseId}/result-summary`, s.token, 'GET');
    expect(summary.status).toBe(200);
    expect(summary.body.subjective).toHaveLength(1);
    expect(summary.body.subjective[0].helpfulness).toBe('HELPFUL');
    expect(summary.body.verifiable_candidates).toHaveLength(0);
  });

  it('带 observation_candidate 的回访归类为 OBSERVATION_CANDIDATE，且带边界声明不被误当作已验证结果', async () => {
    const s = await seed();
    const caseId = await createCase(s);
    const task = (await request(`/families/${s.familyId}/orchestration/cases/${caseId}/tasks`, s.token, 'POST', {
      blueprint_ref: BLUEPRINT_REF, task_key: 'CASE_OPEN_AND_STEWARD', title: '开案与管家', description: '开案与管家',
    })).body;
    await request(`/families/${s.familyId}/orchestration/cases/${caseId}/tasks/${task.task_id}/assign`, s.token, 'POST', { assignee_ref: 'steward-4' });
    await request(`/families/${s.familyId}/orchestration/cases/${caseId}/tasks/${task.task_id}/deliver`, s.token, 'POST', { deliverable: { note: 'done' } });

    const followUp = await request(`/families/${s.familyId}/orchestration/cases/${caseId}/followups`, s.token, 'POST', {
      helpfulness: 'SOMEWHAT_HELPFUL',
      text: '孩子这周主动说了一次心事',
      observation_candidate: { agreed_item: '孩子每周至少主动和家长说一次心事', achieved: true },
    });
    expect(followUp.status).toBe(201);

    const truthClassRow = await pool.query(`select truth_class from service_followup_responses where followup_id=$1`, [followUp.body.followup_id]);
    expect(truthClassRow.rows[0].truth_class).toBe('OBSERVATION_CANDIDATE');

    const summary = await request(`/families/${s.familyId}/orchestration/cases/${caseId}/result-summary`, s.token, 'GET');
    expect(summary.status).toBe(200);
    expect(summary.body.verifiable_candidates).toHaveLength(1);
    expect(summary.body.verifiable_candidates[0].agreed_item).toBe('孩子每周至少主动和家长说一次心事');
    expect(summary.body.verifiable_candidates[0].achieved).toBe(true);
    // The boundary field is what stops this from being read as an already-verified
    // outcome — a candidate observation still requires human review to count, matching
    // the growth_reviews table's boundary CHECK constraint pattern (0009 migration).
    expect(summary.body.verifiable_candidates[0].boundary).toBe('OBSERVATION_CANDIDATE_NOT_VERIFIED_RESULT');
    // subjective should still carry the same followup's helpfulness reading separately —
    // no, actually: a single followup is classified into exactly one truth_class, so this
    // one should NOT also appear in subjective (that would double-count one submission
    // across two categories).
    expect(summary.body.subjective).toHaveLength(0);
  });

  it('behavioral 计数来自 service_tasks 状态，不依赖任何回访提交', async () => {
    const s = await seed();
    const caseId = await createCase(s);
    const task1 = (await request(`/families/${s.familyId}/orchestration/cases/${caseId}/tasks`, s.token, 'POST', {
      blueprint_ref: BLUEPRINT_REF, task_key: 'CASE_OPEN_AND_STEWARD', title: '开案与管家', description: '开案与管家',
    })).body;
    await request(`/families/${s.familyId}/orchestration/cases/${caseId}/tasks/${task1.task_id}/assign`, s.token, 'POST', { assignee_ref: 'steward-5' });
    await request(`/families/${s.familyId}/orchestration/cases/${caseId}/tasks/${task1.task_id}/deliver`, s.token, 'POST', { deliverable: { note: 'done' } });

    const summaryBeforeVerify = await request(`/families/${s.familyId}/orchestration/cases/${caseId}/result-summary`, s.token, 'GET');
    expect(summaryBeforeVerify.body.behavioral).toEqual({ total_tasks: 1, verified_tasks: 0, delivered_tasks: 1 });

    const reviewerTask = (await request(`/families/${s.familyId}/orchestration/cases/${caseId}/tasks`, s.token, 'POST', {
      blueprint_ref: BLUEPRINT_REF, task_key: 'CLOSURE_QUALITY_REVIEW', title: '结案质量审核', description: '结案质量审核',
    })).body;
    await request(`/families/${s.familyId}/orchestration/cases/${caseId}/tasks/${reviewerTask.task_id}/assign`, s.token, 'POST', { assignee_ref: 'reviewer-5' });
    await request(`/families/${s.familyId}/orchestration/cases/${caseId}/tasks/${task1.task_id}/verify`, s.token, 'POST', { reviewer_ref: 'reviewer-5', quality_state: 'PASSED' });

    const summaryAfterVerify = await request(`/families/${s.familyId}/orchestration/cases/${caseId}/result-summary`, s.token, 'GET');
    expect(summaryAfterVerify.body.behavioral).toEqual({ total_tasks: 2, verified_tasks: 1, delivered_tasks: 0 });
  });
});
