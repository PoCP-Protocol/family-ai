import { ForbiddenException } from '@nestjs/common';
import type pg from 'pg';
import type { ConsentPurpose } from '@family/contracts';

/**
 * Growth 相关操作(action / priority / review / intervention / journey-plan / onboarding 等)
 * 统一要求的最小同意集合。与原 6 处重复实现保持完全一致的语义:
 * 缺失任一 purpose 即以 `missing_required_consent:<以逗号分隔的缺失项>` 抛 403。
 *
 * 去重来源(2026-08):family.service.ts / growth-action.service.ts /
 * growth-priority.service.ts / growth-review.service.ts /
 * intervention.service.ts / journey-plan.service.ts 曾各自复制粘贴同一实现。
 */
const REQUIRED_GROWTH_CONSENT_PURPOSES: readonly ConsentPurpose[] = ['SERVICE', 'ASSESSMENT', 'GROWTH_TRACKING'];

export async function assertRequiredGrowthConsents(client: pg.PoolClient, familyId: string, childId: string): Promise<void> {
  const result = await client.query<{ purpose: ConsentPurpose }>(
    `select purpose
     from consents
     where family_id = $1
       and subject_person_id = $2
       and purpose = any($3::consent_purpose[])
       and status = 'GRANTED'
     for share`,
    [familyId, childId, REQUIRED_GROWTH_CONSENT_PURPOSES],
  );
  const granted = new Set(result.rows.map((row) => row.purpose));
  const missing = REQUIRED_GROWTH_CONSENT_PURPOSES.filter((purpose) => !granted.has(purpose));
  if (missing.length > 0) {
    throw new ForbiddenException(`missing_required_consent:${missing.join(',')}`);
  }
}
