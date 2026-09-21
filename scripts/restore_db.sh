#!/usr/bin/env bash
# Restores a TR7 Postgres database from a backup made by backup_db.sh.
# Destructive: drops and recreates every table in the target database
# before loading the dump, so it always asks for confirmation first
# unless -y is passed.
#
# Usage:
#   ./scripts/restore_db.sh backups/tr7-20260101T030000Z.sql.gz [-y]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

DUMP_FILE="${1:-}"
CONFIRM="${2:-}"

if [ -z "$DUMP_FILE" ] || [ ! -f "$DUMP_FILE" ]; then
  echo "Usage: $0 <dump-file.sql.gz> [-y]" >&2
  exit 1
fi

if [ -z "${DATABASE_URL:-}" ] && [ -f "$REPO_ROOT/backend/.env" ]; then
  DATABASE_URL="$(grep -E '^DATABASE_URL=' "$REPO_ROOT/backend/.env" | cut -d= -f2-)"
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL not set and not found in backend/.env — aborting." >&2
  exit 1
fi

PG_URL="${DATABASE_URL/postgresql+psycopg:/postgresql:}"

if [ "$CONFIRM" != "-y" ]; then
  echo "This will DROP every table in the target database and reload from $DUMP_FILE."
  echo "Target: $PG_URL"
  read -r -p "Type 'yes' to continue: " reply
  if [ "$reply" != "yes" ]; then
    echo "Aborted."
    exit 1
  fi
fi

echo "Restoring $DUMP_FILE -> $PG_URL"
gunzip -c "$DUMP_FILE" | psql "$PG_URL" -v ON_ERROR_STOP=1
echo "Restore complete. Run 'alembic upgrade head' from backend/ if the dump predates a later migration."
