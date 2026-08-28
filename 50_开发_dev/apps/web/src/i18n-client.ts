/**
 * i18n-client — Family web 端裸 i18next 初始化管道（阶段 0，基础设施先行）。
 *
 * 依据 architecture/FAMILY_I18N_MULTILINGUAL_PLAN_V1.md §1.2：
 * apps/web 无 React/Vue 等框架，直接用 `@family/i18n` 创建的 i18next 核心实例，
 * 在现有 innerHTML 模板字符串拼接处调用 `t(...)` 取文案，不引入任何框架适配层。
 *
 * 阶段 0 范围：只搭管道 + 一个语言切换开关，不迁移 main.js/app.js 等现有页面文案。
 * 本文件不修改任何现有 web 页面文件。
 */
import { createFamilyI18n, DEFAULT_LOCALE, SUPPORTED_LOCALES, type SupportedLocale } from '@family/i18n';

const STORAGE_KEY = 'family.web.locale';

function readStoredLocale(): SupportedLocale {
  try {
    if (typeof localStorage === 'undefined') return DEFAULT_LOCALE;
    const stored = localStorage.getItem(STORAGE_KEY);
    const match = SUPPORTED_LOCALES.find((locale) => locale === stored);
    return match ?? DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

/** 裸 i18next 实例，供 main.js 等模板字符串处调用 `t('common:xxx')`（阶段 2 迁移时接入）。 */
export const i18n = createFamilyI18n({ locale: readStoredLocale() });

/** 取值辅助函数，风格与方案文档 §1.2 一致：`t(key)` 直接拼进模板字符串。 */
export function t(key: string, options?: Record<string, unknown>): string {
  return i18n.t(key, options);
}

/** 语言切换开关：供测试页面 / 未来壳层导航调用。 */
export async function setLocale(locale: SupportedLocale): Promise<void> {
  await i18n.changeLanguage(locale);
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, locale);
    }
  } catch {
    // localStorage 不可用（如某些测试环境），忽略持久化失败，不影响当前会话内的语言切换。
  }
}

export function getLocale(): SupportedLocale {
  return (i18n.language as SupportedLocale) ?? DEFAULT_LOCALE;
}

export { SUPPORTED_LOCALES, DEFAULT_LOCALE };
export type { SupportedLocale };
