import { randomBytes, randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createAppPool, resetDatabase } from "../../test/helpers/db.js";
import { createFakeClock } from "../../test/helpers/fake-clock.js";
import { createFakeLogger } from "../../test/helpers/fake-logger.js";
import { insertRoomWithFacilitator } from "../db/rooms.js";
import { createRoomService } from "../rooms/service.js";
import { createRetentionJob } from "./retention.js";

const pool = createAppPool();
const NOW = Date.UTC(2026, 9, 23, 12, 0, 0);
const DAY = 24 * 60 * 60_000;
const HOUR = 60 * 60_000;

async function roomLastActive(daysAgo, code) {
  const roomId = randomUUID();
  await insertRoomWithFacilitator(pool, {
    roomId,
    code,
    name: "Old sprint",
    facilitator: { id: randomUUID(), displayName: "Dana", tokenHash: randomBytes(32) },
    now: NOW - daysAgo * DAY,
  });
  return roomId;
}

async function exists(roomId) {
  const { rows } = await pool.query(
    `SELECT (SELECT count(*)::int FROM rooms WHERE id = $1) AS rooms,
            (SELECT count(*)::int FROM participants WHERE room_id = $1) AS participants`,
    [roomId],
  );
  return rows[0];
}

function build() {
  const clock = createFakeClock(NOW);
  const logger = createFakeLogger();
  const roomService = createRoomService({ pool, clock, handoffMs: 60_000 });
  const job = createRetentionJob({ pool, roomService, clock, logger });
  return { clock, logger, roomService, job };
}

describe("retention job", () => {
  beforeEach(resetDatabase);
  afterAll(() => pool.end());

  it("deletes rooms inactive for more than 30 days, with everything they own", async () => {
    const stale = await roomLastActive(31, "ABCDEFGH");
    const { job } = build();

    await job.runOnce();

    expect(await exists(stale)).toEqual({ rooms: 0, participants: 0 });
  });

  it("keeps rooms used within the last 30 days", async () => {
    const recent = await roomLastActive(29, "ABCDEFGH");
    const { job } = build();

    await job.runOnce();

    expect(await exists(recent)).toEqual({ rooms: 1, participants: 1 });
  });

  it("evicts a deleted room from memory and tells anyone listening", async () => {
    const stale = await roomLastActive(31, "ABCDEFGH");
    const { job, roomService } = build();
    await roomService.getRoom(stale);
    const changes = [];
    roomService.onChange((roomId, change) => changes.push([roomId, change.action.type]));

    await job.runOnce();

    expect(await roomService.getRoom(stale)).toBeNull();
    expect(changes).toEqual([[stale, "roomDeleted"]]);
  });

  it("logs how many rooms it deleted, and nothing identifying", async () => {
    await roomLastActive(31, "ABCDEFGH");
    await roomLastActive(40, "Z2345678");
    const { job, logger } = build();

    await job.runOnce();

    expect(logger.entries).toEqual([
      { level: "info", message: "Deleted inactive rooms", details: { count: 2 } },
    ]);
  });

  it("runs at start and then every hour", async () => {
    const { job, clock } = build();
    await job.start();
    const stale = await roomLastActive(31, "ABCDEFGH");

    clock.advance(HOUR);
    await job.idle();

    expect(await exists(stale)).toEqual({ rooms: 0, participants: 0 });
    job.stop();
    expect(clock.pendingTimers()).toBe(0);
  });
});
