# Family 前端多语言（i18n）落地方案 V1
## Family i18n / Multilingual Support Implementation Plan（草案 001）

> **状态：`DRAFT_FOR_IMPLEMENTATION_SEQUENCING_DECISION`。**
>
> 本文只做只读调研 + 方案设计，不包含任何代码改动。本文档确认：apps/mobile 与 apps/web 当前均无任何 i18n 基础设施（无框架依赖、无字典资源、无 locale 契约字段），约 1000 行中文文案硬编码分布在 35 个 mobile UI 文件 + web 主链路文件 + family-llm-gateway 静态文案表；同时发现 **packages/contracts 中存在字面量类型级别的中文硬编码**（如 `name_zh: '先听后回应'`），这是比一般 UI 文案更棘手的契约层问题，已纳入范围评估。

## 0. Context / 现状确认

### 0.1 技术栈核对结果

| 应用 | 实际技术栈 | 关键依据 |
|---|---|---|
| `apps/mobile` | Expo `~54.0.29` + `expo-router ~6.0.19` + React `19.1.0` + React Native `0.81.5` + NativeWind `^4.2.1` | `apps/mobile/package.json` |
| `apps/web` | **非 React**。原生 JS/TS，DOM 通过模板字符串 + `innerHTML` 手动构建（`main.js`、`app.js`、`platform-console.js`、`test-loop.js`、`waf.js`、`principal.js`、`experience/*`） | `apps/web/package.json`（无框架依赖，仅 `@family/contracts` + vitest/jsdom）、`apps/web/src/main.js` |

- `apps/mobile/app.config.ts` 无 `locales` 字段，未接入 `expo-localization`。
- 全仓库 `pnpm-lock.yaml` 无 `react-i18next` / `i18next` / `@lingui` / `formatjs` / `react-intl` 任何依赖。
- `packages/` 现有 9 个包（`ai-gateway`、`contracts`、`family-model`、`fes-contracts`、`harness`、`principal-ai`、`principal-runtime`、`program-runtime`、`waf-contracts`），无任何 i18n 专用包。

### 0.2 硬编码规模确认

- `apps/mobile/app/ui/UI-02.tsx`..`UI-34.tsx`（35 文件）：CJK 字符总量约 **25,300 字符**，且部分中文并非字符串值而是 **TypeScript 字面量联合类型**，例如：
  ```ts
  type FamilyStructure = "双亲家庭" | "单亲家庭" | "重组家庭";
  type ChildGender = "男孩" | "女孩";
  type ServicePreference = "看文字建议" | "生成计划草案" | "只保留记录";
  ```
  这类值同时是 UI 展示文案、状态机字面量、（在部分路径上）请求体字段值三重角色，不能简单地做「界面文案外置」而不动类型系统。
- `apps/web/src/{main.js, app.js, platform-console.js, test-loop.js, waf.js, principal.js, experience/*}`：中文以 HTML 模板字符串形式内嵌（例如 `main.js` 中一段 `innerHTML` 模板同时包含导航文案、表单 label、按钮文案、辅助说明文案），抽取难度高于 mobile 的 JSX 属性文案。
- `apps/api/src` 中含中文的非测试文件共 **73 个**，`family-llm-gateway.service.ts` 只是其中之一；其余文件多为错误信息、日志、（少量）领域文案。
- **`packages/contracts/src/index.ts:522`**：`InterventionCardDto.name_zh: '先听后回应'` —— 中文被写进契约的字面量类型定义本身，任何多语言化都必须先决定这个字段的契约语义（是否保留 `name_zh` 作为「事实字段」，另加 `name_i18n_key` 做展示层解耦）。

### 0.3 AI 生成文案路径确认（与静态映射表分离）

`family-llm-gateway.service.ts` 中的 `STOP_TEXT`（17-34 行）是**确定性、稳定 stop-code 键控**的静态中文文案表（例如 `LLM_DISABLED`、`LLM_PROVIDER_FAILURE` 等 enum → 固定中文句子），本质上已经是一个「key → message」字典，改造成本低。

