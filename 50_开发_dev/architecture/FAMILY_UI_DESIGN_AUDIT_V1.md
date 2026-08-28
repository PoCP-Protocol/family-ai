# Family UI Design Audit V1

```text
DOC_KIND       = DESIGN_AUDIT
STATUS         = DRAFT_READ_ONLY
SCOPE          = apps/mobile/app/ui/UI-02.tsx .. UI-34.tsx + app/ui/UI-02-result.tsx + app/(tabs)/index.tsx (UI-01)
METHOD         = STATIC_CODE_READ_ONLY_NO_RUNTIME_RENDER
BASE_REPO      = apps/mobile (Expo + expo-router + React 19 + React Native + NativeWind)
AUDIT_DATE     = 2026-08-28
AUDITOR        = Claude (research agent, read-only)
NOT_A_SOT      = 本文档是设计评估意见，不是新的执行契约；不覆盖 governance/ 下任何 RUNTIME_MATRIX 或 CANONICAL_MAP 的权威性
```

## 0. 审计方法与边界（先说清楚能不能信）

本次审计**完全基于代码结构阅读**，没有启动 Expo/Metro、没有渲染真机或浏览器截图、没有做像素级视觉对比。结论来自：

1. 逐个读取 `app/ui/UI-02.tsx`、`UI-03.tsx`、`UI-10.tsx`、`UI-31.tsx`、`UI-33.tsx` 等代表性文件的实际 JSX/StyleSheet；
2. 对全部 33 个 `UI-*.tsx` 文件（`UI-02`–`UI-34` 加 `UI-02-result`，`UI-01` 在 `app/(tabs)/index.tsx`）做结构化扫描（行数、`Pressable`/`ScrollView`/`FlatList`/`TextInput`/`Modal`/`accessibility*`/`hitSlop`/loading·error 关键字出现次数）；
3. 复用仓库里已经存在、且与代码实况交叉验证过的既有研究文档：`research/ui01-ui34-mobile-completion-audit.md`、`research/family-ai-mobile-comprehensive-review-2026-08-22.md`、`research/ui01-ui35-projection-state-audit.tsv`、各 `research/ui*-original-screen-alignment.md`、`research/ui*-baseline-audit.md`；
4. 查看 `research/baselines/` 下的对标截图目录结构（未逐张打开做像素比对，只确认存在性与命名映射）。

**这次审计没有覆盖、请勿引用为已验证的部分：**

- 没有做真机/浏览器渲染截图，因此"视觉层次是否好看""颜色是否真的达到 WCAG 对比度数值"等判断均为**代码可推断的结构性判断**，不是像素测量结果。
- 没有测量真实点击热区尺寸（只统计 `hitSlop`/`minHeight` 等代码线索）。
- 没有做 Dynamic Type（系统字体放大）下的真实断行/溢出测试。
- 没有验证 iOS/Android 手势返回（如 Android 物理返回键、iOS 边缘滑动）与 `expo-router` 默认行为在真机上的实际手感。
- 没有验证深色模式（`useColorScheme`）下每页视觉的真实呈现，只确认了 `useColors()` 机制存在。
- 不对业务/合规边界（诊断、排名、支付等 GOVERNANCE 红线）做二次评审——那部分已经由 `research/ui01-ui34-mobile-completion-audit.md` 的"反向审计缺陷池"覆盖，本文档只谈设计/交互/视觉/一致性/可访问性结构层面。

---

## 1. 设计体系认知（先建立参照系）

