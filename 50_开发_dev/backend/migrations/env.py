import os
from logging.config import fileConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Real connection string comes from an env var, never hardcoded here or in
# alembic.ini. We reuse the same env var name convention as the existing
# domains/assessment/tests/test_sqlalchemy_repository_integration.py
# ("PY_ASSESSMENT_TEST_DATABASE_URL") as a fallback so local/CI setups that
# already export that var for pytest also work for Alembic without extra
# config, but the primary name is FAMILY_ALEMBIC_DATABASE_URL.
_url = os.environ.get("FAMILY_ALEMBIC_DATABASE_URL") or os.environ.get(
    "PY_ASSESSMENT_TEST_DATABASE_URL"
)
if _url:
    # Alembic's migration runner uses a sync driver, not asyncpg — normalize
    # an asyncpg-style URL (used by the app's async SQLAlchemy engine) to the
    # sync psycopg (v3) driver this workspace has installed.
    _url = _url.replace("postgresql+asyncpg://", "postgresql+psycopg://")
    if _url.startswith("postgresql://"):
        _url = "postgresql+psycopg://" + _url[len("postgresql://") :]
    config.set_main_option("sqlalchemy.url", _url)

# No ORM models are registered against Alembic's autogenerate machinery here.
# See migrations/README.md: this environment's job (for now) is to own a
# single no-op baseline revision that stamps the schema state created by the
# NestJS SQL migrations in 50_开发_dev/database/migrations/0001..0044. Real
# schema ownership (and therefore a real target_metadata bound to SQLAlchemy
# models) only happens for domains that get migrated to Python in Batch 2+.
target_metadata = None

# other values from the config, defined by the needs of env.py,
# can be acquired:
# my_important_option = config.get_main_option("my_important_option")
# ... etc.


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
