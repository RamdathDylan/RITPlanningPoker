import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

// Any fixed number works; every migration run in this app uses the same one,
// so Postgres lets only one run proceed at a time.
const MIGRATION_LOCK_ID = 7_310_427;
const MIGRATION_FILE = /^\d{3}-[a-z0-9-]+\.sql$/;

async function listMigrationFiles(migrationsDir) {
  const entries = await readdir(migrationsDir);
  return entries.filter((entry) => MIGRATION_FILE.test(entry)).sort();
}

async function appliedMigrationNames(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  const { rows } = await client.query("SELECT name FROM schema_migrations");
  return new Set(rows.map((row) => row.name));
}

async function applyMigration(client, migrationsDir, fileName) {
  const sql = await readFile(path.join(migrationsDir, fileName), "utf8");
  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [fileName]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw new Error(`Migration ${fileName} failed`, { cause: error });
  }
}

export async function migrate(client, migrationsDir) {
  await client.query("SELECT pg_advisory_lock($1)", [MIGRATION_LOCK_ID]);
  try {
    const applied = await appliedMigrationNames(client);
    const pending = (await listMigrationFiles(migrationsDir)).filter((name) => !applied.has(name));
    for (const fileName of pending) {
      await applyMigration(client, migrationsDir, fileName);
    }
    return pending;
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [MIGRATION_LOCK_ID]);
  }
}