- 主题：`hooks/use-colors.ts` → `constants/theme.ts`（薄转发）→ `lib/_core/theme.ts`（实现）。提供 `Colors[light|dark]` 调色板，`useColors()` 返回 `{ text, background, surface, border, muted, tint, ... }`。**这是全项目唯一的官方配色入口**。
- 共享壳组件：`components/screen-container.tsx`（Safe Area 容器）、`components/family/family-refresh-control.tsx`（`FamilyRefreshControl` 下拉刷新 + `FamilyFlatList`）、`components/family/data-source-banner.tsx`（"数据来源"横幅，用于区分真实投影/本机草稿/占位态）、`components/ui/icon-symbol.tsx`（跨平台 SF Symbol 图标）。
- **但大量页面并不使用这些共享组件**，而是每页各自用 `Pressable` + 手写 `StyleSheet.create` 内联颜色（大量 `#2563EB`、`#1B7CF2`、`#16866D` 等硬编码色值散落在各页面样式表中，并未统一引用 `useColors()` 的 tint/accent），这是下文"系统性问题模式 1"的主要证据来源。
- 对标基线：`research/baselines/` 下按批次分组（`ui02/`、`ui03/`、`ui19-ui24/`、`ui25-ui28/`、`ui29-ui34/`、`ui35-original/`），命名与原始设计稿（榜样教育系原图，35 页含 UI-35 附加基线）一一对应。**只有 UI-01 至 UI-05、UI-07 至 UI-10、UI-14 有随基线同步的 `research/ui*-original-screen-alignment.md` 逐页对齐记录**；UI-06、UI-11~UI-13、UI-15~UI-34 中的大部分只以批次审计文档（如 `ui13-ui18-baseline-audit.md`、`ui19-ui24-service-baseline-audit.md`）形式存在，逐控件级差异未见记录。
- 代表性页面代码风格对比：
  - `UI-02.tsx`（439 行）— 多步骤表单，`useState` 管理 7+ 个字段，含真实 API 会话（`familyApi.getFamilyAssessment` / `startFamilyAssessment` / `saveFamilyAssessmentResponse` / `submitFamilyAssessment`）、幂等键生成、loading/error/empty 状态、`accessibilityRole`/`accessibilityState`/`accessibilityHint` 标注齐全。是目前全项目**唯一**达到"生产级交互 + 可访问性标注"水准的页面。
  - `UI-10.tsx`（68 行）— 视觉层最"精心设计"的一页（云朵装饰、能量条、卡通角色几何图形拼接），但只有 1 处 `accessibilityRole`/`accessibilityLabel`（返回按钮），无 loading/error 状态处理，远端数据失败时静默 `.catch(() => undefined)`。
  - `UI-31.tsx`（35 行）/`UI-33.tsx`（30 行）/`UI-32.tsx`（25 行）/`UI-34.tsx`（29 行）— 全部写成单表达式返回的高密度 JSX（一行几百字符），无 `accessibilityRole`、无 loading/error 分支，远端请求失败同样静默吞掉。这是目前代码里最"占位符/脚手架"级别的一批实现。

---

## 2. 34 页总览表（UI-01 至 UI-34，含 UI-02-result）

评级说明：
- **成熟度**：A=有 loading/error/empty 状态设计 + 可访问性标注 + 与基线逐页对齐记录；B=有完整视觉层次和交互但缺 a11y/异常态；C=基础可用但样式高度模板化、缺变化和异常态；D=最小骨架/脚手架级（<40 行、无异常态、无 a11y）。
- **闭环**：按 `lib/family/ui-registry.ts` 的 `loop` 字段（成长/计划/评估/服务/商业/社区），映射到用户给出的六循环命名。

