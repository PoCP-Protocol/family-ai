-- 0045_ai_run_ledger — FAMILY-AI-PYTHON-ONLY-VERTICAL-P0-001 Batch 1 "AI Run Ledger"
-- (migration plan §9 Must-complete list; §6 AI Runtime call chain's "AI Run" step).
--
-- New Python-owned table (Assessment domain has no NestJS-side equivalent to
-- port). Style follows the existing `principal_model_attempts`
-- (0014_principal_model_attempts.sql) provider-attempt ledger as a reference
-- pattern, but is intentionally NOT a copy — see
-- `backend/domains/assessment/domain/ai_run.py` module docstring for the
-- design rationale (one row per interpret() call, no run/attempt split,
-- adds a boundary_violation outcome this domain's fail-closed content
-- validation needs that Principal's ledger has no equivalent for).
--
-- No PII/free-text model input or output is stored here — only call
-- metadata (generator/model/timing/token counts/outcome/short error code),
-- consistent with the "does not store raw model input/output" posture of
-- `principal_model_attempts`.
CREATE TABLE IF NOT EXISTS ai_run_ledger (
  run_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_session_id varchar(128) NOT NULL,
  service_depth varchar(64) NOT NULL,
  generator varchar(16) NOT NULL CHECK (generator IN ('deterministic', 'gateway')),
  model_name varchar(128) NULL,
  started_at timestamptz NOT NULL,
  completed_at timestamptz NOT NULL,
  input_tokens integer NULL,
  output_tokens integer NULL,
  outcome varchar(24) NOT NULL CHECK (outcome IN ('success', 'boundary_violation', 'provider_error')),
  error_detail varchar(256) NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_run_ledger_session ON ai_run_ledger(assessment_session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_run_ledger_outcome ON ai_run_ledger(outcome, created_at DESC);
