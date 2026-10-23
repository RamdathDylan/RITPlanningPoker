#!/usr/bin/env bash
# Nightly database backup for the self-hosted server (ADR-006). Run from the repo folder on the
# server, e.g. from cron:
#   15 3 * * * cd /opt/planning-poker && ./scripts/backup.sh >> /var/log/planning-poker-backup.log 2>&1
#
# Keeps BACKUP_KEEP_DAYS (default 7) days of compressed dumps. Rooms are deleted after 30 days of
# inactivity, so deleted data survives at most 37 days (the maximum stated on the privacy page).
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/planning-poker}"
BACKUP_KEEP_DAYS="${BACKUP_KEEP_DAYS:-7}"
COMPOSE_FILE="${COMPOSE_FILE:-compose.prod.yml}"

# Backups contain personal data (display names), so only the owner may read them.
umask 077
mkdir -p "$BACKUP_DIR"

stamp="$(date -u +%Y-%m-%dT%H%M%SZ)"
target="$BACKUP_DIR/planning_poker-$stamp.sql.gz"
partial="$target.partial"

# pg_dump runs inside the db container as the superuser from the server's .env, so no
# password is typed, printed, or stored anywhere else.
docker compose -f "$COMPOSE_FILE" exec -T db \
  sh -c 'pg_dump --username "$POSTGRES_USER" --dbname planning_poker --no-owner' \
  | gzip -9 > "$partial"

# Only a complete dump gets its final name, so a failed run never looks like a good backup.
mv "$partial" "$target"
echo "Backup written: $(basename "$target") ($(du -h "$target" | cut -f1))"

find "$BACKUP_DIR" -name 'planning_poker-*.sql.gz' -type f -mtime "+$((BACKUP_KEEP_DAYS - 1))" -print -delete \
  | sed 's/^/Deleted old backup: /'
