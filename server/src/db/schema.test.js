import { randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createIsolatedSchema } from "../../test/helpers/db.js";
import { migrate } from "./migrate.js";

const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "migrations");
const tokenHash = () => randomBytes(32);

async function createRoomWithFacilitator(client, { name = "Dana", code = "ABCDEFGH" } = {}) {
  await client.query("BEGIN");
  const { rows: rooms } = await client.query(
    `INSERT INTO rooms (join_code, name, facilitator_id)
     VALUES ($1, 'Sprint 12', gen_random_uuid()) RETURNING id`,
    [code],
  );
  const roomId = rooms[0].id;
  const { rows: people } = await client.query(
    `INSERT INTO participants (room_id, display_name, role, rejoin_token_hash)
     VALUES ($1, $2, 'voter', $3) RETURNING id`,
    [roomId, name, tokenHash()],
  );
  await client.query("UPDATE rooms SET facilitator_id = $1 WHERE id = $2", [people[0].id, roomId]);
  await client.query("COMMIT");
  return { roomId, facilitatorId: people[0].id };
}

async function insertStory(client, roomId, overrides = {}) {
  const story = {
    title: "Login",
    position: 0,
    status: "pending",
    finalEstimate: null,
    ...overrides,
  };
  const { rows } = await client.query(
    `INSERT INTO stories (room_id, title, position, status, final_estimate)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [roomId, story.title, story.position, story.status, story.finalEstimate],
  );
  return rows[0].id;
}

async function expectViolation(promise, sqlState) {
  await expect(promise).rejects.toMatchObject({ code: sqlState });
}

const CHECK_VIOLATION = "23514";
const UNIQUE_VIOLATION = "23505";
const FOREIGN_KEY_VIOLATION = "23503";

describe("initial schema", () => {
  let schema;
  let client;

  beforeEach(async () => {
    schema = await createIsolatedSchema();
    client = await schema.connect();
    await migrate(client, migrationsDir);
  });

  afterEach(async () => {
    await client.query("ROLLBACK").catch(() => {});
    await schema.drop();
  });

  it("applies to an empty database", async () => {
    const { rows } = await client.query("SELECT name FROM schema_migrations");
    expect(rows.map((row) => row.name)).toEqual(["001-initial-schema.sql"]);
  });

  it("creates a room and its facilitator in one transaction", async () => {
    const { roomId, facilitatorId } = await createRoomWithFacilitator(client);
    const { rows } = await client.query(
      "SELECT facilitator_id, status, deck_type FROM rooms WHERE id = $1",
      [roomId],
    );
    expect(rows[0]).toEqual({
      facilitator_id: facilitatorId,
      status: "idle",
      deck_type: "fibonacci",
    });
  });

  it("rejects a facilitator id that points at nobody when the transaction commits", async () => {
    await client.query("BEGIN");
    await client.query(
      "INSERT INTO rooms (join_code, name, facilitator_id) VALUES ('ABCDEFGH', 'x', gen_random_uuid())",
    );
    await expectViolation(client.query("COMMIT"), FOREIGN_KEY_VIOLATION);
  });

  it("rejects a 41-character display name", async () => {
    await expectViolation(
      createRoomWithFacilitator(client, { name: "x".repeat(41) }),
      CHECK_VIOLATION,
    );
  });

  it("rejects a 201-character story title", async () => {
    const { roomId } = await createRoomWithFacilitator(client);
    await expectViolation(insertStory(client, roomId, { title: "x".repeat(201) }), CHECK_VIOLATION);
  });

  it.each(["ABCDEFG", "ABCDEFGI", "abcdefgh", "ABCD-EFG"])(
    "rejects the join code %j",
    async (code) => {
      await expectViolation(createRoomWithFacilitator(client, { code }), CHECK_VIOLATION);
    },
  );

  it("rejects an estimated story without an estimate", async () => {
    const { roomId } = await createRoomWithFacilitator(client);
    await expectViolation(insertStory(client, roomId, { status: "estimated" }), CHECK_VIOLATION);
  });

  it("rejects ? as a final estimate", async () => {
    const { roomId } = await createRoomWithFacilitator(client);
    await expectViolation(
      insertStory(client, roomId, { status: "estimated", finalEstimate: "?" }),
      CHECK_VIOLATION,
    );
  });

  it("rejects a vote value outside the deck", async () => {
    const { roomId, facilitatorId } = await createRoomWithFacilitator(client);
    const storyId = await insertStory(client, roomId);
    const { rows } = await client.query(
      "INSERT INTO rounds (story_id, round_number) VALUES ($1, 1) RETURNING id",
      [storyId],
    );
    await expectViolation(
      client.query("INSERT INTO votes (round_id, participant_id, value) VALUES ($1, $2, '4')", [
        rows[0].id,
        facilitatorId,
      ]),
      CHECK_VIOLATION,
    );
  });

  it("rejects a second participant with the same name ignoring case", async () => {
    const { roomId } = await createRoomWithFacilitator(client);
    await expectViolation(
      client.query(
        `INSERT INTO participants (room_id, display_name, role, rejoin_token_hash)
         VALUES ($1, 'DANA', 'voter', $2)`,
        [roomId, tokenHash()],
      ),
      UNIQUE_VIOLATION,
    );
  });

  it("deletes everything a room owns when the room is deleted", async () => {
    const { roomId, facilitatorId } = await createRoomWithFacilitator(client);
    const storyId = await insertStory(client, roomId);
    const { rows } = await client.query(
      "INSERT INTO rounds (story_id, round_number) VALUES ($1, 1) RETURNING id",
      [storyId],
    );
    await client.query("INSERT INTO votes (round_id, participant_id, value) VALUES ($1, $2, '5')", [
      rows[0].id,
      facilitatorId,
    ]);

    await client.query("DELETE FROM rooms WHERE id = $1", [roomId]);

    const { rows: counts } = await client.query(`
      SELECT (SELECT count(*)::int FROM participants) AS participants,
             (SELECT count(*)::int FROM stories) AS stories,
             (SELECT count(*)::int FROM rounds) AS rounds,
             (SELECT count(*)::int FROM votes) AS votes
    `);
    expect(counts[0]).toEqual({ participants: 0, stories: 0, rounds: 0, votes: 0 });
  });
});