但真正的生成式文案来自另一条路径：
1. `context-assembler.service.ts` 组装 `FamilyLlmSnapshot`（`use_case`、`policy_version`、`schema_version` 等结构化上下文，**显式禁止自由文本** `unstructured_text` 会直接拒绝）。
2. `packages/ai-gateway/src/index.ts` 的 `generateStructured()` 向模型发送 `system` 角色消息，内容包含 `use_case=...`、`prompt_version=...`、`schema_version=...`（约 180-190 行、480-590 行）。
3. 模型返回结构化 JSON，其中 `text_equivalent` 字段（`family-llm.contract.ts`，`minLength:1, maxLength:1600`）是模型生成的自然语言说明文本，经 `output-validator.ts` 校验后才展示给用户。

这条路径的语言目前完全由模型的默认输出语言决定（隐式中文），**没有任何显式语言控制信号**。这是本方案第 4 节的核心设计对象。

## 1. 框架选型

### 1.1 Mobile（Expo/React Native + expo-router + React 19）

推荐：**`i18next` + `react-i18next` + `expo-localization`**。

理由：
- Expo 官方文档推荐组合；`expo-localization` 提供设备语言/地区检测，与 `expo-router` 无冲突（路由本身不需要感知语言，语言只影响渲染内容）。
- `react-i18next` 的 `useTranslation()` hook 与现有代码风格一致（35 个 UI 文件已大量使用 `useColors()`、`useFamilyMobile()` 等自定义 hook 模式，引入 `useTranslation()` 心智负担最低）。
- 支持命名空间（namespace）按页面/功能域拆分资源文件，避免单一巨型字典文件。
- 支持 ICU 风格插值和复数规则，为后续英文复数形式（如 "1 day" / "2 days"）做好准备；中文没有复数但英文有，纯字符串拼接方案会在英文化时暴露此问题。
- 不推荐 `@lingui`：需要额外编译步骤（babel macro + extract CLI），在当前 Expo + Metro + esbuild 混合构建链路（`apps/mobile/package.json` 的 `dev`/`build` 脚本用 `tsx watch` + `expo start` + `esbuild`）中增加不必要的构建复杂度。
- 不推荐仅用 React 19 的原生 Context 手搓字典：缺少复数/插值/命名空间/懒加载能力，随着 34 个页面接入会重新发明 i18next 的功能子集。

需要新增依赖（仅列名，不动手安装）：`i18next`、`react-i18next`、`expo-localization`。

### 1.2 Web（原生 JS/TS，无框架，`innerHTML` 模板字符串）

推荐：**`i18next`（核心库，不带 React 绑定）+ 手写轻量取值辅助函数**，不引入任何 UI 框架适配层。

理由：
- `apps/web` 没有 React/Vue 等框架，`react-i18next` 不适用。`i18next` 核心库本身框架无关，可直接在 vanilla JS 里用 `i18next.t('key')` 取文案后拼进模板字符串，迁移路径最短（不需要重写现有 `innerHTML` 拼接方式，只需把中文字面量替换成 `i18next.t(...)` 调用）。
- 可复用与 mobile 相同的 `i18next` 生态和资源文件格式（JSON namespace 文件），实现「一套翻译资源，两端消费」，避免维护两份不同格式的字典。
- 不推荐引入 React/前端框架重写 `apps/web`：这是脱离本次 i18n 任务范围的架构级改动，成本和风险远超「加个语言切换」的诉求。
- `apps/web/package.json` 当前依赖极简（仅 `@family/contracts` + vitest 相关 devDependencies），引入 `i18next` 核心库的依赖增量很小，且不引入构建工具链变化（`apps/web` 用 `tsc --noEmit` + 自制静态 server，`i18next` 核心库是纯 ESM/CJS 兼容包，不需要额外打包配置）。

### 1.3 共享资源层建议

新增 `packages/i18n`（新 workspace 包），职责：
- 承载翻译资源 JSON（`locales/zh-CN/*.json`、`locales/en-US/*.json`）。
- 导出与框架无关的 `i18next` 实例初始化工厂函数，mobile 和 web 分别以各自适配层（`react-i18next` provider / 裸 `i18next.t`）消费同一份资源。
- 避免资源文件在 mobile 和 web 各自维护一份导致漂移（当前 mobile 和 web 文案已经部分重复，例如「家庭成长空间」「今天/成长测评/成长计划」等导航文案在 `apps/web/src/main.js` 和推测的 mobile 导航组件中都可能出现）。

## 2. 文案抽取策略

### 2.1 Key 命名规范

采用三段式：`<domain>.<screen_or_module>.<element>`，全小写 snake_case，例如：

