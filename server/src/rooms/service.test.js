import { randomBytes, randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createAppPool, resetDatabase } from "../../test/helpers/db.js";
import { createFakeClock } from "../../test/helpers/fake-clock.js";
import { loadRoomState } from "../db/hydrate.js";
import { persist } from "../db/persist.js";
import { insertRoomWithFacilitator } from "../db/rooms.js";
import { createRoomService } from "./service.js";

const pool = createAppPool();
const START = Date.UTC(2026, 9, 23, 12, 0, 0);
const TEN_MINUTES = 10 * 60_000;

async function seedRoom() {
  const roomId = randomUUID();
  const facilitatorId = randomUUID();
  await insertRoomWithFacilitator(pool, {
    roomId,
    code: "ABCDEFGH",
    name: "Sprint 12",
    facilitator: { id: facilitatorId, displayName: "Dana", tokenHash: randomBytes(32) },
    now: START,
  });
  return { roomId, facilitatorId };
}

function build(overrides = {}) {
  const clock = createFakeClock(START);
  const calls = { load: 0, persist: 0 };
  const changes = [];
  const service = createRoomService({
    pool,
    clock,
    handoffMs: 60_000,
    loadRoom: async (db, roomId) => {
      calls.load += 1;
      return loadRoomState(db, roomId);
    },
    persistChange: async (client, change) => {
      calls.persist += 1;
      return persist(client, change);
    },
    ...overrides,
  });
  service.onChange((roomId, change) => changes.push({ roomId, change }));
  return { service, clock, calls, changes };
}

const connect = (participantId) => ({ type: "participantConnected", participantId });
const disconnect = (participantId) => ({ type: "participantDisconnected", participantId });

describe("createRoomService", () => {
  beforeEach(resetDatabase);
  afterAll(() => pool.end());

  it("loads a room from Postgres on first use and from memory afterwards", async () => {
    const { roomId } = await seedRoom();
    const { service, calls } = build();

    const first = await service.getRoom(roomId);
    const second = await service.getRoom(roomId);

    expect(first).toMatchObject({ id: roomId, code: "ABCDEFGH" });
    expect(second).toBe(first);
    expect(calls.load).toBe(1);
  });

  it("returns null for a room that doesn't exist", async () => {
    const { service } = build();
    expect(await service.getRoom(randomUUID())).toBeNull();
  });

  it("returns NOT_FOUND when dispatching to a room that doesn't exist", async () => {
    const { service } = build();
    expect(await service.dispatch(randomUUID(), connect(randomUUID()))).toEqual({
      ok: false,
      code: "NOT_FOUND",
    });
  });

  it("reduces, persists, commits to memory, and reports the change", async () => {
    const { roomId, facilitatorId } = await seedRoom();
    const { service, changes } = build();
    const action = {
      type: "storiesAdded",
      actorId: facilitatorId,
      stories: [{ id: randomUUID(), title: "Login" }],
    };

    const result = await service.dispatch(roomId, action);

    expect(result.ok).toBe(true);
    expect(result.state.stories.map((story) => story.title)).toEqual(["Login"]);
    expect(await service.getRoom(roomId)).toBe(result.state);
    expect((await loadRoomState(pool, roomId)).stories).toEqual(result.state.stories);
    expect(changes).toEqual([{ roomId, change: { action, state: result.state, effects: [] } }]);
  });

  it("never touches the database or listeners for a rejected action", async () => {
    const { roomId } = await seedRoom();
    const { service, calls, changes } = build();
    const before = await service.getRoom(roomId);

    const result = await service.dispatch(roomId, {
      type: "storiesAdded",
      actorId: "not-the-facilitator",
      stories: [{ id: randomUUID(), title: "Sneaky" }],
    });

    expect(result).toEqual({ ok: false, code: "FORBIDDEN" });
    expect(calls.persist).toBe(0);
    expect(changes).toEqual([]);
    expect(await service.getRoom(roomId)).toBe(before);
  });

  it("keeps memory unchanged and reports INTERNAL when the database write fails", async () => {
    const { roomId, facilitatorId } = await seedRoom();
    const failure = new Error("database unavailable");
    const { service, changes } = build({
      persistChange: async () => {
        throw failure;
      },
    });
    const before = await service.getRoom(roomId);

    const result = await service.dispatch(roomId, connect(facilitatorId));

    expect(result).toEqual({ ok: false, code: "INTERNAL", cause: failure });
    expect(await service.getRoom(roomId)).toBe(before);
    expect(changes).toEqual([]);
  });

  it("applies simultaneous actions one at a time, so only one reveal succeeds", async () => {
    const { roomId, facilitatorId } = await seedRoom();
    const { service } = build();
    const storyId = randomUUID();
    const roundId = randomUUID();
    await service.dispatch(roomId, {
      type: "storiesAdded",
      actorId: facilitatorId,
      stories: [{ id: storyId, title: "Login" }],
    });
    await service.dispatch(roomId, {
      type: "storySelected",
      actorId: facilitatorId,
      storyId,
      roundId,
    });
    await service.dispatch(roomId, {
      type: "voteCast",
      actorId: facilitatorId,
      roundId,
      value: "5",
    });

    const reveal = { type: "roundRevealed", actorId: facilitatorId, roundId };
    const results = await Promise.all([
      service.dispatch(roomId, reveal),
      service.dispatch(roomId, reveal),
    ]);

    expect(results.map((result) => result.ok ?? false)).toEqual([true, false]);
    expect(results[1]).toEqual({ ok: false, code: "INVALID_STATE" });
  });

  it("unloads a room from memory 10 minutes after the last person disconnects", async () => {
    const { roomId, facilitatorId } = await seedRoom();
    const { service, clock, calls } = build();
    await service.dispatch(roomId, connect(facilitatorId));
    await service.dispatch(roomId, disconnect(facilitatorId));

    clock.advance(TEN_MINUTES);
    await service.idle();
    await service.getRoom(roomId);

    expect(calls.load).toBe(2);
  });

  it("keeps a room in memory while anyone is connected", async () => {
    const { roomId, facilitatorId } = await seedRoom();
    const { service, clock, calls } = build();
    await service.dispatch(roomId, connect(facilitatorId));

    clock.advance(TEN_MINUTES * 3);
    await service.idle();
    await service.getRoom(roomId);

    expect(calls.load).toBe(1);
  });
});
