import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../../app.module';
import { OrchestrationService } from './orchestration.service';
import { cleanFamilyCoreTables, createTestPool } from '../../test/test-database';

let app: INestApplication;
let pool: pg.Pool;
let svc: OrchestrationService;

beforeAll(async () => {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('REQUIRED_REAL_POSTGRESQL: TEST_DATABASE_URL is not set');
  process.env.DATABASE_URL = url;
  pool = createTestPool();
  await pool.query('select 1');
  app = await NestFactory.create(AppModule, { logger: ['error'] });
  await app.init();
  svc = app.get(OrchestrationService);
});
beforeEach(async () => cleanFamilyCoreTables(pool));
afterAll(async () => { await app?.close(); await pool?.end(); });

/** Builds a family + a service_case already carrying the frozen V1 collaboration blueprint
 * snapshot, by going through the real Need -> Intent -> Recommendation -> Decision flow
 * (the same path production traffic uses to open a case). */
async function seedCase(): Promise<{ familyId: string; subjectPersonId: string; caseId: string }> {
  const familyId = (await pool.query(`insert into families(display_name) values ('Allocation 家庭') returning family_id`)).rows[0].family_id;
  const guardianId = (await pool.query(`insert into persons(family_id, person_type, parent_role, display_name) values ($1,'PARENT','GUARDIAN','监护人') returning person_id`, [familyId])).rows[0].person_id;
  const childId = (await pool.query(`insert into persons(family_id, person_type, display_name, birth_date) values ($1,'CHILD','孩子','2012-06-01') returning person_id`, [familyId])).rows[0].person_id;
  await pool.query(`insert into consents(family_id, subject_person_id, guardian_person_id, purpose, status, policy_version, granted_at) values ($1,$2,$3,'SERVICE','GRANTED','alloc',now())`, [familyId, childId, guardianId]);
  await pool.query(`insert into consents(family_id, subject_person_id, guardian_person_id, purpose, status, policy_version, granted_at) values ($1,$2,$3,'AI_PERSONALIZATION','GRANTED','alloc',now())`, [familyId, childId, guardianId]);
  const correlationId = `alloc-${randomUUID()}`;
  const need = await svc.requestHelp(familyId, childId, guardianId, '孩子和我沟通总是吵起来', 'MANUAL', correlationId);
  const intent = await svc.confirmIntent(familyId, guardianId, need.signal_id, '先恢复沟通');
  const recommendation = await svc.recommend(familyId, intent.intent_id);
  const decision = await svc.decide({
    familyId, actorPersonId: guardianId, intentId: intent.intent_id, recommendationId: recommendation.recommendation_id,
    recommendationVersion: recommendation.version, decisionType: 'ACCEPT_RECOMMENDATION', selectedOfferRefs: recommendation.recommended_offer_refs,
    correlationId,
  });
  if (!decision.case_id) throw new Error('expected decision to open a service case');
  return { familyId, subjectPersonId: childId, caseId: decision.case_id };
}

/** Inserts a service_task directly in DELIVERED state so the test can drive verify()
 * without needing a real admitted-provider assignment chain (that's P0-002-D's concern). */
async function seedDeliveredTask(caseId: string, roleKey: string, taskKey: string, weight: number, responsibleRef: string): Promise<string> {
  return (await pool.query<{ task_id: string }>(
    `insert into service_tasks(case_ref, blueprint_ref, task_key, title, description, status, responsible_ref, role_key, task_weight)
     values ($1,'communication-21day-service-collab',$2,$3,$4,'DELIVERED',$5,$6,$7) returning task_id`,
    [caseId, taskKey, taskKey, taskKey, responsibleRef, roleKey, weight],
  )).rows[0].task_id;
}