| UI | 用途（源自 registry `subtitle`） | 闭环 | 复杂度 | 成熟度 | 对标基线 | 备注 |
|---|---|---|---|---|---|---|
| UI-01 | 家庭成长首页 | GOLDEN_GROWTH_LOOP(成长) | 展示+路由分发 | B | `ui35-original/home-screen-ui-crop.png` | 在 `app/(tabs)/index.tsx`，非独立 UI 文件；已有 `ui01-home-entry-map.test.ts` 但视觉截图仍"待采集" |
| UI-02 | 家庭测评（五主题+深追题） | 评估 | 多步骤表单 | **A** | `ui02/core-02-assessment.png` + `family-assessment-step2-reference.png` | 全项目最完整实现，439 行，9/9 测试通过 |
| UI-02-result | 测评完成回执 | 评估 | 纯展示 | C | 同 UI-02 | 162 行，0 处 a11y/loading/error 关键字命中 |
| UI-03 | 家庭成长解读 | 评估 | 展示+条件分支多 | B | `ui03/core-03-ai-report.png` | 275 行，5 处 loading、4 处 error，仅 1 处 a11y |
| UI-04 | 90 天成长方案 | 计划 | 多步骤+FlatList | B | 未见独立 baseline 图，有 `ui04-original-screen-alignment.md` | 310 行，含 create/confirm plan 幂等链路 |
| UI-05 | 90 天陪跑 | 计划 | 多状态服务卡 | B | 无独立截图，有 alignment 文档 | 234 行，有轻量点击反馈动效 |
| UI-06 | 我的会员 | 商业 | 展示+FlatList | C | 无 | 175 行，0 处 a11y/loading/error |
| UI-07 | 成长测评入口 | 评估 | 展示+同意确认 | B | 有 alignment 文档 | 93 行，短小但有基础状态处理 |
| UI-08 | 家庭过程回顾 | 评估 | 展示 | B | 有 alignment 文档 | 88 行，7 处 empty 态引用（按 tsv 审计） |
| UI-09 | 今日成长任务 | 成长 | 表单（TextInput×2） | C | 有 alignment 文档 | 145 行，无远端 loading/error 标注 |
| UI-10 | 孩子成长小助手 | 成长 | 展示，视觉最精心 | B/C | 有 alignment 文档 + `ui10-ui12-child-growth-design.md` | 68 行但视觉密度高；无异常态兜底 |
| UI-11 | 我们的成长节奏 | 成长 | 展示+FlatList | C | 有 alignment 文档 | 61 行 |
| UI-12 | 成长故事卡 | 社区 | 展示 | C | 有 alignment 文档 | 69 行 |
| UI-13 | 家庭成长商城 | 商业 | 列表+分类 | C | `ui13-ui18-baseline-audit.md` | 148 行，0 处 a11y |
| UI-14 | 成长方案详情 | 商业 | 详情+多操作 | B | 同上 | 316 行，最多 `Pressable`（15），有 error 处理但 0 处 a11y |
| UI-15 | 邀请有礼 | 商业 | 表单+分享草稿 | C | 同上 | 175 行 |
| UI-16 | 家庭同行计划 | 商业 | 表单 | C | 同上 | 160 行 |
| UI-17 | 成长积分 | 商业 | 列表+任务卡 | C | 同上 | 171 行 |
| UI-18 | 会员中心 | 商业 | 展示 | C | 同上 | 191 行 |
| UI-19 | 名师专区 | 服务 | 列表+筛选+TextInput | C | `ui19-ui24-service-baseline-audit.md` | 177 行 |
| UI-20 | 名师详情 | 服务 | 详情 | C | 同上 | 131 行 |
| UI-21 | 在线咨询预约 | 服务 | 多步骤表单+Modal×3 | C | 同上 | 146 行，唯一大量用 `Modal` 的页面 |
| UI-22 | 沙龙活动 | 服务 | 列表+筛选+TextInput | C | 同上 | 94 行 |
| UI-23 | 活动详情 | 服务 | 详情+Modal×3 | C | 同上 | 90 行 |
| UI-24 | 我的咨询与活动 | 服务 | 列表/状态分组 | C | 同上 | 78 行 |
| UI-25 | 家长社区 | 社区 | 信息流+TextInput | C | `ui25-ui28-community-baseline-audit.md` | 100 行 |
| UI-26 | 发布家庭小记 | 社区 | 表单（TextInput×3） | C | 同上 | 96 行 |
| UI-27 | 家庭小记详情 | 社区 | 详情+评论 | C | 同上 | 86 行 |
| UI-28 | 我的社区 | 社区 | 列表 | C | 同上 | 77 行 |
| UI-29 | 成长成果 | 评估 | 展示+FlatList | D | `ui29-ui34-baseline-audit.md` | 90 行 |
| UI-30 | 年度陪伴方案 | 商业 | 展示 | C | 同上 | 125 行 |
| UI-31 | 我的服务 | 服务 | 展示，单表达式 JSX | **D** | 同上 | 35 行，全项目最短之一 |
| UI-32 | 订单与资产 | 商业 | 展示，单表达式 JSX | **D** | 同上 | 25 行，全项目最短 |
| UI-33 | 家庭档案 | 成长 | 展示，单表达式 JSX | **D** | 同上 | 30 行 |
| UI-34 | 服务记录 | 服务 | 展示，单表达式 JSX | **D** | 同上 | 29 行 |

