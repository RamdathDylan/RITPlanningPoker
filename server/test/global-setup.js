import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { migrate } from "../src/db/migrate.js";
import { requireEnv } from "./helpers/db.js";

const migrationsDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../src/db/migrations",
);

// Runs once before the server test project: brings the test database's schema up to date
// with the real migrations, as the schema owner (pp_migrator), exactly like a deploy would.
export default async function setup() {
  const client = new pg.Client({ connectionString: requireEnv("TEST_MIGRATION_DATABASE_URL") });
  await client.connect();
  try {
    await migrate(client, migrationsDir);
  } finally {
    await client.end();
  }
}
