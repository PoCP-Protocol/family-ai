import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "app/ui/UI-03.tsx"), "utf8");

describe("UI-03 original growth explanation baseline contract", () => {
  it("keeps the original summary, overview, attention, suggestion, and action sequence", () => {
    const summary = source.indexOf("assessmentSummary");
    const overview = source.indexOf("综合成长评估");
    const issues = source.indexOf("核心关注");
    const suggestions = source.indexOf("成长建议");
    const action = source.indexOf("生成个性化成长方案");

    expect(summary).toBeGreaterThan(-1);
    expect(overview).toBeGreaterThan(summary);
    expect(issues).toBeGreaterThan(overview);
    expect(suggestions).toBeGreaterThan(issues);
    expect(action).toBeGreaterThan(suggestions);
  });

  it("renders the original five-dimension overview without fabricating a total score", () => {
    expect(source).toContain("GrowthRadarOverview");
    expect(source).toContain("亲子沟通");
    expect(source).toContain("学习习惯");
    expect(source).toContain("情绪调节");
    expect(source).toContain("自我管理");
    expect(source).toContain("手机与边界");
    expect(source).not.toContain(">72<");
    expect(source).not.toContain("AI成长诊断");
  });

  it("uses focus-backed tags and three numbered recommendations instead of the old four-layer cards", () => {
    expect(source).toContain("const issueTags = [focus.title");
    expect(source).toContain("actionItems.map");
    expect(source).toContain("{index + 1}");
    expect(source).not.toContain("function LayerCard");
    expect(source).not.toContain("HYPOTHESIS");
  });

  it("keeps a single original primary action to UI-04 and preserves a real empty state", () => {
    expect(source).toContain('router.push("/ui/UI-04" as Href)');
    expect(source).not.toContain('router.push("/ui/UI-08" as Href)');
    expect(source).toContain("先完成一次家庭测评");
    expect(source).toContain("家庭资料未补充时，不显示预置个人信息");
  });
});