数据来源交叉核对：上表"复杂度/成熟度"列的量化线索（行数、`Pressable`/`accessibility*`/loading·error 关键字计数）来自本次对 `app/ui/UI-*.tsx` 的逐文件 grep 扫描；"对标基线"列参照 `research/baselines/` 目录结构与既有 `research/ui*-baseline-audit.md`/`ui*-original-screen-alignment.md` 文档的映射关系交叉确认。

---

## 3. 系统性设计问题模式（跨页面重复出现）

### 模式 1 — 色彩系统未被统一消费，硬编码色值蔓延
`useColors()` 是官方主题入口，但绝大多数页面在 `StyleSheet.create` 里直接写十六进制色值（`#2563EB`、`#1B7CF2`、`#16866D`、`#F2A61C` 等），且**同一语义颜色在不同页面用了不同的十六进制值**（例如"主要行动蓝"在 UI-02 是 `#1B7CF2`，在 UI-31/UI-33 是 `#2563EB`）。深色模式下这些硬编码色块不会跟随 `useColors()` 切换，`colors.text`/`colors.muted`/`colors.border` 只用于文字和描边，背景色块、按钮底色、图标底色大多绕过主题系统。
**影响页面**：几乎全部 34 页，UI-02/UI-04/UI-05 相对较轻（仍有硬编码但同时用了 `colors.*`），UI-10/UI-31/UI-33/UI-06/UI-13 等纯硬编码。

### 模式 2 — 可访问性标注高度不均，24/33 个文件零命中
`accessibilityRole`/`accessibilityLabel`/`accessibilityState`/`accessibilityHint` 的出现次数扫描显示：UI-02（13 处）、UI-03/UI-04/UI-05/UI-07/UI-08/UI-09/UI-10/UI-11/UI-12/UI-14（各 1–2 处）之外，**UI-06、UI-13、UI-15~UI-20、UI-22~UI-28（除个别）、UI-29~UI-34 共 20 个文件命中为 0**。这些页面里的可点击卡片、图标按钮、Modal 触发器对屏幕阅读器基本不可用（无 role、无 state），选中态/展开态等视觉变化（如筛选 chip 的高亮）也没有对应的 `accessibilityState`。

### 模式 3 — loading / error / empty 状态设计集中在少数"重做过"的页面，其余静默失败
`research/ui01-ui35-projection-state-audit.tsv` 与本次扫描一致地显示：UI-02/03/04/05/08/10/11 等经过"严格原图对齐"轮次的页面有明确的 loading/error/empty 文案（例如 UI-02 的"暂时无法读取测评记录，点击重试"）；而 UI-06、UI-13、UI-15~UI-20、UI-27~UI-34 等页面的远端请求普遍写成 `.then(...).catch(() => undefined)`，请求失败后页面**没有任何用户可见提示**，UI 停留在初始/空状态，用户无法区分"这个家庭确实没有数据"和"网络请求失败了"。

