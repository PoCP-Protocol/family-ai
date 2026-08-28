# Batch 2 跨域接口统一 — 架构质量审查与修改决定 V1

DOC_KIND: CHIEF_ARCHITECT_QUALITY_REVIEW（补充 `batch2-cross-cutting-integration-check-v1.md` 的只读审计，本文档给出可执行的修改决定，非新的调研）
AUTHOR: family-chief-architect（Claude Code）
DATE: 2026-08-28
STATUS: DECISION — 各Batch2域在接线composition root之前应遵照本文档统一签名；本文档不改任何域自身的Fake实现或业务逻辑，只统一跨域契约的形状。

---

## 0. 结论先行

审查六个Batch2域（family/consent/growth_priority/growth_plan/intervention/outcome）的并行Python实现，发现4类真实的接口分叉（非潜在风险，是已经写进代码的不同签名），且当前的整合分支（`batch2-integration-p0-001`）尚未触发这些分叉——因为各域目前都用Fake互相隔离，还没有真正interwire。**这是修复成本最低的窗口**：只需要改类型签名，不需要改实现代码或补回归测试。窗口关闭的信号是"任意一个域开始写真实SQLAlchemy仓储实现"——那之后每统一一处签名都要连带改实现代码。

以下每条决定给出：现状分歧、采用哪一版为canonical、理由、需要改的具体文件。

---

## 1. Consent 检查接口 — 采用 consent 域的独立 Port，其余三域收编

**现状**：4种签名并存——
- `consent`域（`consent/application/ports.py` `ConsentQueryPort`）：`(family_id, subject_person_id, required_purposes: tuple[ConsentPurpose,...] | None = None) -> None`
- `growth_priority`域：域内自建`ConsentCheckPort`，`(family_id, subject_person_id) -> None`，无`required_purposes`
- `intervention`/`outcome`域：内联进各自的Repository Port方法，签名同growth_priority但和仓储读写混在一起

**决定：采用 consent 域的 `ConsentQueryPort` 签名为canonical，`required_purposes`参数保留（不是growth_priority省略掉的那种简化版）。**

理由：
1. `required_purposes`不是可选的花哨参数——TS侧`assertRequiredGrowthConsents`本身就是"三件套"purpose校验（迁移计划文档已确认），省略这个参数意味着growth_priority/intervention/outcome三域实际上做的是**弱化版**的consent检查，如果不统一，cutover后会产生比NestJS版本更宽松的consent校验，这是安全倒退，不是简化。
2. Consent检查和仓储读写是两个不同的关注点（一个是横切策略，一个是持久化），混进Repository Port违反单一职责，也导致将来换Consent的实现（比如consent策略变化）要连带改所有仓储mock。

**要改的文件**（签名层面，各域独立worktree自行操作，不需要等合并）：
- `growth_priority/application/ports.py`：删除自建`ConsentCheckPort`，改为从`consent`域import `ConsentQueryPort`（跨域import路径按`backend/pyproject.toml`的workspace members来定，`wt-batch2int`合并完成后即可用）。调用点补上`required_purposes`参数（值应与TS侧`growth-hypothesis.service.ts`/`growth-review.service.ts`调用`assertRequiredGrowthConsents`时传的purpose集合一致，需要逐调用点核对，不能凭空定）。
- `intervention/application/ports.py`、`outcome/application/ports.py`：把consent检查方法从`InterventionRepositoryPort`/`OutcomeRepositoryPort`中拆出，改为独立依赖`ConsentQueryPort`（走依赖注入，不是仓储的一部分）。

---

## 2. `resolve_growth_subject` 返回类型 — 定义共享 dataclass，禁止裸 dict/tuple

**现状**：三种返回类型——growth_priority返回`str`（只有child_person_id），intervention返回`dict`，outcome返回`tuple[str, set[str]]`。

**决定：定义一个共享dataclass `GrowthSubject(child_person_id: str, guardian_person_ids: frozenset[str])`，三域统一返回这个类型，不允许裸dict/tuple。**

理由：growth_priority目前的`str`版本已经是**信息缺失**的版本——它拿不到guardian_person_ids，如果growth_priority将来需要做guardian相关的校验（大概率会，因为TS侧`GrowthSubjectResolver.resolve`本身就返回两者），现在就要返回完整信息，避免以后改签名牵连所有调用点。`frozenset`而非`set`是为了防止调用方意外mutate共享的guardian集合（TS侧无此问题因为JS对象传引用语义不同，Python这里需要显式immutable）。

