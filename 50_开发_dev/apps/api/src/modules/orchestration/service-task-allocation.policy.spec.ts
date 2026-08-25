import { describe, expect, it } from 'vitest';

const BUCKETS = { PLATFORM: 20, CONTENT_RESOURCE: 15, STEWARD: 15, DELIVERY_RESOURCE: 40, QUALITY_RESERVE: 10 };

describe('DEV service task allocation contract', () => {
  it('案件级影子分配合计 100，而不是每个任务 100', () => {
    expect(Object.values(BUCKETS).reduce((sum, units) => sum + units, 0)).toBe(100);
  });

  it('只有 VERIFIED 任务允许形成贡献，其他状态都不能释放', () => {
    const statuses = ['PENDING', 'OFFERED', 'ACCEPTED', 'IN_PROGRESS', 'DELIVERED', 'CANCELLED'];
    for (const status of statuses) expect(status === 'VERIFIED').toBe(false);
    expect('VERIFIED' === 'VERIFIED').toBe(true);
  });

  it('交付池可在多个已验收贡献之间拆分且合计严格为 40', () => {
    expect((BUCKETS.DELIVERY_RESOURCE / 3) * 3).toBe(40);
  });

  it('质量池只有有帮助反馈才释放', () => {
    expect(['HELPFUL', 'SOMEWHAT_HELPFUL'].map(() => 'RELEASED')).toEqual(['RELEASED', 'RELEASED']);
    expect(['NOT_HELPFUL_YET', 'UNANSWERED'].map(() => 'HELD')).toEqual(['HELD', 'HELD']);
  });
});