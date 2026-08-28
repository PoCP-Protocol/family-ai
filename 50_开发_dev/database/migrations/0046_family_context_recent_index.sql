-- 0046_family_context_recent_index — FAMILY-CONTEXT-P0: supports cross-session
-- "recent context for this family" reads (see
-- architecture/notes/family-context-p0-design.md) against the EXISTING
-- `perspectives` / `evidence_records` tables (0003_growth_foundation.sql,
-- 0006_perspective_evidence_contract_alignment.sql). No new tables — this
-- migration only adds the family-scoped, onboarding-agnostic indexes that
-- `family_context` domain's real repository needs; it does not touch any
-- existing column, constraint, or the onboarding-scoped index added in 0006
-- (`idx_perspectives_onboarding_time`), which stays for its current callers.
CREATE INDEX IF NOT EXISTS idx_perspectives_family_recorded
ON perspectives(family_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_evidence_records_family_observed
ON evidence_records(family_id, observed_at DESC, created_at DESC);
