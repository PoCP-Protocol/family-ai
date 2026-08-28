# Batch 2 横切共享组件接线现状核查 v1

调研范围：`family-domain-p0-001` / `consent-domain-p0-001` /
`growth-intent-domain-p0-001` / `growth-plan-domain-p0-001` /
`intervention-action-domain-p0-001` / `outcome-domain-p0-001` 六个域分支的
Python 实现（均基于 `feat/python-assessment-domain-p0-001`），核对
`architecture/notes/batch2-domain-research-v1.md`（commit `1977a6b`）第7节
记录的三个横切共享组件、以及第6节记录的第二处 consent 口径不一致，在各域
落地时是各自复制实现，还是走 Port + Fake 接口留给未来接线。

结论先给：**三个横切组件在 growth_priority / intervention / outcome 三个域
里都没有重复实现业务逻辑本体**，全部以 `Protocol` Port 方法的形式声明在各
自的 `application/ports.py`，真实校验逻辑留白，等待未来接入共享实现或跨域
适配器。没有发现需要"去重"的重复代码。第二处 consent 口径不一致
（`assertAssessmentConsent`）不属于本次 Batch 2 任何域的范围，Python 侧原样
带过了这个问题，无人处理。

---

## 1. 三个横切组件在各域的处理方式对比表

| 横切组件 | growth_priority（growth-intent-domain-p0-001） | intervention（intervention-action-domain-p0-001） | outcome（outcome-domain-p0-001） |
|---|---|---|---|
| `GrowthSubjectResolver.resolve()` | `GrowthPriorityRepositoryPort.resolve_growth_subject(family_id, onboarding_id) -> str`（`application/ports.py`）。方法体只声明签名+docstring 引用研究文档7.1节的错误码，无实现，由未来的仓储适配器补全。 | `InterventionRepositoryPort.resolve_growth_subject(family_id, onboarding_id) -> dict`（返回 `{"child_person_id", "guardian_person_ids"}`），同样只是 Protocol 声明。 | `OutcomeRepositoryPort.resolve_growth_subject(family_id, onboarding_id) -> tuple[str, set[str]]`，docstring 显式引用研究文档7.1节的5个错误码（`growth_subject_unresolved`等），同样只声明不实现。 |
| `assertNormalSafetyRoute` | `GrowthPriorityRepositoryPort.load_safety_route(...)` 负责取数（返回 severity/disposition/perspective 列表），真正的判定逻辑 `assert_normal_safety_route` 被下沉到本域 `domain/policies.py`，**是纯函数按研究文档7.2节逐条重写的，不依赖仓储**——即数据获取走 Port，判定逻辑走域内 policy，两者拆开，policy 部分是"重写"而非"复用共享代码"，但因为是无状态纯函数、逐条对照研究文档编写，三处判定逻辑理论上字节级一致。 | `InterventionRepositoryPort.assert_normal_safety_route(family_id, onboarding_id) -> None`：与前两者不同，**判定逻辑本身也被当作 Port 方法整体下推给仓储实现**，本域自己的 `domain/policies.py` 里没有再写一份判定函数。 | `OutcomeRepositoryPort.assert_normal_safety_route(family_id, onboarding_id) -> None`：与 intervention 一致，判定整体下推给仓储 Port，本域 `domain/policies.py` 未重写判定逻辑。 |
| `assertReflectionSafetyRoute` / 正则安全信号扫描 | 未出现（该域的确认流程不涉及反思文本录入，与研究文档一致，growth-priority 本身不是这三个共用 reflection 校验的落点） | `intervention/application/commands.py`（`complete_growth_action` 流程）里有 `reflection` 字段传递，但**代码内有明确注释承认未接安全扫描**：第223-232行写道"`assertReflectionSafetyRoute`（正则扫描）是一个独立的、已经研究过的安全关注点（研究文档5.3节），......留给未来接入共享安全模块，同 `assertNormalSafetyRoute` 一样，本次 Intervention+Action 端口范围之外；生产环境前调用方需要把真正的 reflection-safety 门接到仓储的 `assert_normal_safety_route`/专门 port 方法上"。即：该域自知未接，写了注释留痴而非静默遗漏。 | `outcome/application/commands.py`、`domain/entities.py` 有 `reflection_refs`/observation 反思字段传递，但未见类似 intervention 域那样的显式"未接安全扫描"注释，也未见正则扫描函数本体的 Python 版本——需要进一步确认是否遗漏（比 intervention 域更值得警惕，因为没有留痕说明是"已知暂缓"还是"漏做"）。 |

**核对方式**：分别对三个分支执行
`git show <branch>:.../application/ports.py`、
`git show <branch>:.../domain/policies.py`（PowerShell/Bash 均用
`git show`只读读取，未在本地签出这些分支覆盖工作区）。

## 2. 是否存在重复实现，需要后续统一收编为共享 Port？

**没有发现需要去重的重复业务逻辑。** 三个域对 `GrowthSubjectResolver.resolve`
和 `assertNormalSafetyRoute` 的数据获取部分（谁拥有 onboarding/perspective
这些跨域数据）全部以 `Protocol` 方法声明在各自 `application/ports.py`
里，方法体只有签名和 docstring，没有任何一个域写出一份"等价重实现"的查询
逻辑——这正是任务预期的"Port + Fake 接口，等待未来真正接入"的做法。

唯一值得记录的**设计不一致**（不是重复代码，是同一横切组件在两侧域被拆分
的位置不同）：
- `assertNormalSafetyRoute` 的**判定**逻辑，growth_priority 域自己在
  `domain/policies.py` 里写了一份纯函数（数据仍走 Port 取），而
  intervention / outcome 两域把判定本身也整体下推给仓储 Port（不在自己的
  `domain/policies.py` 重写判定）。