describe('Service task allocation (P0-002-C case-level basis)', () => {
  it('splits DELIVERY_RESOURCE weight 1:2:1 into 10:20:10 and sums the whole case to exactly 100', async () => {
    const { familyId, caseId } = await seedCase();
    const stewardTask = await seedDeliveredTask(caseId, 'CASE_STEWARD', 'CASE_OPEN_AND_STEWARD', 1, 'steward-1');
    const contentTask = await seedDeliveredTask(caseId, 'CONTENT_RESOURCE', 'CONTENT_ACTIVATION', 1, 'content-1');
    const delivery1 = await seedDeliveredTask(caseId, 'DELIVERY_RESOURCE', 'DELIVERY_A', 1, 'provider-a');
    const delivery2 = await seedDeliveredTask(caseId, 'DELIVERY_RESOURCE', 'DELIVERY_B', 2, 'provider-b');
    const delivery3 = await seedDeliveredTask(caseId, 'DELIVERY_RESOURCE', 'DELIVERY_C', 1, 'provider-c');

    for (const taskId of [stewardTask, contentTask, delivery1, delivery2, delivery3]) {
      const result = await svc.verifyServiceTask({ familyId, caseId, taskId, reviewerRef: 'quality-reviewer-1', qualityState: 'PASSED' });
      expect(result.task.status).toBe('VERIFIED');
    }

    const finalized = await svc.finalizeShadowAllocation({ familyId, caseId, actorRef: 'ops-actor-1', helpfulness: 'HELPFUL' });
    expect(finalized.finalized).toBe(true);

    const byBucket = new Map(finalized.allocations.map((a) => [`${a.allocation_bucket}:${a.beneficiary_ref}`, Number(a.units)]));
    expect(byBucket.get('PLATFORM:PLATFORM')).toBe(20);
    expect(byBucket.get('CONTENT_RESOURCE:content-1')).toBe(15);
    expect(byBucket.get('CASE_STEWARD:steward-1')).toBe(15);
    expect(byBucket.get('QUALITY_RESERVE:QUALITY_RESERVE')).toBe(10);
    expect(byBucket.get('DELIVERY_RESOURCE:provider-a')).toBeCloseTo(10, 5);
    expect(byBucket.get('DELIVERY_RESOURCE:provider-b')).toBeCloseTo(20, 5);
    expect(byBucket.get('DELIVERY_RESOURCE:provider-c')).toBeCloseTo(10, 5);

    const total = finalized.allocations.reduce((sum, a) => sum + Number(a.units), 0);
    expect(total).toBeCloseTo(100, 5);

    // Case-level buckets must not borrow a contribution as their basis (P0-002-C item 1/5).
    const caseLevel = await pool.query(`select contribution_ref, basis_type, basis_ref, allocation_run_ref from service_contribution_allocations where case_ref=$1 and allocation_bucket in ('PLATFORM','QUALITY_RESERVE')`, [caseId]);
    for (const row of caseLevel.rows) {
      expect(row.contribution_ref).toBeNull();
      expect(row.basis_type).toBe('CASE');
      expect(row.basis_ref).toBe(caseId);
      expect(row.allocation_run_ref).not.toBeNull();
    }

    // Exactly one allocation run recorded the policy snapshot that produced this batch (P0-002-C item 1).
    const runs = await pool.query(`select policy_ref, policy_version, total_units, triggered_by_actor_ref from service_case_allocation_runs where case_ref=$1`, [caseId]);
    expect(runs.rows).toHaveLength(1);
    expect(runs.rows[0].policy_ref).toBe('communication-21day-service-collab');
    expect(runs.rows[0].policy_version).toBe(1);
    expect(Number(runs.rows[0].total_units)).toBeCloseTo(100, 5);
    expect(runs.rows[0].triggered_by_actor_ref).toBe('ops-actor-1');
  });

  it('repeated finalize is idempotent: no duplicate allocation rows or runs', async () => {
    const { familyId, caseId } = await seedCase();
    const stewardTask = await seedDeliveredTask(caseId, 'CASE_STEWARD', 'CASE_OPEN_AND_STEWARD', 1, 'steward-1');
    await svc.verifyServiceTask({ familyId, caseId, taskId: stewardTask, reviewerRef: 'quality-reviewer-1', qualityState: 'PASSED' });

    const first = await svc.finalizeShadowAllocation({ familyId, caseId, actorRef: 'ops-actor-1', helpfulness: 'HELPFUL' });
    expect(first.finalized).toBe(true);
    expect(first.allocations.length).toBeGreaterThan(0);

    const second = await svc.finalizeShadowAllocation({ familyId, caseId, actorRef: 'ops-actor-2', helpfulness: 'HELPFUL' });
    expect(second.finalized).toBe(true);
    expect(second.allocations).toHaveLength(0);

    const rows = await pool.query(`select count(*)::int as n from service_contribution_allocations where case_ref=$1`, [caseId]);
    expect(rows.rows[0].n).toBe(3); // PLATFORM + CASE_STEWARD + QUALITY_RESERVE, never duplicated
    const runs = await pool.query(`select count(*)::int as n from service_case_allocation_runs where case_ref=$1`, [caseId]);
    expect(runs.rows[0].n).toBe(1);
  });

  it('refuses to finalize without at least one VERIFIED contribution', async () => {
    const { familyId, caseId } = await seedCase();
    await seedDeliveredTask(caseId, 'CASE_STEWARD', 'CASE_OPEN_AND_STEWARD', 1, 'steward-1'); // delivered, never verified
    await expect(svc.finalizeShadowAllocation({ familyId, caseId, actorRef: 'ops-actor-1' })).rejects.toMatchObject({ message: 'verified_contribution_required' });
    const runs = await pool.query(`select count(*)::int as n from service_case_allocation_runs where case_ref=$1`, [caseId]);
    expect(runs.rows[0].n).toBe(0);
  });

  it('NOT_HELPFUL_YET keeps the quality reserve HELD while other buckets stay RELEASED-neutral (HELD by default)', async () => {
    const { familyId, caseId } = await seedCase();
    const stewardTask = await seedDeliveredTask(caseId, 'CASE_STEWARD', 'CASE_OPEN_AND_STEWARD', 1, 'steward-1');
    await svc.verifyServiceTask({ familyId, caseId, taskId: stewardTask, reviewerRef: 'quality-reviewer-1', qualityState: 'PASSED' });
    const finalized = await svc.finalizeShadowAllocation({ familyId, caseId, actorRef: 'ops-actor-1', helpfulness: 'NOT_HELPFUL_YET' });
    const reserve = finalized.allocations.find((a) => a.allocation_bucket === 'QUALITY_RESERVE');
    expect(reserve?.release_state).toBe('HELD');
  });
});
