import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createIsolatedSchema } from "../../test/helpers/db.js";
import { migrate } from "./migrate.js";

const fixtures = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../test/fixtures/migrations",
);
const orderedDir = path.join(fixtures, "ordered");
const failingDir = path.join(fixtures, "failing");

async function tableExists(client, tableName) {
  const { rows } = await client.query("SELECT to_regclass($1) IS NOT NULL AS exists", [tableName]);
  return rows[0].exists;
}

async function appliedNames(client) {
  const { rows } = await client.query("SELECT name FROM schema_migrations ORDER BY name");
  return rows.map((row) => row.name);
}

describe("migrate", () => {
  let schema;
  let client;

  beforeEach(async () => {
    schema = await createIsolatedSchema();
    client = await schema.connect();
  });

  afterEach(async () => {
    await schema.drop();
  });

  it("applies unapplied migration files in filename order and ignores other files", async () => {
    const applied = await migrate(client, orderedDir);

    expect(applied).toEqual(["001-create-events.sql", "002-insert-two.sql", "010-insert-ten.sql"]);
    expect(await appliedNames(client)).toEqual(applied);
    const { rows } = await client.query("SELECT n FROM events ORDER BY n");
    expect(rows.map((row) => row.n)).toEqual([2, 10]);
  });

  it("applies nothing when run a second time", async () => {
    await migrate(client, orderedDir);

    expect(await migrate(client, orderedDir)).toEqual([]);
    const { rows } = await client.query("SELECT count(*)::int AS count FROM events");
    expect(rows[0].count).toBe(2);
  });

  it("rolls back a failing migration completely and stops before later files", async () => {
    await expect(migrate(client, failingDir)).rejects.toThrow("002-broken.sql");

    expect(await appliedNames(client)).toEqual(["001-create-first.sql"]);
    expect(await tableExists(client, "first_table")).toBe(true);
    expect(await tableExists(client, "half_done")).toBe(false);
    expect(await tableExists(client, "never_created")).toBe(false);
  });

  it("applies each file exactly once when two runs start at the same time", async () => {
    const otherClient = await schema.connect();

    const results = await Promise.all([
      migrate(client, orderedDir),
      migrate(otherClient, orderedDir),
    ]);

    expect(results.flat().sort()).toEqual([
      "001-create-events.sql",
      "002-insert-two.sql",
      "010-insert-ten.sql",
    ]);
    expect(await appliedNames(client)).toHaveLength(3);
  });
});
