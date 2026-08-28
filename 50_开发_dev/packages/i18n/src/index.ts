/**
 * @family/i18n — 框架无关的 i18next 初始化工厂函数。
 *
 * 依据 FAMILY_I18N_MULTILINGUAL_PLAN_V1.md §1.3：
 * - 本包只负责「承载翻译资源 + 导出与框架无关的 i18next 实例初始化工厂」。
 * - mobile 用 `react-i18next` 的 `I18nextProvider` 包裹本包创建的实例。
 * - web 直接消费本包创建的裸 `i18next` 实例，调用 `.t()`。
 *
 * 阶段 0 范围：只搭管道，不迁移任何具体页面文案。
 */
import i18next, { type i18n as I18nInstance } from 'i18next';
import { resources, DEFAULT_NAMESPACE, NAMESPACES } from './resources';

/**
 * 与 packages/contracts 的 SupportedLocale 保持同步（阶段 0 只做 zh-CN / en-US 两种）。
 * 不直接 import @family/contracts，避免 packages/i18n 反向依赖 apps 层可能引入的构建耦合；
 * 后续如需强绑定，可改为 `import type { SupportedLocale } from '@family/contracts'`。
 */
export type SupportedLocale = 'zh-CN' | 'en-US';

export const DEFAULT_LOCALE: SupportedLocale = 'zh-CN';
export const SUPPORTED_LOCALES: readonly SupportedLocale[] = ['zh-CN', 'en-US'];

export interface CreateFamilyI18nOptions {
  /** 初始语言，默认 zh-CN。 */
  locale?: SupportedLocale;
  /** 是否使用一个全新的 i18next 实例（默认 true，避免多个消费方共享全局单例互相干扰）。 */
  isolated?: boolean;
}

/**
 * 创建并初始化一个 i18next 实例，携带 Family 的全部翻译资源。
 * 框架无关：mobile 用 I18nextProvider 包裹，web 直接调用 instance.t(...)。
 */
export function createFamilyI18n(options: CreateFamilyI18nOptions = {}): I18nInstance {
  const { locale = DEFAULT_LOCALE, isolated = true } = options;
  const instance = isolated ? i18next.createInstance() : i18next;

  // init() 返回 Promise，但配置是同步生效的（i18next 在资源已内联情况下可同步取值）。
  // 阶段 0 管道验证只需要同步可用，调用方如需等待 init 完成可 await 返回值上的 initPromise。
  void instance.init({
    lng: locale,
    fallbackLng: DEFAULT_LOCALE,
    supportedLngs: SUPPORTED_LOCALES as unknown as string[],
    ns: NAMESPACES as unknown as string[],
    defaultNS: DEFAULT_NAMESPACE,
    resources,
    interpolation: {
      escapeValue: false,
    },
    // 阶段 0 只做基础设施验证，关闭 debug 噪音；后续 mobile/web 接入排障期可临时打开。
    debug: false,
  });

  return instance;
}

export { resources, NAMESPACES, DEFAULT_NAMESPACE } from './resources';
