# UI-01 至 UI-34 移动端完成度复核台账

更新时间：2026-08  
范围：移动端 App UI-01 至 UI-34。UI-35 是额外 21 天智慧父母成长营基线，不计入本轮 34 张截图完成数。

## 复核结论

当前不能宣称“34 个移动端 UI 的功能点都已实现”。已有页面、测试和基线资产说明工程已经覆盖大部分路由与安全边界，但逐截图布局、视觉、功能、后端契约和文档口径仍不是同一完成度。

最容易误判的点是：`app/ui/UI-*.tsx` 返回 34 个文件，但其中包含 `UI-02-result.tsx`，同时不存在独立的 `app/ui/UI-01.tsx`。UI-01 由 `app/(tabs)/index.tsx` 承担，因此不能用“34 个 UI 文件”替代“UI-01 至 UI-34 全部完成”。

## 当前证据

| 项目 | 当前事实 | 判断 |
| --- | --- | --- |
| UI 页面文件 | `app/ui/UI-02.tsx` 至 `UI-34.tsx` 加 `UI-02-result.tsx`，共 34 个匹配；`UI-01` 在 `app/(tabs)/index.tsx` | 文件数不能作为完成口径 |
| UI-01 测试 | `tests/ui01-home-entry-map.test.ts` 绑定首页热点到 UI-02/UI-03/UI-04/UI-09/UI-12/UI-13/UI-19 | UI-01 是首页入口，不是独立页面 |
| 基线图片 | `research/baselines` 下有 UI-01 至 UI-34 及 UI-35 原图/分组图，共 70 张 | 原图资料存在，但仍需逐页视觉比对 |
| 测试文件 | 28 个 UI 相关测试，覆盖核心、商业、服务、社区、资产等分组 | 测试覆盖不等于截图一致 |
| 前后端矩阵 | 多页仍为 `GATE_BOUNDARY` 或 `UI_READY_BACKEND_GAP` | 不能把静态 UI 当成业务完成 |

## 必需交付口径

1. UI-01 至 UI-34 每页必须有明确的截图基线、当前实现入口、测试契约、后端/对象投影状态和风险边界。
2. UI-35 只能作为 21 天成长营附加基线接入，不能抵扣 UI-01 至 UI-34 中任何页面。
3. 原图中的诊断、排名、同龄比较、成长成果、积分权益、真实支付、真人服务和社区外发必须按治理边界安全改写。
4. 页面完成必须同时看布局/视觉、功能点、状态来源、路由出口、测试和文档；不能只看文件存在。

## 首批已处理缺口

| 页面 | 原缺口 | 已修复 | 验证 |
| --- | --- | --- | --- |
| UI-02-result | 结果页文案把免费测评强绑定到 `AI诊断` | 改为“查看家庭支持方向”，保留家庭确认边界 | `ui02-assessment-baseline.test.ts` 通过 |
| UI-03 | 页面标题、空态、图例和主按钮仍呈现 `AI成长诊断`、`同龄平均`、`生成个性化方案` | 改为“家庭成长解读 / 家庭支持方向概览 / 参考方向 / 查看可选支持方案” | `ui03-growth-explanation-baseline.test.ts` 通过 |
| 设计文档 | `design.md` 将 35 页混成主交付口径 | 改为“34 个截图基线页面与 UI-35 附加基线” | 待文档诊断复核 |

## 逐页复核矩阵