- 三处目前都不会跑出不一致的结果（growth_priority 那份是逐条抄研究文档
  7.2节写的纯函数，语义应与另外两域最终仓储实现应保持的语义一致），但
  **如果未来三个域各自接入不同的仓储适配器实现，`assert_normal_safety_route`
  的判定代码可能出现两套（growth_priority 的域内纯函数 vs intervention/
  outcome 各自仓储里各写一份），到时才会产生真正的重复实现风险**。
- 建议后续把 `assert_normal_safety_route` 的判定逻辑统一收编成一个共享的
  `domain`层纯函数模块（比如 `backend/domains/_shared/safety_route.py`），
  三个域的仓储 Port 只负责"取数"，判定统一调用共享纯函数——避免 intervention/
  outcome 未来各自在仓储实现里重写一份判定分支。这是"下一步接线"清单里的
  一项，本次调研不动手。

## 3. 第二处 consent 口径不一致的处理现状

研究文档第6节记录：`assertAssessmentConsent`（`growth-hypothesis.service.ts`，
Batch 1 / Assessment 域）只检查 `purpose = ASSESSMENT` 单一项，跟
`assertRequiredGrowthConsents` 的三件套口径不同。

核查三个分支（`growth-intent-domain-p0-001` / `intervention-action-domain-p0-001`
/ `outcome-domain-p0-001`）上 `50_开发_dev/backend/domains/assessment/application/growth_hypothesis_commands.py`
第90行，三个分支该文件内容完全一致（均为 Batch 1 遗留、Batch 2 未改动）：

```python
await self._repository.assert_subject_consent(command.family_id, evidence.subject_person_id, "ASSESSMENT")
```

**结论：Python 侧原样把这处单一 purpose 校验搬过来了，口径不一致原样保留，
没有任何 Batch 2 域触碰或修复它。** 这符合预期——该函数属于 Batch 1
Assessment 域范围，不在本次六个 Batch 2 域的调研/实现职责内；同时也确认
"没人管"这件事没有被误当作已解决而漏记。

## 4. 下一步接线任务建议清单（仅列清单，不执行）

1. **`GrowthSubjectResolver.resolve` 真实实现落地**：为
   `growth_priority` / `intervention` / `outcome` 三个域各自的
   `resolve_growth_subject` Port 方法编写共享的真实 SQLAlchemy 实现（或抽出
   一个独立的只读适配器模块），替换当前测试里各自的 Fake 实现
   （`growth_priority/infrastructure/fake_repository.py`、
   `intervention/infrastructure/fake_repository.py`、
   `outcome/infrastructure/fake_repository.py` 里对应方法）。三处签名不完全
   一致（`str` vs `dict` vs `tuple[str, set[str]]`），接线前需先统一返回类型
   契约，否则会催生三份适配器代码。
2. **`assertNormalSafetyRoute` 判定逻辑去重前置**：在接入真实数据源之前，
   先把 growth_priority 域内 `domain/policies.py` 里的
   `assert_normal_safety_route` 纯函数抽到共享位置，让 intervention/outcome
   的仓储实现也调用同一份纯函数，避免真实适配器落地时衍生第二、第三份判定
   代码。
3. **`assertReflectionSafetyRoute` 正则扫描函数本体尚未移植，两域处理方式
   不同**：`intervention-action-domain-p0-001` 分支在
   `application/commands.py` 里用代码注释明确承认"本次端口范围之外，生产
   前需要接线"（第223-232行）；`outcome-domain-p0-001` 分支同样没有移植
   正则扫描本体，但**没有类似的显式留痕注释**，需要跟进确认是遗漏还是设计
   上认为 outcome 域的反思文本不需要这道门（比如可能挪到了 observation
   录入之前的其它环节）。接线时两域都需要把正则扫描函数移植为共享安全模块
   并接入。
4. **Consent 域真实实现接入 growth_priority / intervention / outcome**：
   三域的 `ConsentCheckPort` / `assert_required_growth_consents` 目前都是
   Fake（`fake_consent_port.py`、各自 fake_repository 里的对应方法），
   `consent-domain-p0-001` 分支已经落地了 `assert_required_growth_consents_from_granted`
   的真实纯函数，需要在组合根（composition root）把三域的 Port 接到
   Consent 域的真实仓储适配器上。
5. **`outcome` 域对 `intervention_episodes` / `growth_actions` 的跨域读取**：
   `outcome/application/ports.py` 里 `InterventionEpisodeReadPort` 目前用
   `fake_intervention_episode_reader.py`，需要接入
   `intervention-action-domain-p0-001` 落地后的真实仓储只读投影
   （按迁移方案"跨域只读投影"的模式，不能直接导入 intervention 域的仓储）。
6. **第二处 consent 口径不一致（`assertAssessmentConsent`）修复决策**：
   本次确认无人处理，需要产品/架构方决定是维持 Assessment 域的单一
   purpose 语义（可能是有意为之，ASSESSMENT 阶段本就只需要评估类同意），
   还是也要收编进 `assert_required_growth_consents` 统一口径——这是设计
   决策问题，不是本次调研范围内的代码修复任务，建议单独立项跟踪。
7. **三域仓储 Port 返回类型统一**（配合任务1）：`resolve_growth_subject`
   在三个域里返回类型不同（`str`、`dict`、`tuple[str, set[str]]`），建议在
   真正接线共享实现之前先统一为一个公共的值对象（例如
   `GrowthSubjectResolution(child_person_id: str, guardian_person_ids: set[str])`），
   避免适配器要为三种签名各写一份转换代码。

---

（本文档为纯调研记录，未修改任何域分支的代码；六个域分支的当前 Python
实现状态未被签出覆盖，全部通过 `git show <branch>:<path>` 只读读取。）
