import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { GROWTH_FOCUSES } from "../lib/family/core-growth";
import { FAMILY_ASSESSMENT_AI_CAPABILITY_MEMORY } from "../lib/family/family-assessment-capability-memory";
import { UI02_ASSESSMENT_METHOD_SOURCE, UI02_ORIGINAL_FOCUS_LAYOUT } from "../lib/family/ui02-assessment-layout";

describe("UI-02 original step-two assessment contract", () => {
  const source = readFileSync(resolve(process.cwd(), "app/ui/UI-02.tsx"), "utf8");

  it("keeps the original five single-choice focus areas", () => {
    expect(GROWTH_FOCUSES).toHaveLength(5);
    expect(UI02_ORIGINAL_FOCUS_LAYOUT.map((focus) => focus.title)).toEqual([
      "学习习惯",
      "情绪管理",
      "亲子沟通",
      "手机依赖",
      "自律能力",
    ]);
    expect(UI02_ORIGINAL_FOCUS_LAYOUT.map((focus) => focus.id).sort()).toEqual([
      "DEVICE_USE_CONTEXT",
      "EMOTION_REGULATION",
      "LEARNING_HABITS",
      "PARENT_CHILD_COMMUNICATION",
      "SELF_REGULATION",
    ]);
    expect(source).toContain('accessibilityRole="radio"');
  });

  it("keeps the original step, optional supplement, and next-action structure", () => {
    expect(source).toContain("第 2 / 5 步");
    expect(source).toContain("最近最想先支持孩子的哪一方面？");
    expect(source).toContain("请选择最贴近最近情况的一项。");
    expect(source).toContain("再了解一点");
    expect(source).toContain("服务偏好");
    expect(source).toContain("补充信息");
    expect(source).toContain("孩子年龄/阶段");
    expect(source).toContain("家庭情况");
    expect(source).toContain("孩子性别");
    expect(source).toContain('"下一步"');
  });

  it("extends the original step with sourced model deep-dive questions", () => {
    expect(FAMILY_ASSESSMENT_AI_CAPABILITY_MEMORY.blueprint.methodName).toBe("Family Support Assessment");
    expect(FAMILY_ASSESSMENT_AI_CAPABILITY_MEMORY.blueprint.layer).toBe("L0_FAMILY_NEED_AND_SERVICE_PREFERENCE");
    expect(FAMILY_ASSESSMENT_AI_CAPABILITY_MEMORY.blueprint.stepModel.map((step) => step.stepRef)).toEqual([
      "CONSENT_AND_BOUNDARY",
      "CURRENT_NEED",
      "SUPPORT_DIRECTION",
      "SERVICE_PREFERENCE",
      "NEXT_DECISION",
    ]);
    expect(FAMILY_ASSESSMENT_AI_CAPABILITY_MEMORY.dimensions.every((dimension) => dimension.questions.length === 3)).toBe(true);
    expect(source).toContain("getUi02DeepAssessmentQuestions");
    expect(source).toContain("UI02_ASSESSMENT_ANSWER_OPTIONS");
    expect(source).toContain("question.itemRef");
  });

  it("sources the assessment method from the family education model memory", () => {
    expect(UI02_ASSESSMENT_METHOD_SOURCE.capabilityRef).toBe("FAMILY_ASSESSMENT_AI_CAPABILITY");
    expect(UI02_ASSESSMENT_METHOD_SOURCE.toolRef).toBe("FAMILY_SUPPORT_NEEDS");
    expect(UI02_ASSESSMENT_METHOD_SOURCE.boundary.notScore).toBe(true);
    expect(UI02_ASSESSMENT_METHOD_SOURCE.boundary.notDiagnosis).toBe(true);
    expect(source).not.toContain("Family Support Assessment ·");
    expect(source).not.toContain("L0_FAMILY_NEED_AND_SERVICE_PREFERENCE");
    expect(source).not.toContain("Need/Intent");
    expect(source).not.toContain("家庭教育模型测评题库");
    expect(source).not.toContain("方向深追题");
    expect(source).not.toContain("question.intent");
  });

  it("submits the versioned assessment before entering the assessment result page", () => {
    expect(source).toContain("getFamilyAssessment");
    expect(source).toContain("startFamilyAssessment");
    expect(source).toContain("saveFamilyAssessmentResponse");
    expect(source).toContain("submitFamilyAssessment");
    expect(source).toContain("ui02-deep:${sessionId}:${question.itemRef}:${answer}");
    expect(source).toContain("subject_person_id: subjectId");
    expect(source).toContain("tool_ref: projection.tool.tool_ref");
    expect(source).toContain('router.push("/ui/UI-02-result" as Href)');
    expect(source).not.toContain("SELECT_SYNTHETIC_ASSESSMENT_DIMENSION");
  });

  it("keeps the commercial consent, evidence, and non-diagnosis boundary explicit", () => {
    expect(source).toContain('projection.availability !== "AVAILABLE"');
    expect(source).toContain('subject.availability === "AVAILABLE"');
    expect(source).toContain("我知道这只是家庭自查，不给孩子打分，不做诊断或排名。");
    expect(source).not.toContain("工具版本 v${projection.tool.version_no}");
    expect(source).not.toContain('session.status === "connected" ? "请选择孩子" : "连接家庭后读取"');
    expect(source).not.toContain('>10岁<');

    const resultSource = readFileSync(resolve(process.cwd(), "app/ui/UI-02-result.tsx"), "utf8");
    expect(resultSource).toContain("免费家庭测评已完成");
    expect(resultSource).toContain("返回调整测评");
    expect(resultSource).toContain("不是对孩子的评分、排名或诊断");
    expect(resultSource).not.toContain("FAMILY_ASSESSMENT_AI_CAPABILITY");
    expect(resultSource).not.toContain("模型来源");
    expect(resultSource).not.toContain("UI02_ASSESSMENT_METHOD_SOURCE");

    const explanationSource = readFileSync(resolve(process.cwd(), "app/ui/UI-03.tsx"), "utf8");
    expect(explanationSource).toContain("这是一个待家庭确认的支持方向，不是孩子标签、成长分或诊断。");
    expect(explanationSource).toContain("确认前不写入意图");
  });
});
