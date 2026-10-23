import { randomBytes } from "node:crypto";
import pg from "pg";

export function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. Copy .env.example to .env and start Postgres with "docker compose up -d".`,
    );
  }
  return value;
}

// Each test gets its own schema so tests never see each other's tables.
export async function createIsolatedSchema() {
  const connectionString = requireEnv("TEST_MIGRATION_DATABASE_URL");
  const schemaName = `test_${randomBytes(6).toString("hex")}`;

  const admin = new pg.Client({ connectionString });
  await admin.connect();
  await admin.query(`CREATE SCHEMA ${admin.escapeIdentifier(schemaName)}`);

  const openClients = [];

  async function connect() {
    const client = new pg.Client({ connectionString, options: `-c search_path=${schemaName}` });
    await client.connect();
    openClients.push(client);
    return client;
  }

  async function drop() {
    await Promise.all(openClients.map((client) => client.end()));
    await admin.query(`DROP SCHEMA ${admin.escapeIdentifier(schemaName)} CASCADE`);
    await admin.end();
  }

  return { schemaName, connect, drop };
}
