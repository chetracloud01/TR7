#!/usr/bin/env bash
# Dumps the TR7 Postgres database to a timestamped, gzip-compressed file.
# Reads DATABASE_URL the same way the backend does (backend/.env, or
# already exported in the environment) so this never needs its own copy
# of the credentials.
#
# Usage:
#   ./scripts/backup_db.sh [output-dir]     # default output dir: ./backups
#
# Cron example (daily at 3am, keeping the last 14 days):
#   0 3 * * * cd /path/to/TR7 && ./scripts/backup_db.sh backups && \
#     find backups -name 'tr7-*.sql.gz' -mtime +14 -delete

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
OUT_DIR="${1:-$REPO_ROOT/backups}"

if [ -z "${DATABASE_URL:-}" ] && [ -f "$REPO_ROOT/backend/.env" ]; then
  DATABASE_URL="$(grep -E '^DATABASE_URL=' "$REPO_ROOT/backend/.env" | cut -d= -f2-)"
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL not set and not found in backend/.env — aborting." >&2
  exit 1
fi

# pg_dump doesn't understand SQLAlchemy's "+psycopg" driver suffix.
PG_URL="${DATABASE_URL/postgresql+psycopg:/postgresql:}"

mkdir -p "$OUT_DIR"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_FILE="$OUT_DIR/tr7-$TIMESTAMP.sql.gz"

echo "Dumping $PG_URL -> $OUT_FILE"
pg_dump "$PG_URL" --no-owner --no-privileges | gzip > "$OUT_FILE"
echo "Done: $(du -h "$OUT_FILE" | cut -f1)"
