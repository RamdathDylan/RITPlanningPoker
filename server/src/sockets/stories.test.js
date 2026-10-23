import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetDatabase } from "../../test/helpers/db.js";
import {
  connectAndJoin,
  connectionOutcome,
  nothingReceived,
  startTestServer,
  waitFor,
} from "../../test/helpers/socket-harness.js";

describe("stories over sockets", () => {
  let server;
  let room;
  let dana;
  let riley;

  beforeEach(async () => {
    await resetDatabase();
    server = await startTestServer();
    room = await server.seedRoom();
    const rileySeat = await server.addParticipant(room.roomId, "Riley");
    dana = (await connectAndJoin(server, { token: room.facilitatorToken, code: room.code })).socket;
    riley = (await connectAndJoin(server, { token: rileySeat.token, code: room.code })).socket;
  });

  afterEach(async () => {
    await server.close();
  });

  it("broadcasts added stories to everyone, including the facilitator", async () => {
    const rileySees = waitFor(riley, "story:update");
    const danaSees = waitFor(dana, "story:update");

    const ack = await dana.emitWithAck("story:add", { titles: ["  Login   page ", "Signup"] });

    expect(ack).toEqual({ ok: true });
    const update = await rileySees;
    expect(update).toEqual({
      stories: [
        {
          id: expect.any(String),
          title: "Login page",
          position: 0,
          status: "pending",
          finalEstimate: null,
        },
        {
          id: expect.any(String),
          title: "Signup",
          position: 1,
          status: "pending",
          finalEstimate: null,
        },
      ],
      currentStoryId: null,
      status: "idle",
      round: null,
    });
    expect(await danaSees).toEqual(update);
  });

  it("starts voting for everyone when the facilitator selects a story", async () => {
    const added = waitFor(riley, "story:update");
    await dana.emitWithAck("story:add", { titles: ["Login"] });
    const storyId = (await added).stories[0].id;

    const selected = waitFor(riley, "story:update");
    expect(await dana.emitWithAck("story:select", { storyId })).toEqual({ ok: true });

    expect(await selected).toMatchObject({
      currentStoryId: storyId,
      status: "voting",
      round: { id: expect.any(String), number: 1 },
    });
  });

  it("rejects a voter adding stories, without broadcasting anything", async () => {
    const quiet = nothingReceived(dana, "story:update");

    const ack = await riley.emitWithAck("story:add", { titles: ["Sneaky"] });

    expect(ack.error.code).toBe("FORBIDDEN");
    await quiet;
  });

  it("rejects room actions from a socket that hasn't joined the room yet", async () => {
    const socket = server.connectClient({ auth: { token: room.facilitatorToken } });
    await connectionOutcome(socket);

    const ack = await socket.emitWithAck("story:add", { titles: ["Too early"] });

    expect(ack.error.code).toBe("FORBIDDEN");
  });

  it("rejects 51 titles in one message", async () => {
    const titles = Array.from({ length: 51 }, (_, index) => `Story ${index}`);
    expect((await dana.emitWithAck("story:add", { titles })).error.code).toBe("INVALID_PAYLOAD");
  });

  it("rejects selecting a story that doesn't exist", async () => {
    const ack = await dana.emitWithAck("story:select", {
      storyId: "3f2b8c1e-9d4a-4f6b-8a2c-1e5d7f9b0a3c",
    });
    expect(ack.error.code).toBe("NOT_FOUND");
  });
});
