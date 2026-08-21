import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { GROWTH_FOCUSES } from "../lib/family/core-growth";
import { UI02_ORIGINAL_FOCUS_LAYOUT } from "../lib/family/ui02-assessment-layout";

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
    expect(UI02_ORIGINAL_FOCUS_LAYOUT.map((focus) => focus.id)).toEqual([
      "LEARNING_HABITS",
      "EMOTION_REGULATION",
      "PARENT_CHILD_COMMUNICATION",
      "DEVICE_USE_CONTEXT",
      "SELF_REGULATION",
    ]);
    expect(source).toContain('accessibilityRole="radio"');
  });

  it("keeps the original step, optional supplement, and next-action structure", () => {
    expect(source).toContain("第 2 / 5 步");
    expect(source).toContain("您孩子目前最需要改善的问题是？");
    expect(source).toContain("补充信息");
    expect(source).toContain("孩子年龄/阶段");
    expect(source).toContain("家庭情况");
    expect(source).toContain("孩子性别");
    expect(source).toContain('"下一步"');
  });

  it("does not replace the original step with an unsourced multi-question scale", () => {
    expect(source).not.toContain("ASSESSMENT_ANSWER_OPTIONS");
    expect(source).not.toContain("最近两周，这些情况出现得多吗？");
  });

  it("keeps UI-02 as an entry to the existing growth explanation page", () => {
    expect(source).toContain('router.push("/ui/UI-03" as Href)');
    expect(source).toContain("SELECT_SYNTHETIC_ASSESSMENT_DIMENSION");
  });

  it("keeps the explanation summary accurate when the original step records only a focus choice", () => {
    const explanationSource = readFileSync(resolve(process.cwd(), "app/ui/UI-03.tsx"), "utf8");
    expect(explanationSource).toContain("本页依据家庭本次选择整理成长概览");
    expect(explanationSource).not.toContain("并完成了 ${Object.keys(assessmentAnswers).length} 个场景回答");
  });
});
