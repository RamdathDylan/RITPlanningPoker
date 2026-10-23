import { randomBytes, randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createAppPool, resetDatabase } from "../../test/helpers/db.js";
import { createFakeClock } from "../../test/helpers/fake-clock.js";
import { insertRoomWithFacilitator } from "../db/rooms.js";
import { createRoomService } from "./service.js";

const pool = createAppPool();
const START = Date.UTC(2026, 9, 23, 12, 0, 0);
const HANDOFF_MS = 60_000;

const connect = (participantId) => ({ type: "participantConnected", participantId });
const disconnect = (participantId) => ({ type: "participantDisconnected", participantId });

function build(clock) {
  return createRoomService({ pool, clock, handoffMs: HANDOFF_MS });
}

// A room with Dana (facilitator) and Riley, both connected.
async function liveRoom(service) {
  const roomId = randomUUID();
  const dana = randomUUID();
  await insertRoomWithFacilitator(pool, {
    roomId,
    code: "ABCDEFGH",
    name: "Sprint 12",
    facilitator: { id: dana, displayName: "Dana", tokenHash: randomBytes(32) },
    now: START,
  });
  const riley = randomUUID();
  await service.dispatch(roomId, {
    type: "participantJoined",
    participant: { id: riley, displayName: "Riley", role: "voter", tokenHash: randomBytes(32) },
  });
  await service.dispatch(roomId, connect(dana));
  await service.dispatch(roomId, connect(riley));
  return { roomId, dana, riley };
}

async function facilitatorAfter(service, clock, roomId, ms) {
  clock.advance(ms);
  await service.idle();
  return (await service.getRoom(roomId)).facilitatorId;
}

describe("facilitator handoff timer", () => {
  beforeEach(resetDatabase);
  afterAll(() => pool.end());

  it("hands control to the next connected participant 60 seconds after the facilitator drops", async () => {
    const clock = createFakeClock(START);
    const service = build(clock);
    const { roomId, dana, riley } = await liveRoom(service);
    await service.dispatch(roomId, disconnect(dana));

    expect(await facilitatorAfter(service, clock, roomId, HANDOFF_MS - 1)).toBe(dana);
    expect(await facilitatorAfter(service, clock, roomId, 1)).toBe(riley);
  });

  it("tells listeners about the handoff so clients can be updated", async () => {
    const clock = createFakeClock(START);
    const service = build(clock);
    const { roomId, dana } = await liveRoom(service);
    const changes = [];
    service.onChange((_roomId, change) => changes.push(change.action.type));
    await service.dispatch(roomId, disconnect(dana));

    await facilitatorAfter(service, clock, roomId, HANDOFF_MS);

    expect(changes).toContain("facilitatorHandoff");
  });

  it("keeps the facilitator if they come back within 60 seconds", async () => {
    const clock = createFakeClock(START);
    const service = build(clock);
    const { roomId, dana } = await liveRoom(service);
    await service.dispatch(roomId, disconnect(dana));
    clock.advance(30_000);
    await service.dispatch(roomId, connect(dana));

    expect(await facilitatorAfter(service, clock, roomId, HANDOFF_MS)).toBe(dana);
  });

  it("still hands off after a server restart when the facilitator never returns", async () => {
    const before = build(createFakeClock(START));
    const { roomId, riley } = await liveRoom(before);
    await before.idle();

    const clock = createFakeClock(START + 5_000);
    const restarted = build(clock);
    await restarted.dispatch(roomId, connect(riley));

    expect(await facilitatorAfter(restarted, clock, roomId, HANDOFF_MS)).toBe(riley);
  });
});
