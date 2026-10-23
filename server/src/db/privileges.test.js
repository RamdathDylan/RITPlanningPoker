import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { requireEnv } from "../../test/helpers/db.js";

const INSUFFICIENT_PRIVILEGE = "42501";

describe("the app's database role (pp_app)", () => {
  let app;

  beforeAll(async () => {
    app = new pg.Client({ connectionString: requireEnv("TEST_DATABASE_URL") });
    await app.connect();
    await app.query("BEGIN");
  });

  afterAll(async () => {
    await app.query("ROLLBACK");
    await app.end();
  });

  it("connects as pp_app", async () => {
    const { rows } = await app.query("SELECT current_user");
    expect(rows[0].current_user).toBe("pp_app");
  });

  it("can insert, select, update, and delete application data", async () => {
    await app.query("SAVEPOINT data_access");
    const { rows } = await app.query(
      "INSERT INTO rooms (join_code, name) VALUES ('PRIVTEST', 'Privileges') RETURNING id",
    );
    await app.query("UPDATE rooms SET name = 'Renamed' WHERE id = $1", [rows[0].id]);
    const selected = await app.query("SELECT name FROM rooms WHERE id = $1", [rows[0].id]);
    expect(selected.rows[0].name).toBe("Renamed");
    await app.query("DELETE FROM rooms WHERE id = $1", [rows[0].id]);
    await app.query("RELEASE SAVEPOINT data_access");
  });

  it.each([
    ["create a table", "CREATE TABLE intruder (id integer)"],
    ["drop a table", "DROP TABLE votes"],
    ["alter a table", "ALTER TABLE rooms ADD COLUMN intruder text"],
    ["truncate a table", "TRUNCATE rooms CASCADE"],
    ["rewrite migration history", "DELETE FROM schema_migrations"],
  ])("cannot %s", async (_label, sql) => {
    await app.query("SAVEPOINT attempt");
    await expect(app.query(sql)).rejects.toMatchObject({ code: INSUFFICIENT_PRIVILEGE });
    await app.query("ROLLBACK TO SAVEPOINT attempt");
  });
});