**放置位置**：建议放在一个新的共享kernel包（`backend/packages/family_kernel/subject.py`或类似位置，具体路径由`wt-batch2int`按workspace约定定），不要放在某一个具体域下面，否则造成"谁依赖谁"的循环依赖风险（family_plan依赖intervention的subject类型这种情况要避免）。

**要改的文件**：三域各自的`application/ports.py`里`resolve_growth_subject`的返回类型注解，从`-> str` / `-> dict` / `-> tuple[str, set[str]]`统一改成`-> GrowthSubject`。目前都只是Protocol声明（方法体`...`），改注解不影响任何已有测试。

---

## 3. Tenancy检查签名 — 采用带 tenant_id 的版本为canonical，但 tenant_id 从 family_id 派生，不要求调用方显式传入

**现状**：intervention/growth_priority用`assert_family_manage_permission(family_id, actor_id)`（无tenant_id，与TS侧`family-permission.ts`的`assertFamilyManagePermission`签名完全对应）；outcome用`assert_tenant_family_scope(tenant_id, family_id, actor_id)`（多一个tenant_id）。

**决定：采用 outcome 域的四参数版本 `assert_tenant_family_scope(tenant_id, family_id, actor_id)` 为canonical签名，但在共享实现内部由 tenant_id 反查/校验 family_id 归属，调用方传的 tenant_id 应该来自请求上下文（比如auth中间件解析出的tenant scope），不是靠caller去多查一次DB。**

理由：TS侧的`assertFamilyManagePermission`确实没有tenant_id参数，但那是TS侧本身**没有真正的多租户行级隔离**（伯乐范式记忆里提到的"隔离靠手写filter无RLS"问题同样适用于family-ai）——这次Python迁移是补齐这个已知技术债的机会，不应该原样照抄TS的缺陷。outcome域已经这样做了，说明至少有一个开发者已经意识到这一点，应该采用它，而不是让intervention/growth_priority的旧模式反向拖累outcome。

**风险提示**：这一条和第1条不同——第1条是"统一到更严格的版本"，纯粹是签名层面的事；这一条涉及"要不要在这次迁移里补一个TS侧从未有过的租户隔离能力"，**这是一个真正的架构范围扩展，不是bug修复**，按`FAMILY_AI_PYTHON_ONLY_MIGRATION_PLAN_V1.md`的精神（"consent/safety/human-confirmation/fact-boundary rules carried over... not weakened"只要求不弱化，没要求主动加强），我把这一条列为**建议而非强制决定**——需要project owner确认是否要在Batch2范围内顺带解决多租户隔离，还是先照抄TS的两参数版本、把租户隔离留给单独立项。**在owner明确前，各域暂时保留现状，不要自行选边**，因为这直接决定了共享kernel包里这个函数的真实实现逻辑（不只是签名）。

---

## 4. growth-review 权限E点的双重独立修复 — 需要立即交叉核对

**现状**：TS侧（我在PR #24里修的`growth-review.service.ts`）和Python侧（`wt-outcome`域，commit `a5873a0`）**各自独立**发现并修复了同一个bug（缺少tenancy分支的权限校验），互相不知道对方的存在。

**决定**：这不是签名统一问题，是**正确性核对**问题，优先级最高，因为如果两边逻辑不等价，cutover后会产生新的行为差异。要求：
1. 读Python侧`wt-outcome`的具体实现（`assert_tenant_family_scope`或等价函数体），确认它的"legacy audit OR tenancy membership"两条件判定逻辑，与TS侧`family-permission.ts`共享实现的语义（先查`audit_logs`的`CreateFamily`成功记录，查不到再查`family_memberships`的ACTIVE OWNER_GUARDIAN/GUARDIAN）**完全对应**，尤其注意：
   - 两个条件是OR关系还是被误写成AND（TS侧是OR：任一满足即放行）。
   - Python版是否也支持"legacy actorId非UUID格式时不报错只是不匹配"这个边界情况（TS侧`person_id::text = $2`的注释专门提到这一点）。
2. 核对完成后，在两处代码（TS的PR #24和Python的`wt-outcome`）互相加一条注释交叉引用对方，避免未来有人只看到一处修复就以为另一侧还是bug状态。

---

## 5. `assertNormalSafetyRoute` 判定逻辑位置 — 收编进共享纯函数，趁真实实现还没写之前

**现状**：growth_priority把判定逻辑写成域内`domain/policies.py`纯函数（自己判定，只从Port拿数据）；intervention/outcome把判定整体下推进仓储Port（打算让仓储实现顺带做判定）。目前三处语义一致（都是抄同一份研究文档），是**物理位置**不同,不是逻辑分歧。