```
assessment.ui02.family_structure.two_parent
assessment.ui02.family_structure.single_parent
assessment.ui02.boundary_text
assessment.ui02.service_preference.text_advice
gateway.stop_text.llm_disabled
gateway.stop_text.llm_provider_failure
portal.nav.home
portal.nav.growth_assessment
```

- `domain`：与现有目录/契约命名对齐（`assessment`、`journey`、`portal`、`gateway`、`intervention` 等），不新造术语体系，直接映射 `packages/contracts/src` 现有文件名前缀（`ui01-home`、`ui02-assessment`、`ui03-growth-hypothesis` 等）。
- `screen_or_module`：mobile 侧直接用 `ui02`、`ui03` 等对齐文件名，web 侧用模块名（`portal`、`platform-console`、`test-loop`）。
- 枚举值类文案（如 `FamilyStructure`）单独用 `.<enum_name>.<enum_value>` 子路径，保留可追溯性——这类 key 同时要解决 2.3 节的类型系统问题，不能只当普通 UI 文案处理。

### 2.2 文件组织：按 UI 页面分文件，而非单一大字典

推荐组织：

```
packages/i18n/
  locales/
    zh-CN/
      ui02-assessment.json
      ui03-growth-hypothesis.json
      ...（35 个 mobile 页面各一个 namespace 文件，与 UI-XX.tsx 一一对应）
      portal-nav.json          # web 端导航/壳层文案
      platform-console.json    # web 端运营控制台
      test-loop.json           # web 端测试流程壳
      gateway-stop-text.json   # family-llm-gateway 静态文案
      common.json              # 跨页面复用的通用词（"返回"/"暂停"/"确认"等）
    en-US/
      （与 zh-CN 镜像同名文件）
```

理由：
- 按页面分文件而非按功能域分文件，因为 35 个 UI 文件本身就是当前唯一稳定的"文案作用域"边界——每个 UI-XX.tsx 是一个独立开发/审阅单元，命名空间文件与之对齐可以让"迁移 UI-05 的文案"成为一个可以独立提交、独立 review 的最小变更单元，避免一次性大 PR。
- 单一大字典文件在 35 个页面 + 6 个 web 模块规模下会成为高频冲突点（多人同时改不同页面文案时在同一文件里打架），namespace 分文件从工程协作角度更优。
- `common.json` 承载跨页面复用词汇（返回、暂停、确认、提交等），减少重复 key。

### 2.3 类型字面量文案的特殊处理（关键难点）

对于 `type FamilyStructure = "双亲家庭" | "单亲家庭" | "重组家庭"` 这类同时是 UI 文案 + 状态字面量的类型，**不能**直接把字面量替换成 `t('...')` 的运行时字符串，否则破坏类型系统的字面量精确性（`useState<FamilyStructure>` 等）。

推荐做法：
1. 将字面量类型改为语义化英文/稳定枚举值（`"TWO_PARENT" | "SINGLE_PARENT" | "BLENDED"` ——注意 `apps/web/src/main.js` 第 49 行的 `<select>` 已经在用 `TWO_PARENT`/`SINGLE_PARENT`/`BLENDED` 这套英文枚举值，说明这个稳定枚举已经在 web 端存在，mobile 端的中文字面量类型反而是不一致的"技术债"，本次改造应向 web 端已有的枚举值对齐）。
2. UI 展示层通过 `t('assessment.ui02.family_structure.two_parent')` 从枚举值映射到当前语言文案，而不是直接把中文当枚举值用。
3. 这一步是**先做枚举值规范化，再做 i18n**，属于本方案范围内但需要单独排期的子任务（详见第 5 节迁移顺序）。

## 3. 契约层改造（packages/contracts）

### 3.1 需要新增的字段

- **请求侧**：不在每个 DTO 里加 `locale` 字段，而是走 HTTP 层的 `Accept-Language` header（标准做法），由 API 层统一解析后传入业务逻辑，不污染契约类型定义。契约层新增一个共享类型：
  ```ts
  export type SupportedLocale = 'zh-CN' | 'en-US';
  ```
  仅在真正需要"请求方显式指定语言且要被持久化/审计"的场景（例如 family-llm-gateway 的审计记录需要记录"当时用哪种语言生成的"）才在对应 DTO 里加字段，例如 `FamilyLlmGatewayAuditRecord` 增加 `output_locale: SupportedLocale`。
