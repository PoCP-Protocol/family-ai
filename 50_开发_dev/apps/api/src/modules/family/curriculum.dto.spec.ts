import { describe, expect, it } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { validateCheckInGrowthCamp21DayRequest, validateEnrollGrowthCamp21Request, validateReleaseCurriculumDraftRequest, validateReviewCurriculumDraftRequest } from './curriculum.dto';

const familyId = '22222222-2222-4222-8222-222222222222';
const draftId = '33333333-3333-4333-8333-333333333333';
const enrollmentId = '44444444-4444-4444-8444-444444444444';

describe('21-day curriculum DTOs', () => {
  it('rejects unknown release fields and accepts an empty release body', () => {
    expect(() => validateReleaseCurriculumDraftRequest(draftId, 'release-1', { unexpected: true })).toThrow(BadRequestException);
    expect(validateReleaseCurriculumDraftRequest(draftId, 'release-1', {})).toMatchObject({ draft_id: draftId, idempotency_key: 'release-1' });
  });

  it('requires an explicit review decision', () => {
    expect(() => validateReviewCurriculumDraftRequest(draftId, 'review-1', {})).toThrow(BadRequestException);
    expect(validateReviewCurriculumDraftRequest(draftId, 'review-1', { decision: 'APPROVED' }).decision).toBe('APPROVED');
  });

  it('binds enrollment and check-in requests to route identifiers', () => {
    expect(validateEnrollGrowthCamp21Request(familyId, 'enroll-1', { subject_person_id: enrollmentId })).toMatchObject({ family_id: familyId, subject_person_id: enrollmentId });
    expect(validateCheckInGrowthCamp21DayRequest(familyId, enrollmentId, 'checkin-1', { day_no: 1, completion_status: 'COMPLETED' })).toMatchObject({ family_id: familyId, enrollment_id: enrollmentId, day_no: 1 });
  });
});