| UI | 当前实现入口 | 测试证据 | 当前状态判断 | 下一步 |
| --- | --- | --- | --- | --- |
| UI-01 | `app/(tabs)/index.tsx` | `ui01-home-entry-map.test.ts` 3/3 通过 | 原图核心功能结构已恢复；严格视觉截图仍未完成验收，21 天挑战营当前先到 UI-14 商品详情 | 采集 375×812 运行截图，对照横幅、六宫格、任务清单、推荐卡和底部导航 |
| UI-02 | `app/ui/UI-02.tsx` | `ui02-assessment-baseline.test.ts` | 免费家庭测评主流程已接版本化测评和边界 | 继续浏览器核对下拉、补充项和 5 主题视觉 |
| UI-03 | `app/ui/UI-03.tsx` | `ui03-growth-explanation-baseline.test.ts` | 已消除诊断/同龄比较可见语义，保留原图结构 | 浏览器核对雷达图、摘要卡和按钮布局 |
| UI-04 | `app/ui/UI-04.tsx` | `ui04-plan-baseline.test.ts` | 需复核是否仍把方案当成自动生成或确定行动 | 核对 Intent/Decision 边界与 UI-03 出口 |
| UI-05 | `app/ui/UI-05.tsx` | `ui05-companion-baseline.test.ts`、real-session harness | 90 天陪跑入口存在，需核对服务/社群是否无外部效果 | 逐图比对陪跑卡、任务和服务入口 |
| UI-06 | `app/ui/UI-06.tsx` | `ui06-membership-baseline.test.ts` | 会员/积分/权益存在商业边界风险 | 核对不得显示真实开通、扣款或已生效权益 |
| UI-07 | `app/ui/UI-07.tsx` | `ui07-assessment-entry-baseline.test.ts` | 测评入口存在 | 核对同意说明、预计用时和历史测评状态 |
| UI-08 | `app/ui/UI-08.tsx` | `ui08-growth-report-baseline.test.ts` | 已改为家庭过程回顾，禁止评分/诊断/效果结论 | 浏览器核对五方向视觉与 UI-04 出口 |
| UI-09 | `app/ui/UI-09.tsx` | `ui09-daily-task-baseline.test.ts` | 已移除合成完成率和连续打卡 | 核对窄屏任务卡、完成/暂停/取消反馈 |
| UI-10 | `app/ui/UI-10.tsx` | `ui10-child-assistant-baseline.test.ts` | 儿童相关页已保留监护边界 | 核对不诱导儿童直接诊断/作答 |
| UI-11 | `app/ui/UI-11.tsx` | `ui11-family-rhythm-baseline.test.ts` | 榜单已安全替代为家庭自有节奏 | 核对是否仍有积分/排名式视觉误导 |
| UI-12 | `app/ui/UI-12.tsx` | `ui12-private-story-baseline.test.ts` | 海报已转为私有故事卡 | 核对分享入口是否保持草稿/私有边界 |
| UI-13 | `app/ui/UI-13.tsx` | `ui13-mall-baseline.test.ts` | 商城目录存在，后端 catalog 仍需严核 | 核对价格、权益和推荐来源 |
| UI-14 | `app/ui/UI-14.tsx` | `ui14-product-detail-baseline.test.ts` | 商品详情存在，需确认价格/拼团为沙箱或意向 | 避免真实购买/真实支付表达 |
| UI-15 | `app/ui/UI-15.tsx` | `ui15-invite-baseline.test.ts` | 邀请草稿与 no external effect 已有边界 | 核对不外发、不自动邀请 |
| UI-16 | `app/ui/UI-16.tsx` | `ui16-group-buy-baseline.test.ts` | 同行/拼团意向存在 | 核对不扣款、不真实成团 |
| UI-17 | `app/ui/UI-17.tsx` | `ui17-ui18-commerce-baseline.test.ts` | 积分商城为高风险边界页 | 核对积分不排名、不兑换、不发放权益 |
| UI-18 | `app/ui/UI-18.tsx` | `ui17-ui18-commerce-baseline.test.ts` | 会员中心只读/沙箱口径需复核 | 核对会员权益、积分和续费意向 |
| UI-19 | `app/ui/UI-19.tsx` | `ui19-teacher-zone-baseline.test.ts` | 名师专区涉及真人服务准入 | 核对 provider fixture/资格字段和无真实联系 |
| UI-20 | `app/ui/UI-20.tsx` | `ui20-teacher-detail-baseline.test.ts` | 名师详情需保持服务边界 | 核对资质、适用场景和非诊断说明 |
| UI-21 | `app/ui/UI-21.tsx` | `ui21-consultation-baseline.test.ts` | 预约需求草稿 E2E 方向较完整 | 核对“保存意向”不等于真人已预约成功 |
| UI-22 | `app/ui/UI-22.tsx` | `ui22-ui24-service-baseline.test.ts` | 沙龙列表后端 catalog 仍需复核 | 核对报名意向/日程草稿边界 |
| UI-23 | `app/ui/UI-23.tsx` | `ui21-ui23-submit-feedback.test.ts` | 活动意向链路存在 | 核对报名不收费、不真实占座 |
| UI-24 | `app/ui/UI-24.tsx` | `ui22-ui24-service-baseline.test.ts` | 我的服务记录只读边界存在 | 核对不声明服务效果或孩子变化 |
| UI-25 | `app/ui/UI-25.tsx` | `ui25-ui28-community-baseline.test.ts` | 家长社区只读经验边界存在 | 核对内容流不是跨家庭事实/推荐结论 |
| UI-26 | `app/ui/UI-26.tsx` | `ui25-ui28-community-baseline.test.ts` | 私有小记草稿和 2x2 类型布局已修 | 继续视觉比对媒体/可见范围 |
| UI-27 | `app/ui/UI-27.tsx` | `ui25-ui28-community-baseline.test.ts` | 小记详情边界存在 | 核对评论/互动不变成公开社区事实 |
| UI-28 | `app/ui/UI-28.tsx` | `ui25-ui28-community-baseline.test.ts` | 我的社区强调私有/草稿 | 核对粉丝、积分、公开状态均未出现 |
| UI-29 | `app/ui/UI-29.tsx` | `ui29-ui34-assets-baseline.test.ts` | 标题仍有“成长成果”，但边界已转过程记录 | 评审是否改标题为“成长过程回顾” |
| UI-30 | `app/ui/UI-30.tsx` | `ui29-ui34-assets-baseline.test.ts` | 年度会员/支付高风险页 | 核对开通、续费、支付只表达意向/另行确认 |
| UI-31 | `app/ui/UI-31.tsx` | `ui29-ui34-assets-baseline.test.ts` | 我的服务统一状态存在 | 核对 21 天/90 天/专家/活动来源一致 |
| UI-32 | `app/ui/UI-32.tsx` | `ui29-ui34-assets-baseline.test.ts` | 订单与资产只读/沙箱 | 核对订单、资产、权益不伪造真实交易 |
| UI-33 | `app/ui/UI-33.tsx` | `ui29-ui34-assets-baseline.test.ts` | 家庭档案对象投影需继续接入 | 核对 consent/visibility/成员资料边界 |
| UI-34 | `app/ui/UI-34.tsx` | `ui29-ui34-assets-baseline.test.ts` | 服务记录只读 | 核对不声称真人服务已发生或有效果 |

## 下一轮优先级

1. UI-01：按原图六宫格、21 天挑战营位置、今日任务与推荐内容做视觉/功能比对。
2. UI-04：核对 UI-03 进入后的方案页是否仍存在自动生成、确定性行动或报告事实化表达。
3. UI-06/UI-17/UI-18/UI-30/UI-32：集中复核积分、会员、权益、支付和订单的沙箱边界。
4. UI-19/UI-20/UI-21/UI-24/UI-34：集中复核真人服务、预约、服务发生和效果边界。
5. UI-29：决定是否把可见标题从“成长成果”改为“成长过程回顾”。
