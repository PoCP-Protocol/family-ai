-- 0047_ui02_family_support_needs_v3_batch1_construct_items
-- Follows 0046 (v2, 8 deep-dive items limited to the 3 constructs already
-- legal at the time). This migration adds the 5 items that became
-- answerable once EMOTION_REGULATION_SUPPORT / PARENT_CAPACITY /
-- SCHOOL_FAMILY_COLLABORATION were admitted into
-- claude_interpretation.py's _LEGAL_CONSTRUCT_REFS — see
-- governance/CONSTRUCT_ADMISSION_REGISTRY.yaml for the human-reviewed
-- admission record (project owner reviewed a 12-candidate table and
-- confirmed this exact 3-admit/9-hold split; recorded as such, not
-- overstated as a separate formal sign-off process).
--
-- Items added (from docs/model/family_assessment_item_bank.registry.yaml,
-- content already designed, ported verbatim as item_ref/response_type/
-- options — same UI02_FOUR_POINT_FAMILY_FREQUENCY scale as v2):
--   EMOTION_REGULATION_Q02/Q03  -> EMOTION_REGULATION_SUPPORT (+PARENT_CAPACITY for Q03)
--   SCHOOL_FAMILY_FEEDBACK_LOOP -> SCHOOL_FAMILY_COLLABORATION (secondary
--                                  tag ACADEMIC_DEVELOPMENT is HOLD, but the
--                                  primary/admitted tag is enough per the same
--                                  intersection rule 0046 used for
--                                  LEARNING_HABITS_Q01/Q03's secondary
--                                  FAMILY_ROUTINE tag)
--
-- Deliberately NOT included, despite their primary construct(s) being
-- admitted, because the registry itself flags them
-- `safety_boundary: human_gate_if_crisis_signal` /
-- `human_gate_if_parent_crisis` — the exact same class of flag that kept
-- PSYCHOSOMATIC_STRESS_SIGNAL on HOLD in the admission registry, and no code
-- anywhere reads/enforces `safety_boundary` yet (documentation-only):
--   EMOTION_REGULATION_Q01     (human_gate_if_crisis_signal)
--   PARENT_CAPACITY_PRESSURE   (human_gate_if_parent_crisis)
-- Admitting the EMOTION_REGULATION_SUPPORT/PARENT_CAPACITY constructs is
-- safe (other, non-crisis items about them exist and are included above);
-- shipping the specific items the registry authors themselves flagged as
-- needing a human-gate mechanism that doesn't exist yet is not — that would
-- be inconsistent with why PSYCHOSOMATIC_STRESS_SIGNAL was held. Add these
-- two once the safety_boundary routing gap is closed, not before.
--
-- Still NOT included (registry items whose constructs remain HOLD per the
-- admission registry): LEARNING_HABITS_Q02, SELF_REGULATION_Q01-03,
-- CHILD_ERROR_REVIEW_PATTERN, SLEEP_ENERGY_LEARNING_IMPACT,
-- AI_LEARNING_USE_CLARITY, MULTIMODAL_CREATION_OPPORTUNITY.
--
-- Same "no prompt/meta field" decision as 0046: AssessmentToolItem /
-- Ui02AssessmentToolItemModel have no display-text field for any item
-- (v1 included) — that is out of scope for this backend contract, by
-- existing design, not a gap introduced here.
--
-- load_active_tool() selects `order by version_no desc limit 1` among
-- ACTIVE+ADMITTED rows — inserting v3 as ACTIVE makes it the new default;
-- v1 and v2 remain as historical record, not retired.

INSERT INTO family_assessment_tools(
  tool_ref, version_no, title, purpose, status, admission_status,
  evidence_level, schema_ref, item_schema, boundary, effective_from
) VALUES (
  'FAMILY_SUPPORT_NEEDS', 3, '家庭支持需要与服务偏好确认(含深挖题·批次1扩容)',
  '在v2基础上,针对情绪调节支持/家长自身容量/学校家庭协同三个新审核通过的方向追加观察题',
  'ACTIVE', 'ADMITTED',
  'E1', 'family://assessment/FAMILY_SUPPORT_NEEDS/v3',
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
      {"item_ref":"DEVICE_USE_CONTEXT_Q03","response_type":"SINGLE_CHOICE","required":false,"options":["often","sometimes","rarely","not_sure"]},
      {"item_ref":"EMOTION_REGULATION_Q02","response_type":"SINGLE_CHOICE","required":false,"options":["often","sometimes","rarely","not_sure"]},
      {"item_ref":"EMOTION_REGULATION_Q03","response_type":"SINGLE_CHOICE","required":false,"options":["often","sometimes","rarely","not_sure"]},
      {"item_ref":"SCHOOL_FAMILY_FEEDBACK_LOOP","response_type":"SINGLE_CHOICE","required":false,"options":["often","sometimes","rarely","not_sure"]}
    ]
  }'::jsonb,
  '{"truth_class":"FAMILY_PERSPECTIVE","not_a_score":true,"not_a_diagnosis":true,"no_eligibility_effect":true,"withdrawable":true,"training_use":false}'::jsonb,
  now()
) ON CONFLICT (tool_ref, version_no) DO NOTHING;
