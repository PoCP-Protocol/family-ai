/**
 * 阶段 0 管道验证（mobile 侧）：
 * 不渲染完整 RN 组件树（本仓库尚无 jest-expo / react-test-renderer 测试基座，
 * 引入属于超出本任务范围的测试基础设施变更），改为直接验证 mobile 实际消费的
 * `@family/i18n` 工厂函数在 zh-CN / en-US 下对同一个 key 返回不同文案 —— 这正是
 * I18nProvider 内部对 react-i18next 实例做的初始化路径，覆盖了「取值管道」本身。
 * 真正的组件渲染级验证（useTranslation() 在树中随 Provider 切换）留待接入具体页面时
 * 一并引入 RN 测试基座（阶段 1 范围），此处如实标注未覆盖。
 */
import { describe, expect, it } from "vitest";
import { createFamilyI18n } from "@family/i18n";

describe("mobile i18n 管道（createFamilyI18n，被 I18nProvider 使用）", () => {
  it("zh-CN 与 en-US 对同一 common key 返回不同文案", () => {
    const zh = createFamilyI18n({ locale: "zh-CN" });
    const en = createFamilyI18n({ locale: "en-US" });

    expect(zh.t("common:confirm")).toBe("确认");
    expect(en.t("common:confirm")).toBe("Confirm");
    expect(zh.t("common:confirm")).not.toBe(en.t("common:confirm"));
  });
});