### 模式 4 — 组件复用不足，同一视觉元素被反复手写
下拉刷新（`FamilyRefreshControl`）、数据来源横幅（`DataSourceBanner`）、`ScreenContainer` 已经是共享组件，但很多页面的"卡片""进度条""chip 选择器""空状态提示"是逐页手写 `View`+`StyleSheet` 组合，而不是抽出共享的 `Card`/`ProgressBar`/`Chip`/`EmptyState` 组件。这造成同类元素在不同页面的圆角（`borderRadius` 出现 6/8/10/12/14/15/16/17/18/20/22 等十余种取值）、内边距、字重不完全一致，也让"改一处、全站同步"变得困难。

### 模式 5 — 高密度单表达式 JSX（UI-31/32/33/34 尤为典型）
这四页把整屏 UI 写成一个巨大的单行三元/展开表达式 JSX（有的单行超过 2000 字符），没有拆分成可读的子组件或多个 `return` 分支。这不是"够不够好看"的问题，是**可维护性和后续可访问性/异常态补齐成本**的问题——在这种写法上加 `accessibilityRole` 或 loading 分支，改动风险和 diff 噪音会显著高于结构化组件写法。

### 模式 6 — 多步骤流程缺少统一的进度/导航范式
UI-02（测评）用了"第 2/5 步 + 进度条"模式，但 UI-04（90 天方案，四阶段）、UI-21/UI-23（预约/活动的多步 Modal 流程）没有采用同样的步骤指示器范式，each 各自发明了自己的阶段展示方式（UI-04 用 FlatList 卡片列表暗示阶段，UI-21/23 用 Modal 堆叠）。对多步骤任务而言，缺少统一的"你在第几步、还剩几步"心智模型。

### 模式 7 — Modal 使用集中且分散，无统一容器规范
只有 UI-21 与 UI-23 大量使用 `Modal`（各 3 处），其余 31 个页面完全不用 `Modal`；这两页的弹层交互（预约表单、活动确认）是否遵循同一动效/关闭手势/背景蒙层规范，仅从代码结构无法判断，需要运行态验证，但至少可以确认：**Modal 不是全站统一的"二次确认/子表单"范式**，其余页面遇到类似需求时用的是页面内展开区块（如 UI-02 的年龄下拉）而非 Modal，两种范式并存但没有明确的选用准则。

---

## 4. 设计评估维度速览（表格化）

| 维度 | 总体判断 | 证据 |
|---|---|---|
| 视觉层次与信息密度 | UI-02/UI-04/UI-05/UI-10/UI-14 层次清晰（分区块+图标+色块引导视线）；UI-31/32/33/34 因单表达式写法难以判断实际渲染层次，风险偏高 | 直接代码阅读 |
| 交互流程清晰度（多步骤） | 仅 UI-02 有清晰的步骤指示器（"第 2/5 步"+进度条）；UI-04 的四阶段、UI-21/23 的多步 Modal 均缺少同等力度的进度提示 | 直接代码阅读 |
| 跨页一致性（组件/间距/色彩） | 弱。硬编码色值不统一、圆角取值分散、卡片/空态/进度条各页手写而非复用组件 | grep 统计 + 代码阅读 |
| 可访问性基本要素 | 弱且两极分化。9/33 文件有较完整 `accessibility*` 标注，24/33 为零；`hitSlop` 仅 4 个文件出现；对比度/字体缩放未验证（需运行态） | grep 统计（数量结论可信，视觉对比度需运行态复核） |
| 移动端平台惯例 | `expo-router` + `Stack.Screen`统一提供了标准返回栈行为；`ScreenContainer` 统一处理 Safe Area；但部分页面自定义顶部栏（如 UI-02/UI-10 用手写"‹"返回箭头代替系统 header），与用 `Stack.Screen headerShown: true` 的页面（UI-31/33 等）并存两种返回栈范式 | 代码阅读，未在真机验证手势返回体验 |

---

