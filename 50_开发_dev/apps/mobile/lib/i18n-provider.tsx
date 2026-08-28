/**
 * I18nProvider — Family mobile 端 i18n 管道接入（阶段 0，基础设施先行）。
 *
 * 依据 architecture/FAMILY_I18N_MULTILINGUAL_PLAN_V1.md §1.1/§1.3：
 * - 用 `@family/i18n` 的 createFamilyI18n() 工厂函数创建一个框架无关的 i18next 实例。
 * - 用 `react-i18next` 的 I18nextProvider 包裹，供页面用 useTranslation() 消费。
 * - expo-localization 提供设备语言检测，作为初始 locale 的推断依据（非强制切换）。
 *
 * 阶段 0 范围：只搭管道，不迁移任何现有页面文案。本文件不改动任何现有 UI 页面。
 */
import { createContext, useContext, useMemo, useState, useCallback } from "react";
import { I18nextProvider } from "react-i18next";
import * as Localization from "expo-localization";
import { createFamilyI18n, DEFAULT_LOCALE, SUPPORTED_LOCALES, type SupportedLocale } from "@family/i18n";

function detectInitialLocale(): SupportedLocale {
  try {
    const deviceLocales = Localization.getLocales();
    const deviceTag = deviceLocales?.[0]?.languageTag;
    const match = SUPPORTED_LOCALES.find(
      (locale) => deviceTag && deviceTag.toLowerCase() === locale.toLowerCase(),
    );
    return match ?? DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

type FamilyLocaleContextValue = {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
};

const FamilyLocaleContext = createContext<FamilyLocaleContextValue | null>(null);

export function useFamilyLocale(): FamilyLocaleContextValue {
  const ctx = useContext(FamilyLocaleContext);
  if (!ctx) {
    throw new Error("useFamilyLocale must be used within I18nProvider");
  }
  return ctx;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<SupportedLocale>(() => detectInitialLocale());
  const instance = useMemo(() => createFamilyI18n({ locale }), []); // eslint-disable-line react-hooks/exhaustive-deps

  const setLocale = useCallback(
    (next: SupportedLocale) => {
      setLocaleState(next);
      void instance.changeLanguage(next);
    },
    [instance],
  );

  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);

  return (
    <FamilyLocaleContext.Provider value={value}>
      <I18nextProvider i18n={instance}>{children}</I18nextProvider>
    </FamilyLocaleContext.Provider>
  );
}
