/**
 * SupportedLocale — Family 多语言支持的受支持语言集合。
 * 依据 FAMILY_I18N_MULTILINGUAL_PLAN_V1.md §3.1：
 * 不在每个 DTO 里加 locale 字段，语言判定走 HTTP `Accept-Language` header，
 * 仅在需要审计/持久化「当时用哪种语言生成」的场景（如 AI 生成内容）才在对应 DTO 上加字段。
 * 阶段 0 范围：只新增本类型，不改动其它任何现有类型定义。
 */
export type SupportedLocale = 'zh-CN' | 'en-US';
