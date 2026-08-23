import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "app/ui/UI-04.tsx"), "utf8");

describe("UI-04 original 90-day plan baseline contract", () => {
  it("rebuilds the warm plan summary as native components and keeps the original 3/12/36/90 overview", () => {
    expect(source).toContain("function PlanSummaryCard");
    expect(source).toContain("PLAN_SUMMARY_STATS");
    expect(source).not.toContain('require("@/assets/images/ui04-plan-summary-baseline.png")');
    expect(source).toContain("当前阶段、目标、累计时长、难度与计划统计");
    for (const copy of ["当前阶段", "今日任务", "累计时长", "计划周期", "温和进阶"]) expect(source).toContain(copy);
  });

  it("keeps the original four-week coloured timeline in its visual order", () => {
    const week1 = source.indexOf('week: "第1周"');
    const week2 = source.indexOf('week: "第2周"');
    const week3 = source.indexOf('week: "第3周"');
    const week4 = source.indexOf('week: "第4周"');

    expect(week1).toBeGreaterThan(-1);
    expect(week2).toBeGreaterThan(week1);
    expect(week3).toBeGreaterThan(week2);
    expect(week4).toBeGreaterThan(week3);
    expect(source).toContain("mint:");
    expect(source).toContain("blue:");
    expect(source).toContain("orange:");
    expect(source).toContain("gray:");
  });

  it("renders phase-backed completion states while keeping the fixed orange primary action", () => {
    expect(source).toContain("getPhaseStatus");
    expect(source).toContain('status === "completed"');
    expect(source).toContain('backgroundColor: "#FF8A1F"');
    expect(source).toContain("开始执行计划");
  });

  it("keeps the single plan exit to accompanying service and preserves safety boundaries", () => {
    expect(source).toContain('router.push("/ui/UI-05" as Href)');
    expect(source).not.toContain("总分");
    expect(source).not.toContain("儿童诊断");
  });
});
