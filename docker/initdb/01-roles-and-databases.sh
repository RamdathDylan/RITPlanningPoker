#!/usr/bin/env bash
# Runs once, when the database volume is first created.
# Creates the two application roles and the test database, then gives the app role
# data access only (no CREATE, DROP, or ALTER). See docs/architecture.md section 7.
set -euo pipefail

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres \
  -v migrator_password="$PP_MIGRATOR_PASSWORD" \
  -v app_password="$PP_APP_PASSWORD" <<'SQL'
CREATE ROLE pp_migrator LOGIN PASSWORD :'migrator_password';
CREATE ROLE pp_app LOGIN PASSWORD :'app_password';
ALTER DATABASE planning_poker OWNER TO pp_migrator;
CREATE DATABASE planning_poker_test OWNER pp_migrator;
SQL

for database in planning_poker planning_poker_test; do
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$database" <<'SQL'
ALTER SCHEMA public OWNER TO pp_migrator;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO pp_app;
SQL
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$database" \
    -v db="$database" <<'SQL'
REVOKE ALL ON DATABASE :"db" FROM PUBLIC;
GRANT CONNECT ON DATABASE :"db" TO pp_app;
ALTER DEFAULT PRIVILEGES FOR ROLE pp_migrator IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO pp_app;
ALTER DEFAULT PRIVILEGES FOR ROLE pp_migrator IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO pp_app;
SQL
done
