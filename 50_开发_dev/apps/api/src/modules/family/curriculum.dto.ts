import { BadRequestException } from '@nestjs/common';
import type {
  CheckInGrowthCamp21DayRequest,
  EnrollGrowthCamp21Request,
  ReviewCurriculumDraftRequest,
  ReleaseCurriculumDraftRequest,
} from '@family/contracts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const key = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= 128;
function objectBody(body: unknown): Record<string, unknown> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) throw new BadRequestException('Invalid schema');
  return body as Record<string, unknown>;
}
function fields(input: Record<string, unknown>, allowed: readonly string[]): void {
  if (Object.keys(input).some((field) => !allowed.includes(field))) throw new BadRequestException('Invalid schema');
}

export function validateReviewCurriculumDraftRequest(draftId: string, idempotencyKey: string | undefined, body: unknown): ReviewCurriculumDraftRequest {
  const input = objectBody(body); fields(input, ['decision', 'review_note']);
  if (!UUID.test(draftId) || !key(idempotencyKey) || !['APPROVED', 'REJECTED'].includes(String(input.decision))) throw new BadRequestException('Invalid schema');
  if (input.review_note !== undefined && (typeof input.review_note !== 'string' || input.review_note.length > 1000)) throw new BadRequestException('Invalid schema');
  return { draft_id: draftId, decision: input.decision as 'APPROVED' | 'REJECTED', review_note: input.review_note as string | undefined, idempotency_key: idempotencyKey };
}

export function validateEnrollGrowthCamp21Request(familyId: string, idempotencyKey: string | undefined, body: unknown): EnrollGrowthCamp21Request {
  const input = objectBody(body); fields(input, ['subject_person_id']);
  if (!UUID.test(familyId) || !UUID.test(String(input.subject_person_id)) || !key(idempotencyKey)) throw new BadRequestException('Invalid schema');
  return { family_id: familyId, subject_person_id: String(input.subject_person_id), idempotency_key: idempotencyKey };
}

export function validateCheckInGrowthCamp21DayRequest(familyId: string, enrollmentId: string, idempotencyKey: string | undefined, body: unknown): CheckInGrowthCamp21DayRequest {
  const input = objectBody(body); fields(input, ['day_no', 'completion_status', 'reflection', 'occurred_at']);
  if (!UUID.test(familyId) || !UUID.test(enrollmentId) || !key(idempotencyKey) || !Number.isInteger(input.day_no) || Number(input.day_no) < 1 || Number(input.day_no) > 21 || !['COMPLETED', 'PARTIAL', 'NOT_COMPLETED'].includes(String(input.completion_status))) throw new BadRequestException('Invalid schema');
  if (input.reflection !== undefined && (typeof input.reflection !== 'string' || input.reflection.length > 500)) throw new BadRequestException('Invalid schema');
  return { family_id: familyId, enrollment_id: enrollmentId, day_no: Number(input.day_no), completion_status: input.completion_status as CheckInGrowthCamp21DayRequest['completion_status'], reflection: input.reflection as string | undefined, occurred_at: input.occurred_at as string | undefined, idempotency_key: idempotencyKey };
}

export function validateReleaseCurriculumDraftRequest(draftId: string, idempotencyKey: string | undefined, body: unknown): ReleaseCurriculumDraftRequest {
  const input = objectBody(body); fields(input, []);
  if (!UUID.test(draftId) || !key(idempotencyKey)) throw new BadRequestException('Invalid schema');
  return { draft_id: draftId, idempotency_key: idempotencyKey };
}