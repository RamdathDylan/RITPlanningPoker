import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetDatabase } from "../test/helpers/db.js";
import { connectAndJoin, startTestServer, waitFor } from "../test/helpers/socket-harness.js";
import { persist } from "./db/persist.js";
import { shutdown } from "./shutdown.js";

const servers = [];

async function serverWith(options) {
  const server = await startTestServer(options);
  servers.push(server);
  return server;
}

async function shutDown(server) {
  server.markClosed();
  await shutdown({
    server: server.server,
    roomService: server.roomService,
    pool: server.pool,
    logger: server.logger,
  });
}

describe("graceful shutdown", () => {
  beforeEach(resetDatabase);
  afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => server.close()));
  });

  it("waits for in-flight room events to be saved before finishing", async () => {
    let writeFinished = false;
    const slowPersist = async (client, change) => {
      if (change.action.type === "storiesAdded") {
        await new Promise((resolve) => setTimeout(resolve, 300));
        await persist(client, change);
        writeFinished = true;
        return;
      }
      await persist(client, change);
    };
    const server = await serverWith({ persistChange: slowPersist });
    const room = await server.seedRoom();
    const { socket } = await connectAndJoin(server, {
      token: room.facilitatorToken,
      code: room.code,
    });

    const ack = socket.emitWithAck("story:add", { titles: ["Saved before exit"] });
    await new Promise((resolve) => setTimeout(resolve, 50));
    await shutDown(server);

    expect(writeFinished).toBe(true);
    expect(await ack).toEqual({ ok: true });
  });

  it("disconnects connected clients so they start reconnecting", async () => {
    const server = await serverWith();
    const room = await server.seedRoom();
    const { socket } = await connectAndJoin(server, {
      token: room.facilitatorToken,
      code: room.code,
    });
    const dropped = waitFor(socket, "disconnect");

    await shutDown(server);

    const [reason] = await dropped;
    expect(["io server disconnect", "transport close"]).toContain(reason);
  });

  it("stops accepting new requests", async () => {
    const server = await serverWith();
    await shutDown(server);
    await expect(request(server.url).get("/health")).rejects.toThrow();
  });

  it("lets a fresh server on the same database restore the room, votes included", async () => {
    const first = await serverWith();
    const room = await first.seedRoom();
    const { socket } = await connectAndJoin(first, {
      token: room.facilitatorToken,
      code: room.code,
    });
    const added = waitFor(socket, "story:update");
    await socket.emitWithAck("story:add", { titles: ["Login"] });
    const selected = waitFor(socket, "story:update");
    await socket.emitWithAck("story:select", { storyId: (await added).stories[0].id });
    const { round } = await selected;
    await socket.emitWithAck("vote:cast", { roundId: round.id, value: "8" });
    await shutDown(first);

    const second = await serverWith();
    const { state } = await connectAndJoin(second, {
      token: room.facilitatorToken,
      code: room.code,
    });

    expect(state.room.status).toBe("voting");
    expect(state.round.id).toBe(round.id);
    expect(state.me.myVote).toBe("8");
  });

  it("logs the start and end of the shutdown", async () => {
    const server = await serverWith();
    await shutDown(server);
    expect(server.logger.entries.map((entry) => entry.message)).toEqual(
      expect.arrayContaining(["Shutting down", "Shutdown complete"]),
    );
  });
});
