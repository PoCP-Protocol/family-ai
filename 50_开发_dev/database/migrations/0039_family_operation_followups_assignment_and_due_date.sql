-- Follow-up assignment is an operational perspective for the current tenant/family queue.
-- It never changes a family fact, service entitlement, booking, or external effect.
ALTER TABLE family_operation_followups
  ADD COLUMN IF NOT EXISTS assigned_to_account_id uuid NULL REFERENCES accounts(account_id),
  ADD COLUMN IF NOT EXISTS due_date date NULL;

CREATE INDEX IF NOT EXISTS idx_family_operation_followups_assignment_due
  ON family_operation_followups(tenant_id, family_id, follow_up_status, due_date, updated_at DESC);