- **响应侧**：AI 生成类响应（`FamilyLlmGatewayResult`）建议增加 `text_equivalent_locale: SupportedLocale`，明确标记这段生成文案对应的语言，供审计回放（`audit-replay.service.ts`）和前端渲染判断是否需要提示"内容语言与界面语言不一致"。
- **`name_zh` 字段处理**：`InterventionCardDto.name_zh` 建议保留字段名不变（避免破坏现有消费方和审计记录的字段契约），但在类型层面从字面量类型 `'先听后回应'` 放宽为 `string`，同时新增 `intervention_code`（已存在）作为跨语言查找的稳定 key，展示层通过 `t('intervention.' + intervention_code + '.name')` 取当前语言文案，`name_zh` 逐步降级为"审计快照里的历史事实字段"而非"展示源"。这是一个**兼容性改造**，不是破坏性变更。

### 3.2 改动范围评估

- `packages/contracts/src/index.ts`：新增 `SupportedLocale` 类型（约 1 行）+ `InterventionCardDto.name_zh` 类型放宽（1 行改动，字面量类型 → `string`，需要检查所有消费方是否依赖了字面量类型推断，预计低风险因为审计流是只读消费）。
- `apps/api/src/modules/orchestration/llm-gateway/family-llm.contract.ts`：`FamilyLlmGatewayAuditRecord` 增加 `output_locale` 字段（需同步改数据库审计表 schema，属于本方案中改动面较大的一处，涉及 `audit-replay.service.ts` 的持久化逻辑）。
- 不需要改动的部分：本方案**不**建议在每一个业务 DTO（`FamilyDto`、`PersonDto`、`GrowthActionDto` 等）里加 `locale` 字段——这些是数据实体，不是展示文案载体，语言是渲染时决定的，不是数据的属性。混入 `locale` 字段到业务实体会造成契约膨胀且没有实际收益。

## 4. AI 生成文案的多语言化

这是本方案中风险最高、需要与生成式 AI 特殊性对齐设计的部分，STOP_TEXT 静态表和模型生成的 `text_equivalent` 必须分开处理。

### 4.1 STOP_TEXT 静态映射表：直接做成 locale 字典

```ts
const STOP_TEXT: Record<SupportedLocale, Record<string, string>> = {
  'zh-CN': { LLM_DISABLED: '当前智能说明未启用。...', ... },
  'en-US': { LLM_DISABLED: 'AI explanations are currently unavailable. ...', ... },
};
```
`stop()` 方法签名增加 `locale: SupportedLocale` 参数（来自请求 `Accept-Language` 解析），取值变为 `STOP_TEXT[locale][code] ?? STOP_TEXT[locale].LLM_PROVIDER_FAILURE`。这部分改动小、确定性强，可以独立于 AI 生成文案先落地。

### 4.2 模型生成的 `text_equivalent`：不做翻译，做"生成时指定输出语言"

**核心设计判断：不是让静态字符串替换方案去处理模型输出，而是把目标语言作为 prompt 的显式结构化输入，让模型直接用目标语言生成。**

理由（生成式 AI 的特殊性）：
- 模型输出要经过 `output-validator.ts` 校验（`FAMILY_LLM_DRAFT_JSON_SCHEMA`，`text_equivalent` 有 `minLength`/`maxLength` 约束），如果先用中文生成再做机器翻译，等于给这条本就有严格校验+审计要求的链路叠加一个不受控的二次转换层（翻译质量、翻译后是否仍满足长度约束、翻译是否引入政策外内容），风险不可控。
- `context-assembler.service.ts` 已经是"强类型、拒绝自由文本"的结构化上下文组装器（`unstructured_text` 直接拒绝），这条链路本来就是"结构化输入 → 结构化输出"的设计哲学，语言应该作为**结构化输入的一个字段**，与 `use_case`、`schema_version` 同级，而不是事后处理。

