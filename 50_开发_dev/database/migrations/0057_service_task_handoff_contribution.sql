-- Task handoff: when a service task is reassigned away from an assignee who already
-- delivered/started substantial work, that work must not vanish just because
-- service_tasks.responsible_ref gets overwritten to the new assignee. Before this
-- migration, verifyServiceTask produced exactly one service_contributions row per task,
-- attributed to whoever held responsible_ref at final verification time — a handoff mid-
-- task silently erased the prior assignee's share.
--
-- This adds:
--   1. task_assignments.revoke_reason — optional, freeform note on why a handoff happened
--      (the REVOKED assignment row itself already carries the who/when; this adds why).
--   2. A comment documenting the PARTIAL_HANDOFF quality_state convention used by
--      assignServiceTask going forward (no CHECK constraint change needed —
--      service_contributions.quality_state is already a free varchar(32) with no CHECK).

ALTER TABLE task_assignments ADD COLUMN IF NOT EXISTS revoke_reason varchar(240) NULL;

COMMENT ON COLUMN task_assignments.revoke_reason IS 'Optional reason for reassignment, set when the assignment is REVOKED via a handoff.';
COMMENT ON COLUMN service_contributions.quality_state IS 'RECORDED (default) | VERIFIED (passed formal review) | PARTIAL_HANDOFF (assignee reassigned after delivering substantial work; never formally reviewed, still counted for allocation).';
