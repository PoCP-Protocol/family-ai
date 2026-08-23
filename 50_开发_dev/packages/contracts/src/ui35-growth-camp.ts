export type GrowthCampAvailability = 'AVAILABLE' | 'CONSENT_REQUIRED' | 'NO_SUBJECT' | 'POLICY_BLOCKED';
export type GrowthCampEnrollmentStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';

export interface GrowthCampDayDefinition {
  day: number;
  stage: '观察与连接' | '沟通与习惯' | '反思与延续';
  title: string;
  intent: string;
  action: string;
  suggested_words: string;
  observation_prompt: string;
  estimated_minutes: number;
}

export interface GrowthCampEnrollmentDto {
  enrollment_id: string;
  family_id: string;
  subject_person_id: string;
  program_ref: 'PARENT_GROWTH_21';
  program_version: number;
  status: GrowthCampEnrollmentStatus;
  current_day: number;
  started_at: string;
  completed_at: string | null;
  row_version: number;
}

export interface GrowthCampDayCheckinDto {
  checkin_id: string;
  enrollment_id: string;
  day_no: number;
  completion_status: 'COMPLETED' | 'PARTIAL' | 'NOT_COMPLETED';
  reflection: string | null;
  reflection_boundary: 'PARENT_REFLECTION_NOT_CHILD_FACT_OR_OUTCOME';
  occurred_at: string;
}

export interface Ui35GrowthCampProjection {
  projection_version: 'UI35_GROWTH_CAMP_V1';
  tenant_id: string;
  family_id: string;
  availability: GrowthCampAvailability;
  subjects: readonly {
    person_id: string;
    display_name: string;
    availability: 'AVAILABLE' | 'CONSENT_REQUIRED';
  }[];
  program: {
    program_ref: 'PARENT_GROWTH_21';
    version_no: number;
    title: string;
    purpose: string;
    evidence_level: 'E1';
    days: readonly GrowthCampDayDefinition[];
  };
  enrollment: GrowthCampEnrollmentDto | null;
  checkins: readonly GrowthCampDayCheckinDto[];
  boundary: 'ACTION_RECORD_IS_NOT_CHILD_SCORE_DIAGNOSIS_OR_GROWTH_OUTCOME';
}

export interface GrowthCampMutationReceipt {
  action: 'ENROLL_GROWTH_CAMP' | 'CHECK_IN_GROWTH_CAMP_DAY';
  replayed: boolean;
  enrollment: GrowthCampEnrollmentDto;
  checkin?: GrowthCampDayCheckinDto;
  boundary: 'ACTION_RECORD_IS_NOT_CHILD_SCORE_DIAGNOSIS_OR_GROWTH_OUTCOME';
}
