-- 0046_ui02_family_support_needs_v2_deepdive_items
-- FAMILY_SUPPORT_NEEDS v1 (0040) only asked FOCUS + two demographic items; the
-- FOCUS options (LEARNING_HABITS/EMOTION_REGULATION/PARENT_CHILD_COMMUNICATION/
-- DEVICE_USE_CONTEXT/SELF_REGULATION) were never followed up with actual
-- deep-dive items. A full 25-item Chinese item bank already exists as design
-- intent in docs/model/family_assessment_item_bank.registry.yaml (UI02_FOUR_
-- POINT_FAMILY_FREQUENCY scale: often/sometimes/rarely/not_sure) but was never
-- inserted into family_assessment_tools — this migration ports already-
-- designed item_ref/response_type/options structure, not new item authorship.
--
-- Scope: only items whose registry construct_refs intersect the three
-- construct refs already reviewed and whitelisted in
-- backend/domains/assessment/infrastructure/claude_interpretation.py's
-- _LEGAL_CONSTRUCT_REFS (PARENT_CHILD_COMMUNICATION / HOMEWORK_PROCESS /
-- DEVICE_USE_CONTEXT). The registry's other 17 items (EMOTION_REGULATION_*,
-- SELF_REGULATION_*, and the 10-item English bank covering AI_LITERACY_
-- FLUENCY/PHYSICAL_HEALTH_RHYTHM/PARENT_CAPACITY/etc.) reference constructs
-- that have never been through the review process that produced the current
-- whitelist (see the 2026-08-26 fabricated-construct incident noted in
-- claude_interpretation.py's docstring) — intentionally NOT included here.
-- _LEGAL_CONSTRUCT_REFS itself is not touched.
--
-- NOTE on prompt text: `AssessmentToolItem` (domain/value_objects.py) and its
-- HTTP mirror `Ui02AssessmentToolItemModel` (api/responses.py, ported
-- field-for-field from packages/contracts/src/ui02-assessment.ts) only carry
-- item_ref/response_type/required/options — there is no prompt/title/label
-- field anywhere in this contract, for v1's items either. Item display text
-- is therefore not stored in the backend at all (by existing design, not a
-- gap introduced here) — a client must resolve item_ref -> Chinese question
-- text via its own copy/i18n layer. The actual Chinese wording for the 8
-- items below is preserved verbatim in
-- docs/model/family_assessment_item_bank.registry.yaml as the source of
-- truth for whoever builds that layer; it is intentionally not duplicated
-- into this migration's item_schema, since any extra JSON key here would be
-- silently dropped by Pydantic's default `extra="ignore"` on parse — keeping
-- it here would look functional without being functional.
--
-- family_assessment_tools.item_schema has no branching/conditional-display
-- support (flat items array) — all 11 items (3 original + 8 new) are added
-- to one flat list, all optional (required:false), since a family focused on
-- one FOCUS area should not be forced to answer items about the other two.
--
-- load_active_tool() (infrastructure/sqlalchemy_repository.py) selects
-- `order by version_no desc limit 1` among ACTIVE+ADMITTED rows for a given
-- tool_ref — inserting v2 as ACTIVE makes it the new default without any
-- change to v1 (kept as historical record, not retired).

INSERT INTO family_assessment_tools(
  tool_ref, version_no, title, purpose, status, admission_status,
  evidence_level, schema_ref, item_schema, boundary, effective_from
) VALUES (
  'FAMILY_SUPPORT_NEEDS', 2, '家庭支持需要与服务偏好确认(含深挖题)',
  '在v1的场景/偏好确认基础上,针对学习习惯/亲子沟通/设备使用三个已审核方向追加具体观察题',
  'ACTIVE', 'ADMITTED',
  'E1', 'family://assessment/FAMILY_SUPPORT_NEEDS/v2',
  '{
    "items": [
      {"item_ref":"FOCUS","response_type":"SINGLE_CHOICE","required":true,"options":["LEARNING_HABITS","EMOTION_REGULATION","PARENT_CHILD_COMMUNICATION","DEVICE_USE_CONTEXT","SELF_REGULATION"]},
      {"item_ref":"FAMILY_STRUCTURE","response_type":"SINGLE_CHOICE","required":false,"options":["TWO_PARENT","SINGLE_PARENT","BLENDED","PREFER_NOT_TO_SAY"]},
      {"item_ref":"CHILD_GENDER","response_type":"SINGLE_CHOICE","required":false,"options":["BOY","GIRL","SELF_DESCRIBED","PREFER_NOT_TO_SAY"]},
      {"item_ref":"LEARNING_HABITS_Q01","response_type":"SINGLE_CHOICE","required":false,"options":["often","sometimes","rarely","not_sure"]},
      {"item_ref":"LEARNING_HABITS_Q03","response_type":"SINGLE_CHOICE","required":false,"options":["often","sometimes","rarely","not_sure"]},
      {"item_ref":"PARENT_CHILD_COMMUNICATION_Q01","response_type":"SINGLE_CHOICE","required":false,"options":["often","sometimes","rarely","not_sure"]},
      {"item_ref":"PARENT_CHILD_COMMUNICATION_Q02","response_type":"SINGLE_CHOICE","required":false,"options":["often","sometimes","rarely","not_sure"]},
      {"item_ref":"PARENT_CHILD_COMMUNICATION_Q03","response_type":"SINGLE_CHOICE","required":false,"options":["often","sometimes","rarely","not_sure"]},
      {"item_ref":"DEVICE_USE_CONTEXT_Q01","response_type":"SINGLE_CHOICE","required":false,"options":["often","sometimes","rarely","not_sure"]},
      {"item_ref":"DEVICE_USE_CONTEXT_Q02","response_type":"SINGLE_CHOICE","required":false,"options":["often","sometimes","rarely","not_sure"]},
      {"item_ref":"DEVICE_USE_CONTEXT_Q03","response_type":"SINGLE_CHOICE","required":false,"options":["often","sometimes","rarely","not_sure"]}
    ]
  }'::jsonb,
  '{"truth_class":"FAMILY_PERSPECTIVE","not_a_score":true,"not_a_diagnosis":true,"no_eligibility_effect":true,"withdrawable":true,"training_use":false}'::jsonb,
  now()
) ON CONFLICT (tool_ref, version_no) DO NOTHING;