## 5. Top 优先改进建议（按优先级）

> 排序依据：测评/成长闭环核心页面优先 → 交互复杂但视觉/工程粗糙页面优先 → 跨页重复问题模式优先。

**1. 建立一个真正被消费的 `useColors()`/Token 层，收敛硬编码色值（模式 1，影响面最广）**
不是重新设计配色，而是把当前散落在各页面 `StyleSheet` 里的十六进制色值（主要行动蓝、成功绿、警示橙等）迁移成 `constants/theme.ts` 里命名好的语义 token（如 `colors.primary`、`colors.success`），再逐页替换引用。建议先从 UI-02/UI-04/UI-05（已经在改）扩展到 UI-06/UI-13/UI-31/UI-32/UI-33/UI-34，因为后者硬编码密度最高、也最"薄"，改动成本最低、收益立即体现在深色模式一致性上。

**2. 把 UI-31/UI-32/UI-33/UI-34 从"单表达式脚手架"重构为结构化组件（模式 5，具体到位）**
当前这四页把整屏写成一行超长 JSX。建议：拆出 `HeroCard`/`ProgressBar`/`ProfileCard`/`TimelineRow`/`EmptyState` 等子组件（哪怕先只是同文件内的具名函数组件，参照 UI-10 已有的 `Collection` 子组件写法），再在拆分后的结构上补 `accessibilityRole`/loading/error 分支。拆分本身不改变可见视觉结构（符合"反向审计原则"里"不动基线视觉"的约束），只降低后续补可访问性/异常态的成本。

**3. 给 20 个零可访问性标注页面补齐最小 `accessibilityRole`/`accessibilityLabel`/`accessibilityState`（模式 2，具体到位）**
优先顺序：UI-06（会员权益）、UI-13/UI-14（商城/详情，Pressable 最多的页面之一）、UI-19~UI-24（服务预约，涉及真人服务承诺前的确认动作，可访问性缺失风险更高）、其余列表/详情页收尾。每个可点击卡片至少补 `accessibilityRole="button"` + 有意义的 `accessibilityLabel`（不能是"卡片"这种空泛标签）；选中态 chip/单选补 `accessibilityState={{ selected }}`；折叠/展开控件补 `accessibilityState={{ expanded }}`（参照 UI-02 的年龄下拉写法）。

**4. 把 `.catch(() => undefined)` 的静默失败改成可见的重试提示（模式 3，具体到位）**
以 UI-02 已有的"暂时无法读取测评记录，点击重试"为范式，给 UI-06/UI-13/UI-15~UI-20/UI-27~UI-34 这批远端请求补一个 `projectionState`（`idle|loading|ready|error`）+ 失败时的可点击重试文案。这不需要改业务逻辑或后端契约，只是把已经存在的 catch 分支从"吞掉"改成"设置一个 error 状态并渲染一行提示"。

**5. UI-02/UI-04 已有的步骤指示器范式，推广到 UI-21/UI-23 的多步 Modal 流程（模式 6，具体到位）**
UI-21（在线咨询预约）与 UI-23（活动详情+意向）目前用堆叠的 `Modal` 承载多步操作，用户看不到"这是第几步、还剩几步"。建议在 Modal 顶部加一个与 UI-02 一致的步骤条组件（复用同一视觉规范：细进度条+"第 N/M 步"文字），而不是发明新样式。

**6. 抽出共享的 `Card`/`ProgressBar`/`Chip`/`EmptyState` 组件，替换各页面手写等价物（模式 4）**
先从出现频率最高的三种元素入手：卡片容器（`borderWidth:1 + borderRadius + padding` 的组合在 30+ 处重复出现，圆角取值不统一）、进度条（`track+fill` 两层 View 的写法在 UI-02/04/05/10/31 等至少 5 处重复）、空状态提示（`empty` 区块在 UI-08/29/33 等重复且文案结构类似）。抽出后统一放进 `components/family/` 目录，与已有的 `data-source-banner.tsx`、`family-refresh-control.tsx` 并列。

