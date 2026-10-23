import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetDatabase } from "../../test/helpers/db.js";
import { connectAndJoin, startTestServer, waitFor } from "../../test/helpers/socket-harness.js";

describe("socket event wrapper", () => {
  let server;
  let room;

  beforeEach(async () => {
    await resetDatabase();
    server = await startTestServer();
    room = await server.seedRoom();
  });

  afterEach(async () => {
    await server.close();
  });

  it("answers RATE_LIMITED once a socket sends more than 20 events in a burst", async () => {
    const { socket } = await connectAndJoin(server, {
      token: room.facilitatorToken,
      code: room.code,
    });

    const acks = [];
    for (let index = 0; index < 21; index += 1) {
      acks.push(await socket.emitWithAck("room:join", { code: room.code }));
    }

    expect(acks.slice(0, 19).every((ack) => ack.ok)).toBe(true);
    expect(acks.at(-1)).toEqual({
      ok: false,
      error: { code: "RATE_LIMITED", message: "Too many requests. Please slow down." },
    });
  });

  it("disconnects a socket that keeps flooding", async () => {
    const { socket } = await connectAndJoin(server, {
      token: room.facilitatorToken,
      code: room.code,
    });
    const kicked = waitFor(socket, "disconnect");

    for (let index = 0; index < 23; index += 1) {
      socket.emit("room:join", { code: room.code }, () => {});
    }

    expect(await kicked).toBe("io server disconnect");
  });

  it("survives an event sent without an acknowledgement callback", async () => {
    const { socket } = await connectAndJoin(server, {
      token: room.facilitatorToken,
      code: room.code,
    });

    socket.emit("room:join", { code: room.code });
    socket.emit("room:join", "not even an object");

    expect(await socket.emitWithAck("room:join", { code: room.code })).toEqual({ ok: true });
  });

  it("acks INTERNAL when a handler throws, and logs the event name but not the payload", async () => {
    const { socket } = await connectAndJoin(server, {
      token: room.facilitatorToken,
      code: room.code,
    });
    server.roomService.getRoom = async () => {
      throw new Error("database unavailable");
    };

    const ack = await socket.emitWithAck("room:join", { code: room.code });

    expect(ack).toEqual({
      ok: false,
      error: { code: "INTERNAL", message: "Something went wrong" },
    });
    const entry = server.logger.entries.find((logged) => logged.level === "error");
    expect(entry.details.event).toBe("room:join");
    expect(JSON.stringify(entry.details)).not.toContain(room.code);
  });
});
