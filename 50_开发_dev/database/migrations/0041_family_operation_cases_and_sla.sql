-- Family Case and SLA fields extend the existing operation follow-up aggregate.
-- They remain tenant/family scoped operational records and never mutate child facts or external systems.

ALTER TABLE family_operation_followups
  ADD COLUMN IF NOT EXISTS case_id uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS case_priority varchar(16) NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN IF NOT EXISTS sla_target_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS resolution_summary text NULL;

UPDATE family_operation_followups
SET sla_target_at = COALESCE(sla_target_at, created_at + interval '48 hours'),
    resolved_at = CASE WHEN follow_up_status = 'PROCESSED' THEN COALESCE(resolved_at, updated_at) ELSE resolved_at END,
    resolution_summary = CASE WHEN follow_up_status = 'PROCESSED' THEN COALESCE(resolution_summary, operator_note) ELSE resolution_summary END;

ALTER TABLE family_operation_followups
  DROP CONSTRAINT IF EXISTS family_operation_followups_case_priority_check;
ALTER TABLE family_operation_followups
  ADD CONSTRAINT family_operation_followups_case_priority_check
  CHECK (case_priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT'));

ALTER TABLE family_operation_followups
  DROP CONSTRAINT IF EXISTS family_operation_followups_resolution_summary_length_check;
ALTER TABLE family_operation_followups
  ADD CONSTRAINT family_operation_followups_resolution_summary_length_check
  CHECK (resolution_summary IS NULL OR char_length(resolution_summary) <= 1000);

CREATE UNIQUE INDEX IF NOT EXISTS uq_family_operation_followups_case_id
  ON family_operation_followups(case_id);
CREATE INDEX IF NOT EXISTS idx_family_operation_followups_sla
  ON family_operation_followups(tenant_id, family_id, follow_up_status, case_priority, sla_target_at);
