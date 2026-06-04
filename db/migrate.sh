#!/usr/bin/env bash
# Run all SQL migrations in order against the database.
# Usage: ./db/migrate.sh [DATABASE_URL]
#
# Reads DATABASE_URL from the environment if not passed as an argument.
# Requires psql to be installed.

set -euo pipefail

DB_URL="${1:-${DATABASE_URL:-}}"

if [ -z "$DB_URL" ]; then
  echo "Error: DATABASE_URL not set. Pass it as an argument or export it."
  echo "Usage: ./db/migrate.sh postgres://user:pass@localhost:5432/basilisk"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MIGRATIONS_DIR="$SCRIPT_DIR/migrations"

echo "Running migrations against: ${DB_URL%%@*}@***"

for f in "$MIGRATIONS_DIR"/*.sql; do
  echo "  → $(basename "$f")"
  psql "$DB_URL" -f "$f" --set ON_ERROR_STOP=1 -q
done

echo "Done. All migrations applied."
