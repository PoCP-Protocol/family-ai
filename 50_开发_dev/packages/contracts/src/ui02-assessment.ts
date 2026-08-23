export type Ui02AssessmentAvailability = 'AVAILABLE' | 'CONSENT_REQUIRED' | 'NO_SUBJECT' | 'POLICY_BLOCKED';
export type AssessmentSessionStatus = 'IN_PROGRESS' | 'SUBMITTED' | 'EXITED';
export type AssessmentResponseType = 'SINGLE_CHOICE' | 'TEXT' | 'BOOLEAN';

export interface Ui02AssessmentTool {
  tool_ref: string;
  version_no: number;
  title: string;
  purpose: string;
  evidence_level: 'E1';
  schema_ref: string;
  items: {
    item_ref: string;
    response_type: AssessmentResponseType;
    required: boolean;
    options?: string[];
  }[];
  boundary: {
    truth_class: 'FAMILY_PERSPECTIVE';
    not_a_score: true;
    not_a_diagnosis: true;
    no_eligibility_effect: true;
    withdrawable: true;
    training_use: false;
  };
}

export interface Ui02AssessmentSubject {
  person_id: string;
  display_name: string;
  availability: 'AVAILABLE' | 'CONSENT_REQUIRED';
}

export interface AssessmentResponseDto {
  assessment_response_id: string;
  item_ref: string;
  response_type: AssessmentResponseType;
  response_value: string | boolean;
  revision: number;
  captured_at: string;
  visibility: 'FAMILY_PRIVATE';
}

export interface AssessmentSessionDto {
  assessment_session_id: string;
  family_id: string;
  subject_person_id: string;
  tool_ref: string;
  tool_version: number;
  status: AssessmentSessionStatus;
  started_at: string;
  submitted_at: string | null;
  row_version: number;
  responses: AssessmentResponseDto[];
}

export interface Ui02AssessmentProjection {
  projection_version: 'UI02_FAMILY_ASSESSMENT_V1';
  tenant_id: string;
  family_id: string;
  availability: Ui02AssessmentAvailability;
  subjects: Ui02AssessmentSubject[];
  tool: Ui02AssessmentTool | null;
  sessions: AssessmentSessionDto[];
  named_actions: {
    start: 'START_ASSESSMENT';
    save_response: 'SAVE_ASSESSMENT_RESPONSE';
    submit: 'SUBMIT_ASSESSMENT';
  };
}

export interface StartAssessmentRequest { subject_person_id: string; tool_ref?: string }
export interface SaveAssessmentResponseRequest { item_ref: string; response_type: AssessmentResponseType; response_value: string | boolean }

export interface AssessmentMutationReceipt {
  action: 'START_ASSESSMENT' | 'SAVE_ASSESSMENT_RESPONSE' | 'SUBMIT_ASSESSMENT';
  replayed: boolean;
  session: AssessmentSessionDto;
  evidence_id?: string;
  boundary: 'FAMILY_PERSPECTIVE_NOT_SCORE_OR_DIAGNOSIS';
}