具体改造点：
1. `AssembleFamilyLlmContextInput` 新增 `output_locale: SupportedLocale` 字段（`context-assembler.service.ts`）。
2. `ContextAssemblerService.assemble()` 校验并冻结进 `FamilyLlmSnapshot`。
3. `packages/ai-gateway/src/index.ts` 的 `system` 消息拼接处（约 184-190 行、588-590 行）增加一行显式指令，例如 `output_locale=en-US`，并在 prompt 模板中明确要求"仅用该语言输出 `text_equivalent`，其余字段保持 schema 约定的机器可读值不受语言影响"（`title`/`body`/`text_equivalent` 是自然语言，`kind`/`referenced_candidates`/`tool_proposals` 等结构化字段不应随语言变化）。
4. **不维护"多语言 prompt 模板"这条路径**——即不为每个 `use_case` × 每种语言各写一份完整 prompt 模板。理由：`use_case` 数量会随功能增长，N 个 use_case × M 种语言的模板矩阵维护成本随 M 线性增长且容易在语言之间产生政策口径漂移（例如中文模板里的安全边界表述和英文模板表述不一致）。更安全的做法是**单一 prompt 模板 + 语言作为参数**，政策边界（"不诊断、不打分"等）只维护一份中间语言无关的规则描述，由模型自行用目标语言表达，保证边界语义在多语言间一致。
5. 校验层（`output-validator.ts`）的长度/格式约束（`minLength`/`maxLength: 1600`）需要重新评估是否对所有语言公平——英文表达同等信息量通常字符数更多（中文信息密度更高），`maxLength` 若按中文字符数标定，英文输出可能被迫截断或校验失败。建议把长度约束单位从"字符数"改为更语言中立的度量，或按 locale 分别设置上限。这是本方案发现的一个**隐藏耦合点**，需要在实施前明确决策。
6. 审计记录（`FamilyLlmGatewayAuditRecord`）落 `output_locale` 字段（见 3.1），保证审计回放时能重建"当时是用什么语言生成的"这一事实，支撑合规回溯。

### 4.3 明确排除的做法

- 不做"生成后机器翻译"：审计不可控、二次校验成本高、政策边界可能在翻译中漂移。
- 不做"客户端按浏览器语言拼接不同语言的 STOP_TEXT 硬编码"：所有语言判定必须发生在服务端（API 已知 `Accept-Language`），避免客户端和服务端语言判断逻辑重复维护。

## 5. 迁移策略与建议顺序

建议分四个阶段，**每阶段都是独立可验证、可回滚的最小增量**，不要求一次性打通全链路：

### 阶段 0（基础设施，先行）
- 创建 `packages/i18n` 包骨架 + `SupportedLocale` 类型进 `packages/contracts`。
- Mobile 接入 `i18next` + `react-i18next` + `expo-localization`，Web 接入 `i18next` 核心库，但**不迁移任何具体页面**，只搭好取值管道和语言切换开关（先用一个测试页面验证 zh-CN/en-US 切换生效）。
- 理由：所有后续阶段都依赖这个管道，先验证管道本身工作正常，避免在 35 个页面并行迁移时同时踩基础设施的坑。

### 阶段 1（Mobile 35 个 UI 页面，按页面独立提交）
- 先做 2-3 个"简单页面"（无枚举字面量类型、纯展示文案）验证 key 命名规范和 review 流程。
- 再处理有 2.3 节所述"类型字面量文案"的页面（如 UI-02 的 `FamilyStructure`/`ChildGender`/`ServicePreference`），这些需要先做枚举值规范化。
- 理由：先做 mobile 是因为 mobile 用 React + `react-i18next`，改造模式统一（`useTranslation()` hook 替换字符串），比 web 端的模板字符串拆解更机械化、更容易被工具辅助（可以写 codemod 脚本批量识别 JSX 中的中文字符串）。

### 阶段 2（Web 主链路文件）
- 从 `main.js`（382 行，改动面最小）开始，再到 `platform-console.js`（289 行）、`waf.js`（413 行）、`principal.js`（172 行），最后是最大的 `test-loop.js`（1459 行）。
- 理由：按文件行数从小到大排序，让团队先在小文件上跑通"模板字符串里嵌入 `i18next.t()` 调用"的模式，再啃最大的 `test-loop.js`。Web 端排在 mobile 之后，因为 web 端缺少 JSX 属性这种天然的"文案边界标记"，需要先在 mobile 积累抽取经验和工具（如果决定写 codemod）。

### 阶段 3（AI 生成文案：STOP_TEXT 先行，`text_equivalent` 参数化在后）
- 3a：`family-llm-gateway.service.ts` 的 `STOP_TEXT` 改造为 locale 字典（改动小、确定性强，独立验证）。
- 3b：`context-assembler.service.ts` + `ai-gateway` 的 `output_locale` 参数化 + 长度约束语言中立化评估（第 4.2 节第 5 点）。
- 理由：AI 生成文案排最后，因为它涉及模型行为的不确定性验证（需要跑评测集确认模型在 `output_locale=en-US` 时确实稳定输出英文且不违反政策边界），必须在静态文案链路（前三阶段）已经稳定后才引入这个变量，否则调试时无法区分"是 i18n 管道的 bug"还是"是模型输出不稳定"。

