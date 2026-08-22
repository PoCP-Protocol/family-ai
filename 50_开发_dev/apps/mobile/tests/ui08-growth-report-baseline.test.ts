import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
const source = readFileSync(resolve(__dirname, "../app/ui/UI-08.tsx"), "utf8");
describe("UI-08 original growth-report baseline contract", () => {
  it("restores the original report header, five-dimension diagram, three report rows, and 7/30/90 path", () => {
    for (const copy of ["家庭成长报告", "成长综合评估", "亲子沟通", "学习习惯", "情绪管理", "自律能力", "手机依赖", "优势", "待观察", "优先建议", "7天", "30天", "90天", "生成个性化方案"]) expect(source).toContain(copy);
  });
  it("uses the original bottom route to UI-04 while explicitly rejecting score, rank, and diagnostic conclusions", () => {
    expect(source).toContain('router.push("/ui/UI-04" as Href)');
    expect(source).toContain("不是儿童诊断、家庭总分或效果结论");
    expect(source).not.toMatch(/综合分|排名第|风险等级|诊断结果/);
  });
  it("keeps process records and remote review hints as input rather than rewriting a core result", () => {
    expect(source).toContain("getFamilyReviewReadback");
    expect(source).toContain("已记录");
  });
});
