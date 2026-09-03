import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { UI01_HOME_TARGETS } from "../lib/family/ui01-home-entry-map";

describe("UI-01 original-home hotspot contract", () => {
  it("keeps every confirmed original hotspot as an entry to its later UI", () => {
    expect(UI01_HOME_TARGETS).toEqual({
      freeAssessment: "UI-02",
      aiInterpretation: "UI-03",
      camp21: "UI-35",
      plan90: "UI-04",
      growthStories: "UI-12",
      expertLive: "UI-19",
      familyAdvisor: "UI-19",
      dailyTasks: "UI-09",
      recommendations: "UI-13",
    });
  });

  it("does not route original UI-01 hotspots to a second home-only workflow", () => {
    expect(Object.values(UI01_HOME_TARGETS)).not.toContain("UI-01");
  });

  it("binds every confirmed hotspot in the real home source and keeps its target page", () => {
    const homeSource = readFileSync(resolve(process.cwd(), "app/(tabs)/index.tsx"), "utf8");
    for (const [key, target] of Object.entries(UI01_HOME_TARGETS)) {
      expect(homeSource).toContain(`UI01_HOME_TARGETS.${key}`);
      expect(existsSync(resolve(process.cwd(), `app/ui/${target}.tsx`))).toBe(true);
    }
  });

  it("reads today action, journey, reviewed content, service supply and commerce catalog from the same family API session", () => {
    const homeSource = readFileSync(resolve(process.cwd(), "app/(tabs)/index.tsx"), "utf8");
    expect(homeSource).toContain("familyApi.getTodayGrowthAction");
    expect(homeSource).toContain("familyApi.getJourneyPlan");
    expect(homeSource).toContain("familyApi.getInterventionLibrary");
    expect(homeSource).toContain("familyApi.getServiceOfferings");
    expect(homeSource).toContain("familyApi.getCommerceProducts");
    expect(homeSource).toContain("useFamilyApiSession");
  });

  it("keeps unavailable data visible as a recoverable state and does not claim educational outcomes", () => {
    const homeSource = readFileSync(resolve(process.cwd(), "app/(tabs)/index.tsx"), "utf8");
    expect(homeSource).toContain('state="loading"');
    expect(homeSource).toContain('state="error"');
    expect(homeSource).toContain("onRetry={() => { void loadExperience(); }}");
    expect(homeSource).toContain("不代表已经产生教育结果");
  });
});