## 6. 明确"这次不做"的范围边界

- **不重写 `apps/web` 为 React/Vue 等框架**：这是独立的架构决策，不因 i18n 需求而触发。
- **不做"自动检测浏览器/设备语言后自动切换"之外的地区化（本地化）功能**：不做日期/货币/数字格式的 locale 化（`Intl.DateTimeFormat`/`Intl.NumberFormat`），本次仅做文案翻译；日期货币格式化留待有实际多币种/多地区业务需求时再做。
- **不支持中文以外的中文变体（繁体、粤语等）**：只做简中 `zh-CN` + 英文 `en-US` 两种，不预留繁中 `zh-TW` 的资源文件（key 结构兼容未来扩展，但本次不产出繁中翻译）。
- **不做机器翻译流水线**：所有 `zh-CN`/`en-US` 文案资源需要人工翻译或人工校对机器翻译初稿，不接入运行时翻译 API 做"实时翻译"。
- **不改动 `apps/api` 中与 UI 展示无关的中文**（错误日志、内部注释、代码内文档字符串）：73 个含中文文件中，只有面向用户展示的字段（如 `text_equivalent`、`STOP_TEXT`、`name_zh`）在本方案范围内，纯日志/注释不迁移。
- **不做契约层"业务实体加 locale 字段"的改动**（见 3.2）：`FamilyDto`/`PersonDto` 等不加语言字段。
- **不在本方案阶段做小程序/其它客户端的 i18n**：仓库中若存在小程序目标（`FAMILY_L0_NEED_PREFERENCE_UX_COPY_GOVERNANCE_DRAFT_001.md` 提到过"未来 App、Web 或小程序"），本方案不覆盖小程序，因为当前代码库未发现小程序端实现。
- **不解决 `InterventionCardDto` 之外的其它潜在字面量类型中文字段**：本方案只在阶段 1/2 迁移过程中发现即改，不做一次性全仓库字面量类型审计（那是一个独立的类型系统清理任务）。

## 7. 验证方式

- 阶段 0：新建一个隔离的测试页面/测试脚本，切换 `SupportedLocale` 后断言取到的文案值随之改变；mobile 用 Vitest/Jest 单测 `react-i18next` provider 渲染两种语言下的文本节点，web 用现有 `vitest` + `jsdom`（`apps/web` 已有 `vitest.config.ts`）新增用例断言 `i18next.t()` 在两种语言下返回值不同。
- 阶段 1/2：每个页面/文件迁移 PR 必须包含"切换语言后截图或 DOM 断言对比"，且原有该文件的现有测试（`apps/web/src/*.spec.ts` 已有大量同名 spec 文件）必须保持通过——文案外置不应改变任何断言依赖字符串匹配的现有测试逻辑（如果现有测试断言了具体中文字符串，需要同步改为断言 key 或改为 zh-CN 默认值下的字符串，需在 PR 中说明）。
- 阶段 3a：新增单测覆盖 `STOP_TEXT[locale][code]` 在两种 locale 下都返回非空字符串，且覆盖所有 stop code。
- 阶段 3b：在评测集（`evals/` 目录，若已有 family-llm-gateway 相关评测夹具）中新增 `output_locale=en-US` 的用例，人工审阅模型输出是否语言正确、是否仍满足 `output-validator.ts` 的 schema 约束、是否触发误报的长度校验失败；建议先以离线评测跑 20-30 个夹具样本再决定是否放开英文输出。

## Critical Files for Implementation

- `apps/mobile/app/ui/UI-02.tsx` （代表性页面，含类型字面量中文，验证抽取模式的基准案例）
- `apps/web/src/main.js` （web 端最小、最先迁移的入口文件）
- `packages/contracts/src/index.ts` （SupportedLocale 新增位置；InterventionCardDto.name_zh 字面量类型改造点）
- `apps/api/src/modules/orchestration/llm-gateway/family-llm-gateway.service.ts` （STOP_TEXT locale 化改造点）
- `apps/api/src/modules/orchestration/llm-gateway/context-assembler.service.ts` （output_locale 参数注入点）
- `packages/ai-gateway/src/index.ts` （system prompt 拼接处，注入语言指令的具体位置）
- `apps/mobile/app.config.ts` （expo-localization 接入点）
