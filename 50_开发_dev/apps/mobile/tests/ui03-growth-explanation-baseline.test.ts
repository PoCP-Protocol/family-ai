import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "app/ui/UI-03.tsx"), "utf8");

describe("UI-03 AI diagnostic baseline contract", () => {
  it("keeps the baseline summary, score, issue, suggestion, and action sequence", () => {
    const summary = source.indexOf("<View style={styles.assessmentSummary}>");
    const overview = source.indexOf("综合成长评估");
    const issues = source.indexOf(">核心问题<");
    const suggestions = source.indexOf(">成长建议<");
    const action = source.indexOf("生成个性化方案");

    expect(summary).toBeGreaterThan(-1);
    expect(overview).toBeGreaterThan(summary);
    expect(issues).toBeGreaterThan(overview);
    expect(suggestions).toBeGreaterThan(issues);
    expect(action).toBeGreaterThan(suggestions);
  });

  it("renders the baseline scorecard from model output", () => {
    expect(source).toContain("GrowthRadarOverview");
    expect(source).toContain("scorecard.dimensions");
    expect(source).toContain("scorecard.overall_score");
    expect(source).toContain("scorecard.overall_band");
    expect(source).toContain("孩子得分");
    expect(source).toContain("同龄平均");
    expect(source).toContain('title: "AI成长诊断"');
    expect(source).toContain("SUPPORT_ORIENTATION_SCORE_NOT_CHILD_DIAGNOSIS_OR_RANKING");
  });

  it("uses scorecard-backed issue tags and numbered recommendations", () => {
    expect(source).toContain("scorecard.core_issue_tags.slice(0, 3).map");
    expect(source).toContain("scorecard.recommendations.slice(0, 3).map");
    expect(source).toContain("{index + 1}");
    expect(source).not.toContain("function LayerCard");
  });

  it("keeps UI-04 gated by the single generation action and preserves a real empty state", () => {
    expect(source).toContain('router.push("/ui/UI-04" as Href)');
    expect(source).not.toContain('router.push("/ui/UI-08" as Href)');
    expect(source).toContain('decision_type: "CONFIRM"');
    expect(source).not.toContain('decision_type: "DISMISS"');
    expect(source).not.toContain("暂不形成成长方向");
    expect(source).toContain("先完成一次家庭测评");
    expect(source).toContain("完成测评后，法咪莉校长大模型会基于真实家庭上下文生成成长诊断与建议。");
  });

  it("shows only real collected context and hides missing personal fields", () => {
    expect(source).toContain("source_refs.assessment_session_id");
    expect(source).toContain("assessment_submitted_at");
    expect(source).toContain("formatDate");
    expect(source).toContain("filter(Boolean)");
    expect(source).toContain("测评时间：");
    expect(source).not.toContain("10岁");
    expect(source).not.toContain("四年级");
  });

  it("does not render the backend principal persona as an extra visible card", () => {
    expect(source).not.toContain("remote?.hypothesis?.principal");
    expect(source).not.toContain("remote.hypothesis.principal.public_role");
    expect(source).not.toContain("remote.hypothesis.principal.opening");
    expect(source).not.toContain("remote.hypothesis.principal.reading");
    expect(source).not.toContain("remote.hypothesis.principal.boundary");
    expect(source).not.toContain("家庭教育大模型 · 陪你一起看这次测评");
  });
});
