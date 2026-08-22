import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(__dirname, "../app/ui/UI-06.tsx"), "utf8");

describe("UI-06 original membership and mine baseline contract", () => {
  it("uses the original deep-blue membership card, invitation benefit and annual-service hierarchy", () => {
    expect(source).toContain("我的");
    expect(source).toContain("家庭成长陪伴第 68 天");
    expect(source).toContain("邀请 3 个家庭，解锁会员权益");
    expect(source).toContain("年度会员服务");
    expect(source).toContain("#092F76");
  });

  it("uses only existing downstream screens for the six original menu entries", () => {
    for (const target of ["UI-08", "UI-04", "UI-32", "UI-15", "UI-33", "UI-19", "UI-30"]) {
      expect(source).toContain(target);
    }
  });

  it("reads existing membership and commerce projections without creating payment or service booking commands", () => {
    expect(source).toContain("getMembershipCustomerProjection");
    expect(source).toContain("getCommerceCustomerProjection");
    expect(source).not.toContain("submitCommerceIntent");
    expect(source).not.toContain("submitServiceBooking");
    expect(source).not.toContain("createPrivateCheckinDraft");
  });
});
