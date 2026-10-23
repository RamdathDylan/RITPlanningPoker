import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { migrate } from "./migrate.js";

const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "migrations");

async function main() {
  const connectionString = process.env.MIGRATION_DATABASE_URL;
  if (!connectionString) {
    process.stderr.write("MIGRATION_DATABASE_URL is not set. See .env.example.\n");
    process.exitCode = 1;
    return;
  }

  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    const applied = await migrate(client, migrationsDir);
    const summary = applied.length === 0 ? "No pending migrations." : applied.join("\n");
    process.stdout.write(`${summary}\n`);
  } finally {
    await client.end();
  }
}

try {
  await main();
} catch (error) {
  process.stderr.write(`Migration failed: ${error.message}\n`);
  if (error.cause) {
    process.stderr.write(`Cause: ${error.cause.message}\n`);
  }
  process.exitCode = 1;
}