**决定：统一采用growth_priority的模式——判定逻辑写成共享纯函数（不依赖DB查询逻辑本身，只依赖Port返回的数据），放进第2条提到的共享kernel包。intervention/outcome删除各自仓储Port里的判定方法，改为拿到数据后调用共享纯函数。**

理由：纯函数版本更容易做单元测试（不需要mock整个仓储），也避免"仓储实现顺便判定业务规则"这种关注点混淆——这正是TS侧`family-permission.ts`独立成文件、被多处import的同一个设计原则,应该在Python侧延续,不要在迁移中退步。

---

## 6. Alembic revision 号段分配 — 六域并行开局前的强制前置动作

**现状**：六个域目前都只有Batch1遗留的`nestjs_0044_baseline.py`，没有任何域写了真实迁移文件——冲突尚未发生，但六域一旦同时开始写真实SQLAlchemy模型，会重演TS侧"migration 0053编号冲突"那次事故，且冲突面更大（六条并行链而非两条）。

**决定：在任何域开始写第一个真实Alembic revision之前，`wt-batch2int`必须先落一份号段分配表，格式类似：**

```text
nestjs_0044_baseline (共同基线, 已存在)
  ├─ family域:        0045-0054
  ├─ consent域:       0055-0059
  ├─ growth_priority域: 0060-0069
  ├─ growth_plan域:    0070-0074
  ├─ intervention域:   0075-0084
  └─ outcome域:        0085-0089
```

（具体号段大小按各域预估表数量粗估即可，不需要精确，留够余量比省号段更重要）每个域的`down_revision`固定指向`nestjs_0044_baseline`，各域内部自己保持线性递增，**不要求域间互相知道对方的revision**——这样即使各域独立在自己worktree里写迁移，最终合并到`wt-batch2int`时revision号天然不冲突,不需要事后重新编号(这正是TS侧0053那次没做到、事后要靠git worktree单独修的教训)。

**这是本次审查中唯一一条"必须做在前面"的决定,不能等冲突出现再处理**——因为迁移文件一旦被某个域的开发者在本地跑过`alembic upgrade`并产生了实际schema,事后重新分配号段的成本会远高于TS侧那次(那次只是文件重命名,这次涉及已经跑过的schema状态)。

---

## 7. 测试证据强度 — 不要求六域立刻补齐,但consent域应优先补一次真实PG验证

**现状**：六域全部是纯unit test+内存Fake,零真实PG集成测试,这是Override #4已知且接受的风险(非违规)。

**决定：不推翻Override #4的决定(不强制六域现在都补真实DB测试)。但consent域例外——它是唯一已经有`sqlalchemy_repository.py`(不只是Fake)的域,建议在它进入下一步开发前,先补一次真实PG集成测试,验证这条"从Fake到真实仓储"的移植路径本身没有隐藏问题。**

理由：Batch1已经用真实数据证明过"unit-test-only会漏真bug"(jsonb解码bug、`_seed_family`从未跑过真实路径两个例子),consent域是Batch2里第一个走到"有真实实现"阶段的域,应该趁早验证这条路径可靠,而不是等六个域都写完真实实现后一起发现问题。这不新增gate,只是建议一个验证顺序。

---

## 8. `assertReflectionSafetyRoute` 在 outcome 域缺失且无留痕注释 — 补一条注释,不要求现在实现

**决定：outcome域的开发者应补一条和intervention域一致的注释("本次范围之外,生产前需要接线"),标注这是有意暂缓而非遗漏。不要求现在补实现。**

---

## 9. 命名规范 — 采纳 `growth_priority` 为Python侧规范名,文档层面标注三种拼写的对应关系

**决定：Python域名`growth_priority`(单数)保留不改(域代码已经用这个名字,改名成本无意义地高)。但要求`FAMILY_AI_PYTHON_ONLY_MIGRATION_PLAN_V1.md`或本文档追加一条术语对照表:**

```text
概念权威名称    = GrowthIntent(研究文档/CURRENT_SPRINT.md历史记录用此名)
TS侧表名/域名   = growth_priorities(复数,NestJS `growth_priority.service.ts`)
Python侧域名   = growth_priority(单数,backend/domains/growth_priority/)
```

理由:不是重复,是同一概念的三种历史命名并存,加一句对照表能防止未来新加入的人(或新的Claude会话)把这个已经排查过的"假重复"再排查一次,浪费审查成本。

---

## 附:第3条(tenant_id)是本文档唯一未拍板的决定,需要project owner确认后才能让六域收敛到统一签名。其余8条(第1/2/4/5/6/7/8/9条)可以直接执行,不需要额外授权——均是签名/位置/文档层面的统一,不改变任何已授权的业务逻辑范围,且当前六域都还处于Fake-only阶段,改动成本最低,窗口很短。
