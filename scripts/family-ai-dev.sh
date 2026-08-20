#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker-compose.dev.yml"
ENV_FILE="$ROOT_DIR/.env.family-ai.dev"
ENV_EXAMPLE="$ROOT_DIR/.env.family-ai.dev.example"

compose() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

ensure_env() {
  if [[ ! -f "$ENV_FILE" ]]; then
    cp "$ENV_EXAMPLE" "$ENV_FILE"
    printf 'Created %s from %s\n' "$ENV_FILE" "$ENV_EXAMPLE"
  fi
}

wait_for_postgres() {
  local attempts=0
  until compose exec -T postgres pg_isready -U "${POSTGRES_USER:-family}" -d "${POSTGRES_DB:-family_dev}" >/dev/null 2>&1; do
    attempts=$((attempts + 1))
    if (( attempts >= 60 )); then
      echo 'PostgreSQL did not become ready within 120 seconds.' >&2
      exit 1
    fi
    sleep 2
  done
}

migrate() {
  compose run --rm --no-deps api bash -lc \
    'corepack enable && corepack prepare pnpm@11.1.3 --activate && pnpm config set store-dir /pnpm/store && pnpm install --frozen-lockfile && pnpm db:migrate'
}

ensure_env
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a
compose config >/dev/null

case "${1:-up}" in
  up)
    compose up -d postgres
    wait_for_postgres
    migrate
    compose up -d api web
    compose ps
    ;;
  migrate)
    compose up -d postgres
    wait_for_postgres
    migrate
    ;;
  down)
    compose down
    ;;
  reset)
    compose down -v --remove-orphans
    ;;
  restart)
    compose restart api web
    ;;
  logs)
    shift || true
    if (( $# == 0 )); then
      compose logs -f --tail=200 api web postgres
    else
      compose logs -f --tail=200 "$@"
    fi
    ;;
  ps|status)
    compose ps
    ;;
  shell)
    service="${2:-api}"
    compose exec "$service" bash
    ;;
  db)
    compose exec postgres psql -U "${POSTGRES_USER:-family}" -d "${POSTGRES_DB:-family_dev}"
    ;;
  config)
    compose config
    ;;
  *)
    cat <<'USAGE'
Usage: scripts/family-ai-dev.sh <command>

Commands:
  up       Start PostgreSQL, run migrations, then start API and Web (default).
  migrate  Start PostgreSQL and apply database/migrations/*.sql.
  down     Stop services but keep volumes.
  reset    Stop services and delete local volumes/data.
  restart  Restart API and Web.
  logs     Follow logs; optionally pass service names.
  ps       Show service status.
  shell    Open a shell; optionally pass api or web.
  db       Open a psql session.
  config   Render and validate Compose configuration.
USAGE
    exit 2
    ;;
esac
