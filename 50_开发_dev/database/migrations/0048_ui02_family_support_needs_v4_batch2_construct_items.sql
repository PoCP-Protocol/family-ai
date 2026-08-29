-- 0048_ui02_family_support_needs_v4_batch2_construct_items
-- Follows 0047 (v3, Batch 1 admission). Adds the 4 items that became
-- answerable once LEARNING_STRATEGY_METACOGNITION / SELF_REGULATION_SUPPORT
-- were admitted into claude_interpretation.py's _LEGAL_CONSTRUCT_REFS — see
-- governance/CONSTRUCT_ADMISSION_REGISTRY.yaml for the Batch 2 admission
-- record. These two were initially held pending a check for concept overlap
-- with the already-admitted HOMEWORK_PROCESS; re-review clarified they are
-- distinct analysis levels (HOMEWORK_PROCESS = task-execution pattern,
-- LEARNING_STRATEGY_METACOGNITION = the child's own cognitive/metacognitive
-- skill, SELF_REGULATION_SUPPORT = the family's scaffolding behavior for
-- everyday tasks generally, not homework-specific) rather than duplicates.
--
-- Items added (from docs/model/family_assessment_item_bank.registry.yaml):
--   LEARNING_HABITS_Q02  -> LEARNING_STRATEGY_METACOGNITION, SELF_REGULATION_SUPPORT
--   SELF_REGULATION_Q01  -> SELF_REGULATION_SUPPORT (+FAMILY_ROUTINE, still-HOLD secondary tag)
--   SELF_REGULATION_Q02  -> SELF_REGULATION_SUPPORT, LEARNING_STRATEGY_METACOGNITION
--   SELF_REGULATION_Q03  -> SELF_REGULATION_SUPPORT, LEARNING_STRATEGY_METACOGNITION (+FAMILY_ROUTINE)
-- All four carry `safety_boundary: normal_learning_support` in the registry
-- (verified individually — no crisis-class flag this batch, unlike Batch 1's
-- EMOTION_REGULATION_Q01/PARENT_CAPACITY_PRESSURE exclusions).
--
-- Same "no prompt/meta field" decision as 0046/0047 — item display text is
-- not part of this backend contract by existing design.
--
-- Still NOT included (registry items whose constructs remain HOLD per the
-- admission registry): CHILD_ERROR_REVIEW_PATTERN, SLEEP_ENERGY_LEARNING_IMPACT,
-- AI_LEARNING_USE_CLARITY, MULTIMODAL_CREATION_OPPORTUNITY,
-- PARENT_CHILD_TALK_INTERRUPTION, CHILD_WILLINGNESS_TO_TALK — plus the
-- Batch-1-excluded crisis-flagged EMOTION_REGULATION_Q01/PARENT_CAPACITY_PRESSURE.
--
-- load_active_tool() selects `order by version_no desc limit 1` among
-- ACTIVE+ADMITTED rows — inserting v4 as ACTIVE makes it the new default;
-- v1/v2/v3 remain as historical record, not retired.

INSERT INTO family_assessment_tools(
  tool_ref, version_no, title, purpose, status, admission_status,
  evidence_level, schema_ref, item_schema, boundary, effective_from
) VALUES (
  'FAMILY_SUPPORT_NEEDS', 4, '家庭支持需要与服务偏好确认(含深挖题·批次2扩容)',
  '在v3基础上,针对学习策略/元认知与自我管理支持两个新审核通过的方向追加观察题',
  'ACTIVE', 'ADMITTED',
  'E1', 'family://assessment/FAMILY_SUPPORT_NEEDS/v4',
  '{
    "items": [
      {"item_ref":"FOCUS","response_type":"SINGLE_CHOICE","required":true,"options":["LEARNING_HABITS","EMOTION_REGULATION","PARENT_CHILD_COMMUNICATION","DEVICE_USE_CONTEXT","SELF_REGULATION"]},
      {"item_ref":"FAMILY_STRUCTURE","response_type":"SINGLE_CHOICE","required":false,"options":["TWO_PARENT","SINGLE_PARENT","BLENDED","PREFER_NOT_TO_SAY"]},
      {"item_ref":"CHILD_GENDER","response_type":"SINGLE_CHOICE","required":false,"options":["BOY","GIRL","SELF_DESCRIBED","PREFER_NOT_TO_SAY"]},
      {"item_ref":"LEARNING_HABITS_Q01","response_type":"SINGLE_CHOICE","required":false,"options":["often","sometimes","rarely","not_sure"]},
      {"item_ref":"LEARNING_HABITS_Q02","response_type":"SINGLE_CHOICE","required":false,"options":["often","sometimes","rarely","not_sure"]},
      {"item_ref":"LEARNING_HABITS_Q03","response_type":"SINGLE_CHOICE","required":false,"options":["often","sometimes","rarely","not_sure"]},
      {"item_ref":"PARENT_CHILD_COMMUNICATION_Q01","response_type":"SINGLE_CHOICE","required":false,"options":["often","sometimes","rarely","not_sure"]},
      {"item_ref":"PARENT_CHILD_COMMUNICATION_Q02","response_type":"SINGLE_CHOICE","required":false,"options":["often","sometimes","rarely","not_sure"]},
      {"item_ref":"PARENT_CHILD_COMMUNICATION_Q03","response_type":"SINGLE_CHOICE","required":false,"options":["often","sometimes","rarely","not_sure"]},
      {"item_ref":"DEVICE_USE_CONTEXT_Q01","response_type":"SINGLE_CHOICE","required":false,"options":["often","sometimes","rarely","not_sure"]},
      {"item_ref":"DEVICE_USE_CONTEXT_Q02","response_type":"SINGLE_CHOICE","required":false,"options":["often","sometimes","rarely","not_sure"]},
      {"item_ref":"DEVICE_USE_CONTEXT_Q03","response_type":"SINGLE_CHOICE","required":false,"options":["often","sometimes","rarely","not_sure"]},
      {"item_ref":"EMOTION_REGULATION_Q02","response_type":"SINGLE_CHOICE","required":false,"options":["often","sometimes","rarely","not_sure"]},
      {"item_ref":"EMOTION_REGULATION_Q03","response_type":"SINGLE_CHOICE","required":false,"options":["often","sometimes","rarely","not_sure"]},
      {"item_ref":"SCHOOL_FAMILY_FEEDBACK_LOOP","response_type":"SINGLE_CHOICE","required":false,"options":["often","sometimes","rarely","not_sure"]},
      {"item_ref":"SELF_REGULATION_Q01","response_type":"SINGLE_CHOICE","required":false,"options":["often","sometimes","rarely","not_sure"]},
      {"item_ref":"SELF_REGULATION_Q02","response_type":"SINGLE_CHOICE","required":false,"options":["often","sometimes","rarely","not_sure"]},
      {"item_ref":"SELF_REGULATION_Q03","response_type":"SINGLE_CHOICE","required":false,"options":["often","sometimes","rarely","not_sure"]}
    ]
  }'::jsonb,
  '{"truth_class":"FAMILY_PERSPECTIVE","not_a_score":true,"not_a_diagnosis":true,"no_eligibility_effect":true,"withdrawable":true,"training_use":false}'::jsonb,
  now()
) ON CONFLICT (tool_ref, version_no) DO NOTHING;
