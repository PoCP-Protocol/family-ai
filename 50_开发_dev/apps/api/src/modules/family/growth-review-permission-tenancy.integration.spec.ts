import pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cleanFamilyCoreTables, createTestPool, getTestDatabaseUrl } from '../../test/test-database';
import { FamilyRepository } from './family.repository';
import { FamilyService } from './family.service';
import { GrowthReviewService } from './growth-review.service';

/**
 * 回归测试:assertFamilyManagePermission 在 growth-review.service.ts 内曾是一份独立复制,
 * 只判"是否为 CreateFamily 审计主体",漏了 family-permission.ts 共享实现里的
 * ACTIVE OWNER_GUARDIAN/GUARDIAN family_memberships 判定 —— 导致合法家庭成员(非创建者)
 * 在 recordOutcomeObservation/completeGrowthReview/recordNextStepDecision/getTimeline
 * 上被误 403。此处只验证权限判定本身,不需要搭建完整 intervention_episode:
 * 用一个不存在的 episode_id 调用 getTimeline —— 权限通过后应止步于
 * NotFoundException(intervention_episode_not_found),而不是 ForbiddenException。
 */
describe('GrowthReviewService assertFamilyManagePermission tenancy gap (regression)', () => {
  let pool: pg.Pool;
  let repository: FamilyRepository;
  let familyService: FamilyService;
  let growthReviewService: GrowthReviewService;

  beforeAll(() => {
    process.env.DATABASE_URL = getTestDatabaseUrl();
    pool = createTestPool();
    repository = new FamilyRepository();
    familyService = new FamilyService(repository);
    growthReviewService = new GrowthReviewService(repository);
  });

  beforeEach(async () => {
    await cleanFamilyCoreTables(pool);
  });

  afterAll(async () => {
    await repository?.onModuleDestroy();
    await pool?.end();
  });

  it('ACTIVE GUARDIAN member who is NOT the CreateFamily auditor passes the permission check (proceeds to a legitimate 404, not 403)', async () => {
    const creatorMeta = testMeta('creator-1', 'corr-permission-gap-1');
    const family = await familyService.createFamily({ display_name: '权限回归测试家庭', idempotency_key: 'idem-perm-gap-family-1' }, creatorMeta);
    const familyId = family.family.family_id;

    const memberPersonId = (
      await pool.query(
        `insert into persons(family_id, person_type, parent_role, display_name) values ($1, 'PARENT', 'GUARDIAN', '非创建者监护人') returning person_id`,
        [familyId],
      )
    ).rows[0].person_id;
    await pool.query(
      `insert into family_memberships(family_id, person_id, role, status, joined_at) values ($1, $2, 'GUARDIAN', 'ACTIVE', now())`,
      [familyId, memberPersonId],
    );

    await expect(growthReviewService.getTimeline(familyId, '00000000-0000-0000-0000-000000000000', memberPersonId)).rejects.toMatchObject({
      status: 404,
      message: 'intervention_episode_not_found',
    });
  });

  it('a person with no family_memberships row and no CreateFamily audit is still rejected with 403 (fix does not loosen the boundary)', async () => {
    const creatorMeta = testMeta('creator-2', 'corr-permission-gap-2');
    const family = await familyService.createFamily({ display_name: '权限回归测试家庭2', idempotency_key: 'idem-perm-gap-family-2' }, creatorMeta);
    const familyId = family.family.family_id;

    await expect(growthReviewService.getTimeline(familyId, '00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111')).rejects.toMatchObject({
      status: 403,
      message: 'actor_has_family_manage_permission',
    });
  });
});

function testMeta(actor: string, correlationId: string) {
  return {
    actor,
    correlationId,
    source: 'vitest',
    occurredAt: new Date().toISOString(),
  };
}
