import { describe, expect, it } from "vitest";
import { FAMILY_ASSESSMENT_AI_CAPABILITY_MEMORY } from "../lib/family/family-assessment-capability-memory";

/**
 * 与 packages/family-model/src/index.ts 的 FAMILY_THEORY_REGISTRY 保持字面量一致的边界测试。
 * theoryRefs 是结构化补充,不替换/不删除既有的 theorySupport 自然语言字段(ui02-assessment-baseline.test.ts
 * 对 theorySupport 的字符串断言不受这次改动影响)。
 */
describe("FamilyAssessmentDimensionMemory.theoryRefs", () => {
  it("每个维度都有至少一个结构化理论引用,且不为空", () => {
    for (const dimension of FAMILY_ASSESSMENT_AI_CAPABILITY_MEMORY.dimensions) {
      expect(dimension.theoryRefs.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("theoryRefs 只使用白名单内的四个真实理论/公共卫生指南来源,不出现产品自造的知识库编号", () => {
    const whitelisted = new Set(["HARVARD_EXECUTIVE_FUNCTION", "CASEL_SEL_FRAMEWORK", "CDC_POSITIVE_PARENTING", "AAP_HEALTHY_CHILDREN_MEDIA"]);
    for (const dimension of FAMILY_ASSESSMENT_AI_CAPABILITY_MEMORY.dimensions) {
      for (const ref of dimension.theoryRefs) {
        expect(whitelisted.has(ref)).toBe(true);
      }
    }
  });

  it("四个理论在24维度覆盖中均被至少一个维度引用(全部真实来源都用上了,不是摆设)", () => {
    const allRefs = new Set(FAMILY_ASSESSMENT_AI_CAPABILITY_MEMORY.dimensions.flatMap((dimension) => dimension.theoryRefs));
    expect(allRefs.has("HARVARD_EXECUTIVE_FUNCTION")).toBe(true);
    expect(allRefs.has("CASEL_SEL_FRAMEWORK")).toBe(true);
    expect(allRefs.has("CDC_POSITIVE_PARENTING")).toBe(true);
    expect(allRefs.has("AAP_HEALTHY_CHILDREN_MEDIA")).toBe(true);
  });

  it("学习习惯维度的 theoryRefs 与其 theorySupport 文案语义对应(Harvard Executive Function)", () => {
    const dimension = FAMILY_ASSESSMENT_AI_CAPABILITY_MEMORY.dimensions.find((d) => d.focusId === "LEARNING_HABITS");
    expect(dimension?.theoryRefs).toContain("HARVARD_EXECUTIVE_FUNCTION");
    expect(dimension?.theorySupport.join("\n")).toContain("Harvard Executive Function");
  });
});
