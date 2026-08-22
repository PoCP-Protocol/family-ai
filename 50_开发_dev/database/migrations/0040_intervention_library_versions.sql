-- 0040: auditable Intervention Library on top of the existing canonical interventions table.
-- Additive only. StartIntervention remains the sole state-changing entry point.

ALTER TABLE interventions
  ADD COLUMN IF NOT EXISTS intervention_code varchar(64) NULL,
  ADD COLUMN IF NOT EXISTS tenant_id uuid NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS review_status varchar(24) NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN IF NOT EXISTS reviewed_by_actor_id varchar(128) NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE interventions
SET intervention_code = CASE
      WHEN intervention_id = 'INTERVENTION-001' THEN 'LISTEN_BEFORE_RESPOND'
      ELSE intervention_id
    END,
    review_status = CASE WHEN status = 'ACTIVE' THEN 'PUBLISHED' ELSE review_status END,
    reviewed_by_actor_id = COALESCE(reviewed_by_actor_id, 'SYSTEM_MIGRATION'),
    reviewed_at = COALESCE(reviewed_at, created_at),
    updated_at = now()
WHERE intervention_code IS NULL OR review_status = 'DRAFT';

ALTER TABLE interventions
  ALTER COLUMN intervention_code SET NOT NULL;

ALTER TABLE interventions
  DROP CONSTRAINT IF EXISTS interventions_review_status_check;

ALTER TABLE interventions
  ADD CONSTRAINT interventions_review_status_check
  CHECK (review_status IN ('DRAFT','IN_REVIEW','PUBLISHED','RETIRED'));

CREATE UNIQUE INDEX IF NOT EXISTS uq_interventions_scope_code_version
ON interventions(COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), intervention_code, version);

CREATE TABLE IF NOT EXISTS intervention_versions (
  intervention_id varchar(64) NOT NULL REFERENCES interventions(intervention_id) ON DELETE CASCADE,
  version integer NOT NULL CHECK (version >= 1),
  status varchar(24) NOT NULL CHECK (status IN ('DRAFT','IN_REVIEW','PUBLISHED','RETIRED')),
  content jsonb NOT NULL,
  required_consent_purposes jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by_actor_id varchar(128) NOT NULL,
  reviewed_by_actor_id varchar(128) NULL,
  reviewed_at timestamptz NULL,
  published_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (intervention_id, version),
  CONSTRAINT intervention_versions_published_review_check CHECK (
    status <> 'PUBLISHED' OR (reviewed_by_actor_id IS NOT NULL AND reviewed_at IS NOT NULL AND published_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_intervention_versions_status
ON intervention_versions(status, published_at DESC);

INSERT INTO intervention_versions(
  intervention_id, version, status, content, required_consent_purposes, source_refs,
  created_by_actor_id, reviewed_by_actor_id, reviewed_at, published_at
)
SELECT
  'INTERVENTION-001',
  1,
  'PUBLISHED',
  jsonb_build_object(
    'name_zh', '先听后回应',
    'duration_days', 7,
    'why', '把家庭沟通中的第一个练习点收敛到可执行的倾听行为。',
    'target', '亲子沟通中的回应方式。',
    'behavior', '每天完成一个小的倾听动作，先听完再回应。',
    'applicability', jsonb_build_array('P03','R03','R04','R05'),
    'contraindications', jsonb_build_array('当前存在需要人工安全介入的高风险信号时，不进入普通成长练习。'),
    'safety_notes', jsonb_build_array('如出现安全风险，先走安全处理，不继续普通练习流。'),
    'expected_mediator', '练习过程中的倾听行为记录。',
    'expected_outcome', '不承诺结果改善，仅记录练习过程。',
    'action_plan', jsonb_build_array(
      '停顿三秒，让孩子把话说完，今天不急着给建议。',
      '先复述你听到的意思，再表达自己的看法。',
      '在提出解决办法前，先问一个澄清问题。',
      '先说出你观察到的感受，不评价对错。',
      '把倾听和纠正分开，今天先完成倾听。',
      '选一个没听好的时刻，补一句“我刚才没有听完，你愿意再说一遍吗？”',
      '回看这七天的练习感受，不判断有没有改善。'
    ),
    'policy_version', 'M2_105_DETERMINISTIC_V1',
    'evidence_boundary', 'PRACTICE_CONTENT_NOT_DIAGNOSIS_OR_GUARANTEED_OUTCOME'
  ),
  jsonb_build_array('SERVICE','ASSESSMENT','GROWTH_TRACKING'),
  jsonb_build_array(
    jsonb_build_object('source_type','INTERNAL_BASELINE','source_ref','THREE_PPT_AND_35_UI_DESIGN_INPUT','evidence_grade','E1'),
    jsonb_build_object('source_type','PLATFORM_POLICY','source_ref','M2_105_DETERMINISTIC_V1','evidence_grade','POLICY')
  ),
  'SYSTEM_MIGRATION',
  COALESCE(reviewed_by_actor_id, 'SYSTEM_MIGRATION'),
  COALESCE(reviewed_at, created_at),
  COALESCE(reviewed_at, created_at)
FROM interventions
WHERE intervention_id = 'INTERVENTION-001'
ON CONFLICT (intervention_id, version) DO NOTHING;
