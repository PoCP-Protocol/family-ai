# Family AI 本地开发

## 前置条件

本地开发需要 Docker Engine、Docker Compose v2、Node.js 20+ 和 pnpm 11。项目运行时会启动 PostgreSQL、NestJS API 和静态 Web 服务。

## 快速启动

在仓库根目录执行：

```bash
cp .env.family-ai.dev.example .env.family-ai.dev
scripts/family-ai-dev.sh up
```

启动完成后：

| 服务 | 地址 |
|---|---|
| Web | http://localhost:5173 |
| API | http://localhost:3000 |
| PostgreSQL | `127.0.0.1:5433` |

`up` 会先启动 PostgreSQL，等待健康检查通过，按 `50_开发_dev/database/migrations/` 顺序执行迁移，再启动 API 和 Web。数据库数据保存在 Docker volume `family_ai_dev_postgres` 中。

## 常用命令

```bash
scripts/family-ai-dev.sh ps
scripts/family-ai-dev.sh logs
scripts/family-ai-dev.sh logs api web
scripts/family-ai-dev.sh migrate
scripts/family-ai-dev.sh restart
scripts/family-ai-dev.sh shell api
scripts/family-ai-dev.sh db
scripts/family-ai-dev.sh down
scripts/family-ai-dev.sh reset
```

`down` 只停止容器并保留数据库数据；`reset` 会删除本地数据库 volume，仅适用于需要从空库重新验证迁移的场景。

## 环境边界

`.env.family-ai.dev` 只用于本地 Dev 环境，不应提交。默认 `MODEL_GATEWAY_MODE=NOOP`，默认关闭外部效果：不会发起支付、扣款、通知、外部分享或真实履约。可以使用 synthetic fixture 进行联调，但必须将其识别为开发数据。

## Docker 不可用时

如果本机没有 Docker Engine，脚本仍可通过 `bash -n scripts/family-ai-dev.sh` 做语法验证，但无法执行 Compose、启动 PostgreSQL 或运行容器化 API/Web。此时需要安装并启动 Docker Desktop/Engine 后，再重新执行 `scripts/family-ai-dev.sh up`。
