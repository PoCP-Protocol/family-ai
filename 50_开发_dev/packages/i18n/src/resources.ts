/**
 * @family/i18n — 翻译资源汇总（阶段 0：只有 common 命名空间的示例 key）。
 * 按方案 FAMILY_I18N_MULTILINGUAL_PLAN_V1.md §2.2：按页面/模块分 namespace 文件，
 * 此处先只接入 common.json 作为管道验证用例，后续阶段按 UI 页面逐个新增 namespace。
 */
import zhCNCommon from '../locales/zh-CN/common.json';
import enUSCommon from '../locales/en-US/common.json';

export const resources = {
  'zh-CN': {
    common: zhCNCommon.common,
  },
  'en-US': {
    common: enUSCommon.common,
  },
} as const;

export const NAMESPACES = ['common'] as const;
export const DEFAULT_NAMESPACE = 'common' as const;
