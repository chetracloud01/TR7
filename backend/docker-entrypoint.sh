#!/usr/bin/env bash
# Applies pending Alembic migrations before the app starts serving — so a
# deploy can never run against a schema it hasn't been migrated to yet.
set -euo pipefail

alembic upgrade head
exec "$@"
