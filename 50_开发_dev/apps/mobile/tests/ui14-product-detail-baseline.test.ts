import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
const source = readFileSync(resolve(__dirname, "../app/ui/UI-14.tsx"), "utf8");
describe("UI-14 original product-detail baseline contract", () => {
  it("restores detail header, price tiers, three assurances, delivery heading, invite offer and two action layout", () => {
    for (const copy of ["商品详情", "21天成长陪伴", "你将获得", "训练营 ＋ 打卡社群 ＋ 顾问答疑", "分享给 3 位家长", "立即购买", "发起拼团"]) expect(source).toContain(copy);
  });
  it("keeps purchase as a controlled intent and group action as the UI-16 route", () => {
    expect(source).toContain("submitCommerceIntent");
    expect(source).toContain('router.push(`/ui/UI-16?productRef=');
    expect(source).toContain("不会扣款");
  });
  it("does not add a payment SDK or external order placement", () => {
    expect(source).not.toMatch(/paymentIntent|checkout|支付宝|微信支付/);
  });
});