**7. UI-02 的补充信息区（年龄下拉+三组 ChoiceRow）目前是单页长表单，交互密度偏高**
UI-02 已经是全站最成熟的页面，但页面本身仍是"聚焦问题选择 + 深追题网格 + 年龄下拉 + 三组 chip 选择 + 同意勾选 + 提交"一次性铺在同一个滚动页里（439 行，第 2/5 步却承担了远超一步的信息量）。建议：把"再了解一点"深追题区和"补充信息（可选）"区拆成后续步骤（对应"第 3/5 步""第 4/5 步"），复用已有的步骤条，每步只聚焦 1–2 组决策，减少单屏认知负荷；这属于**在已定基线结构内重排步骤边界**，不改变已确认的视觉基线元素本身，风险可控。

**8. 统一顶部导航范式：手写返回箭头 vs `Stack.Screen headerShown:true` 系统 header 两种并存**
UI-02/UI-03/UI-10 用 `headerShown:false` + 手写"‹"返回箭头和居中标题；UI-31/UI-33 用 `headerShown:true` + 系统默认 header。两种写法在返回手势兼容性（iOS 边缘滑动是否触发系统返回、Android 物理返回键行为）上可能有实际差异，但**本次审计未在真机验证**，只能确认代码层面存在两种范式并存，建议后续补真机验证后二选一定为规范，避免继续新增第三种写法。

---

## 6. 未覆盖范围重述

再次明确：本报告是**代码结构与交互契约层面**的审计，不是像素级视觉审计，不是真机可用性测试，不是可访问性合规认证（如 WCAG AA 对比度实测），也不是对 GOVERNANCE 红线（诊断/排名/支付等）的二次判定——那部分结论请参照 `research/ui01-ui34-mobile-completion-audit.md` 的"反向审计缺陷池"。本报告的价值是把"这一批页面在设计成熟度上并不整齐"这件事，用可复核的代码证据（行数、控件计数、关键字命中）具体化，并给出可执行的分批改进顺序。

---

## Evidence References

- `apps/mobile/hooks/use-colors.ts`、`apps/mobile/constants/theme.ts`、`apps/mobile/lib/_core/theme.ts` — 主题系统入口
- `apps/mobile/components/screen-container.tsx`、`apps/mobile/components/family/family-refresh-control.tsx`、`apps/mobile/components/family/data-source-banner.tsx` — 现有共享组件
- `apps/mobile/lib/family/ui-registry.ts` — 34/35 页注册表，`loop`/`tab`/`featurePoints`/`baseline` 字段
- `apps/mobile/app/ui/UI-02.tsx`、`UI-03.tsx`、`UI-10.tsx`、`UI-31.tsx`、`UI-33.tsx` — 逐页详细阅读样本
- 全部 `apps/mobile/app/ui/UI-*.tsx`（33 个文件）— 结构化 grep 扫描（行数/控件/`accessibility*`/`hitSlop`/loading·error 关键字）
- `apps/mobile/research/ui01-ui34-mobile-completion-audit.md` — 既有完成度台账与反向审计缺陷池
- `apps/mobile/research/family-ai-mobile-comprehensive-review-2026-08-22.md` — 既有全面复盘（P0/P1/P2 缺口分级）
- `apps/mobile/research/ui01-ui35-projection-state-audit.tsv` — 既有逐页 remote_calls/loading/error/empty/fallback 计数审计
- `apps/mobile/research/baselines/` 目录结构（`ui02/`、`ui03/`、`ui19-ui24/`、`ui25-ui28/`、`ui29-ui34/`、`ui35-original/`） — 对标截图资产存在性确认
- 各 `apps/mobile/research/ui*-original-screen-alignment.md`、`ui*-baseline-audit.md` — 已有的逐页/分批对齐记录
