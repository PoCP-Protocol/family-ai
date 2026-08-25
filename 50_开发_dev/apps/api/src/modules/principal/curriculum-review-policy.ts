import { ForbiddenException } from '@nestjs/common';
import { isAuthorizedReviewer } from './reviewer-policy';

/** Human Gate for curriculum release/assignment. Default-off preserves local dogfood. */
export function assertCurriculumReviewer(actorId: string): void {
  const require = process.env.FPAI_REQUIRE_CURRICULUM_REVIEW === 'on';
  const allowlist = (process.env.FPAI_CURRICULUM_REVIEWER_IDS ?? '')
    .split(',').map((item) => item.trim()).filter(Boolean);
  if (!isAuthorizedReviewer(actorId, { require, allowlist })) {
    throw new ForbiddenException('curriculum reviewer authorization required');
  }
}