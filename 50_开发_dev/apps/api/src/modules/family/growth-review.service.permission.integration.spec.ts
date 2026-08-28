import pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cleanFamilyCoreTables, createTestPool, getTestDatabaseUrl } from '../../test/test-database';
import { FamilyRepository } from './family.repository';
import { GrowthReviewService } from './growth-review.service';

// TASK: 修复 growth-review 权限校验缺失 tenancy 条件 —— 回归防护。
// 背景:growth-review.service.ts 曾有独立实现的 assertFamilyManagePermission,
// 只判定 legacy(CreateFamily 审计创建者),完全没有 tenancy(family_memberships
// ACTIVE OWNER_GUARDIAN/GUARDIAN)通过条件。已改为委托共享实现(family-permission.ts)。
// 这里通过 getTimeline (permission 校验最先执行、无需 intervention_episode 存在) 直接
// 验证两条通过条件与拒绝路径,不依赖完整的 episode/priority/consent 造数。
describe('GrowthReviewService assertFamilyManagePermission (bridged to shared family-permission)', () => {
  let pool: pg.Pool;
  let repository: FamilyRepository;
  let service: GrowthReviewService;

  beforeAll(() => {
    process.env.DATABASE_URL = getTestDatabaseUrl();
    pool = createTestPool();
    repository = new FamilyRepository();
    service = new GrowthReviewService(repository);
  });

  beforeEach(async () => {
    await cleanFamilyCoreTables(pool);
  });

  afterAll(async () => {
    await repository?.onModuleDestroy();
    await pool?.end();
  });

  async function seedFamily(): Promise<string> {
    const family = await pool.query(`insert into families(display_name) values ('权限回归测试家庭') returning family_id`);
    return family.rows[0].family_id as string;
  }

  it('allows the legacy CreateFamily audit actor (original behaviour preserved)', async () => {
    const familyId = await seedFamily();
    const creatorActorId = 'actor-legacy-creator';
    await pool.query(
      `insert into audit_logs(family_id, actor_type, actor_id, action_name, resource_type, resource_id, correlation_id, idempotency_key, result, metadata)
       values ($1,'USER',$2,'CreateFamily','Family',$3,'corr-legacy-seed','idem-legacy-seed','SUCCESS','{}'::jsonb)`,
      [familyId, creatorActorId, familyId],
    );

    await expect(
      service.getTimeline(familyId, '00000000-0000-4000-8000-000000000000', creatorActorId),
    ).rejects.toThrow('intervention_episode_not_found'); // 权限通过后,才会因为episode不存在报下一层错误

    const episodeCheckErrors: string[] = [];
    try {
      await service.getTimeline(familyId, '00000000-0000-4000-8000-000000000000', creatorActorId);
    } catch (error) {
      episodeCheckErrors.push((error as Error).message);
    }
    expect(episodeCheckErrors[0]).not.toContain('actor_has_family_manage_permission');
  });

  it('allows a family member who holds an ACTIVE OWNER_GUARDIAN/GUARDIAN membership but is NOT the CreateFamily audit actor — this is the fix under test', async () => {
    const familyId = await seedFamily();
    // 家庭是被别人(或系统)创建的,当前 actor 只是后来加入的、持有 ACTIVE GUARDIAN 家庭成员身份。
    await pool.query(
      `insert into audit_logs(family_id, actor_type, actor_id, action_name, resource_type, resource_id, correlation_id, idempotency_key, result, metadata)
       values ($1,'USER','actor-original-creator','CreateFamily','Family',$2,'corr-other-creator','idem-other-creator','SUCCESS','{}'::jsonb)`,
      [familyId, familyId],
    );
    const memberActorId = 'actor-tenancy-member-1';
    const person = await pool.query(
      `insert into persons(family_id, person_type, parent_role, display_name) values ($1,'PARENT','GUARDIAN','后加入的监护人') returning person_id`,
      [familyId],
    );
    const memberPersonId = person.rows[0].person_id as string;
    await pool.query(
      `insert into family_memberships(family_id, person_id, role, status, joined_at)
       values ($1,$2,'GUARDIAN','ACTIVE',now())`,
      [familyId, memberPersonId],
    );

    // 修复前:E 版本独立实现只查 audit_logs,该 actor 不是创建者 -> 会被错误 403(actor_has_family_manage_permission)。
    // 修复后:桥接共享实现,tenancy 条件命中 family_memberships -> 权限校验通过,报错应来自更下游的 episode 不存在,而不是权限。
    let caught: Error | undefined;
    try {
      await service.getTimeline(familyId, '00000000-0000-4000-8000-000000000000', memberPersonId);
    } catch (error) {
      caught = error as Error;
    }
    expect(caught).toBeDefined();
    expect(caught?.message).not.toBe('Forbidden');
    expect(caught?.message).not.toContain('actor_has_family_manage_permission');
    expect(caught?.message).toContain('intervention_episode_not_found');
  });

  it('still rejects an actor with neither legacy creator status nor an ACTIVE tenancy membership', async () => {
    const familyId = await seedFamily();
    await pool.query(
      `insert into audit_logs(family_id, actor_type, actor_id, action_name, resource_type, resource_id, correlation_id, idempotency_key, result, metadata)
       values ($1,'USER','actor-original-creator','CreateFamily','Family',$2,'corr-other-creator-2','idem-other-creator-2','SUCCESS','{}'::jsonb)`,
      [familyId, familyId],
    );

    await expect(
      service.getTimeline(familyId, '00000000-0000-4000-8000-000000000000', 'actor-with-no-relationship'),
    ).rejects.toThrow('actor_has_family_manage_permission');
  });
});
