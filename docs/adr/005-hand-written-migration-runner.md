# ADR-005: Hand-written SQL migration runner

**Status:** Proposed · **Date:** 2026-10-22 · **Deciders:** Dylan Ramdath

## Context

The schema changes over time through numbered `.sql` files that are never edited after they are applied. Migrations run as a deploy step, never by hand. The project uses hand-written SQL and no ORM.

## Decision

A runner of about 60 lines in `server/src/db/migrate.js`:

1. takes a Postgres **advisory lock**, a database-wide named lock, so two runs can't overlap;
2. creates `schema_migrations(name, applied_at)` if missing;
3. applies each unapplied `server/src/db/migrations/NNN-name.sql` in filename order, each in its own transaction, recording it in the same transaction;
4. fails loudly and stops at the first error.

It runs as the one-shot `migrate` service in Docker Compose, using the `pp_migrator` database role, before the app starts.

## Options considered

### Option A: Hand-written runner (chosen)

**Pros:** no dependency; fully understood; plain SQL files.
**Cons:** no down-migrations. Rollback means writing a new forward migration.

### Option B: node-pg-migrate 9.0.0

**Pros:** mature, supports down-migrations.
**Cons:** new dependency and conventions; JavaScript-based migrations by default.

## Consequences

- An "applies cleanly twice" test and a CHECK-constraint test run against a real Postgres in CI.

## Revisit when

- Down-migrations are needed, or a second developer joins.
