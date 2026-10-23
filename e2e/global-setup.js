import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { migrate } from "../server/src/db/migrate.js";

const migrationsDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../server/src/db/migrations",
);

// Brings the test database up to date before the real server starts for E2E tests.
export default async function setup() {
  const connectionString = process.env.TEST_MIGRATION_DATABASE_URL;
  if (!connectionString) {
    throw new Error("TEST_MIGRATION_DATABASE_URL is not set. See .env.example.");
  }
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await migrate(client, migrationsDir);
  } finally {
    await client.end();
  }
}
