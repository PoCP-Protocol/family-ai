# Family AI Web 双端体验重构 V1

V1 采用 Consumer Shell Strangler：新 Consumer Experience 与 Operations Experience 分别成为 `product=family` 和 `product=console` 默认入口；旧家庭门户与旧运营回执控制台保留为 `product=legacy-family` 和 `product=legacy-console`。

新壳只负责 Web 信息架构、只读展示和导航；Family API adapter、Named Action、幂等、Family Scope、Tenant/Role Scope、Policy 与 Human Gate 仍由现有实现负责。Consumer 与 Operations 使用不同 shell、数据语境和入口，不能互相混淆。

Consumer 覆盖 UI-01…UI-34，按“今天、成长、发现、服务、我的”五个工作区组织；Operations 覆盖运营总览、家庭、旅程、测评与 AI 质量、服务、内容、会员、安全、审计、权限十个工作区。所有演示内容显式标记为设计预览，不得作为领域事实。
