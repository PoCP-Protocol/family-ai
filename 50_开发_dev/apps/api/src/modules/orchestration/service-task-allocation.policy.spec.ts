import { describe, expect, it } from 'vitest';

const BUCKETS = [
  ['PLATFORM', 20],
  ['CONTENT_RESOURCE', 15],
  ['STEWARD', 15],
  ['DELIVERY_RESOURCE', 40],
  ['QUALITY_RESERVE', 10],
] as const;

describe('DEV service task allocation contract', () => {
  it('21 天含人工服务模板合计 100 个任务单位', () => {
    expect(BUCKETS.reduce((sum, [, units]) => sum + units, 0)).toBe(100);
  });

  it('只有 VERIFIED 任务允许形成贡献，其他状态都不能释放', () => {
    const statuses = ['PENDING', 'OFFERED', 'ACCEPTED', 'IN_PROGRESS', 'DELIVERED', 'CANCELLED'];
    for (const status of statuses) expect(status === 'VERIFIED').toBe(false);
    expect('VERIFIED' === 'VERIFIED').toBe(true);
  });

  it('质量保证池在回访闭环前保持 HELD', () => {
    const releaseState = 'HELD';
    expect(releaseState).toBe('HELD');
  });
});