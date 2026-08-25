# MOBILE SECOND CONTROL PLANE — INVENTORY 001

```text
DOC_KIND   = G0 EVIDENCE / STRUCTURAL DEBT INVENTORY
TASK       = FAMILY-LEGACY-UI-FULLSTACK-REBASELINE-001 / G0
DATE       = 2026-08-22
BASE_SHA   = 708cf542ab130642f2248bbebecc997930d10a49
METHOD     = 只读取证(grep + import 图),不修改/不删除任何文件
G0 DISPOSITION = CONTAIN + INVENTORY + BLOCK_NEW_DEPENDENCIES(物理迁移/删除属 G1)
```

> 架构师 Q5 裁决:不在 G0 删除整个 `_core/`——9 个文件职责不同,须先取证分类。本清单即该取证。

## 1. 结论(诚实)

- **第二 AI 控制面存在**:`apps/mobile/server/_core/*` 是 Manus/vibecode 脚手架,出站统一 `forge.manus.im`(OpenAI 兼容),用 `ENV.forgeApiKey`。
- **但不在 legacy UI 渲染路径上**:`app/` 与 `lib/` 下 **0 处**直接 import `invokeLLM`/生成能力。唯一活路径是 `server/private-note-tags.ts → invokeLLM → forge`(经 tRPC `privateNoteTags.suggest` 暴露)。多数 `_core` 能力(voiceTranscription/notification/dataApi)**无任何 import**,是脚手架残留。
- **第二身份/DB 存在**:`server/db.ts` 用 `drizzle-orm/mysql2` + `DATABASE_URL`,`users(openId/role)`,`ownerOpenId → admin`;是会话/身份存储,非业务真相。
- **canonical owner = `apps/api` + PostgreSQL**(不变)。

## 2. `_core/` 九文件逐一取证

| 文件 | 职责 | 出站 | 凭证/env | 被谁 import | 涉 Family 正典数据 | disposition |
|---|---|---|---|---|---|---|
| llm.ts | `/v1/chat/completions` LLM 调用(tool/结构化/退避) | forge.manus.im | forgeApiKey | server/private-note-tags.ts | 否 | REPLACE(→ FamilyLlmGateway) |
| imageGeneration.ts | forge 图像生成/编辑 | forge.manus.im | forgeApiKey | server/storage.ts | 否 | REQUIRES_REVIEW |
| voiceTranscription.ts | Whisper 转录 | forge.manus.im | forgeApiKey | 无 | 否 | RETIRE(未使用) |
| notification.ts | owner 通知 | forge.manus.im | forgeApiKey | 无 | 否 | RETIRE(未使用) |
| dataApi.ts | 第三方数据代理 | forge.manus.im | forgeApiKey | 无 | 否 | RETIRE(未使用) |
| storageProxy.ts | `/manus-storage/*` 签名 URL 代理 | forge.manus.im | forgeApiKey | server/_core/index.ts | 否 | REQUIRES_REVIEW(→ 自有对象存储) |
| heartbeat.ts | cron job RPC | forge.manus.im | forgeApiKey | 无 | 否 | RETIRE_OR_REPLACE(→ Temporal) |
| env.ts | env 单例(含 forge/DATABASE_URL/ownerOpenId) | 无 | 定义全部 | 所有 _core | 否 | REPLACE(env 收敛) |
| storage.ts(在 server/) | S3 presign put/get | forge.manus.im | forgeApiKey | server/imageGeneration.ts | 否 | REQUIRES_REVIEW |

## 3. 全仓关键词命中(取证)

| 关键词 | 文件数 | 命中 | 主要位置 |
|---|---|---|---|
| forge.manus.im | 1 | 2 | _core/llm.ts |
| forgeApiKey | 9 | 19 | _core/* + server/storage.ts |
| OPENAI_API_KEY | 1 | 1 | _core/llm.ts(错误信息) |
| /v1/chat/completions | 1 | 2 | _core/llm.ts |
| invokeLLM | 2 | 4 | _core/llm.ts(export) + server/private-note-tags.ts(用) |
| mysql2 | 4 | 11 | template.json/package.json/db.ts/pnpm-lock |
| drizzle-orm/mysql2 | 1 | 1 | server/db.ts |
| DATABASE_URL | (全仓多) | — | mobile: env.ts/db.ts/drizzle.config.ts |
| openId | 12 | 50+ | db.ts/oauth.ts/sdk.ts/auth.ts/schema.ts |
| ownerOpenId | 2 | 2 | _core/env.ts, db.ts(admin 判定) |

## 4. UI→第二网关消费证据

- `app/` 目录:0 匹配 `invokeLLM/generateImage/transcribeAudio/notifyOwner/callDataApi`。
- `lib/` 目录:0 匹配同上;`lib/_core/*` 仅 OAuth(Api/Auth),不含 forge 调用。
- 唯一通道:`server/private-note-tags.ts`(服务端,经 tRPC mutation),**非 UI 直接 import**。
- 判定:legacy UI 实际渲染路径**不触及**第二 AI 网关;`private-note-tags` 是唯一需在 G1 迁移到 FamilyLlmGateway 的活路径。

## 5. G0 校验器约束(已落地)

- `validate:legacy UI:strict` 检测:`forge.manus.im`/`/v1/chat/completions`(→ `MOBILE_DIRECT_MODEL_PROVIDER=FAIL`)、`mysql2`(→ 第二 DB 警告)。
- 该 FAIL 是**已记录的 G0 strict 已知阻塞项**,不阻止 G0 结构对齐(`validate:legacy UI` 正常门须 PASS)。
- 新增依赖红线:`MOBILE_NEW_DIRECT_MODEL_DEPENDENCY = FORBIDDEN`。

## 6. G1 迁移次序建议(仅建议,决策在架构师)

1. `private-note-tags` → Family API + FamilyLlmGateway(唯一活 AI 路径,先迁)。
2. RETIRE 未使用件:voiceTranscription/notification/dataApi/heartbeat。
3. imageGeneration/storage/storageProxy → 自有对象存储(REQUIRES_REVIEW)。
4. 第二身份/DB(db.ts/openId/ownerOpenId)→ 收敛到 apps/api 身份;删除 mysql2/drizzle。
5. env.ts forge 凭证下线。
