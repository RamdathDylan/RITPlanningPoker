import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetDatabase } from "../../test/helpers/db.js";
import { connectAndJoin, startTestServer, waitFor } from "../../test/helpers/socket-harness.js";

describe("votes over sockets", () => {
  let server;
  let dana;
  let riley;
  let sam;
  let rileyId;
  let roundId;

  beforeEach(async () => {
    await resetDatabase();
    server = await startTestServer();
    const room = await server.seedRoom();
    const rileySeat = await server.addParticipant(room.roomId, "Riley");
    const samSeat = await server.addParticipant(room.roomId, "Sam", "observer");
    rileyId = rileySeat.participantId;
    dana = (await connectAndJoin(server, { token: room.facilitatorToken, code: room.code })).socket;
    riley = (await connectAndJoin(server, { token: rileySeat.token, code: room.code })).socket;
    sam = (await connectAndJoin(server, { token: samSeat.token, code: room.code })).socket;

    const added = waitFor(dana, "story:update");
    await dana.emitWithAck("story:add", { titles: ["Login"] });
    const selected = waitFor(dana, "story:update");
    await dana.emitWithAck("story:select", { storyId: (await added).stories[0].id });
    roundId = (await selected).round.id;
  });

  afterEach(async () => {
    await server.close();
  });

  it("tells everyone who has voted, without the value", async () => {
    const samSees = waitFor(sam, "vote:status");

    expect(await riley.emitWithAck("vote:cast", { roundId, value: "5" })).toEqual({ ok: true });

    expect(await samSees).toEqual({ roundId, votedIds: [rileyId] });
  });

  it("tells everyone when a vote is cleared", async () => {
    await riley.emitWithAck("vote:cast", { roundId, value: "5" });
    const samSees = waitFor(sam, "vote:status");

    expect(await riley.emitWithAck("vote:clear", { roundId })).toEqual({ ok: true });

    expect(await samSees).toEqual({ roundId, votedIds: [] });
  });

  it("rejects a vote for an old round", async () => {
    const ack = await riley.emitWithAck("vote:cast", {
      roundId: "3f2b8c1e-9d4a-4f6b-8a2c-1e5d7f9b0a3c",
      value: "5",
    });
    expect(ack.error.code).toBe("STALE_ROUND");
  });

  it("rejects a vote from an observer", async () => {
    expect((await sam.emitWithAck("vote:cast", { roundId, value: "5" })).error.code).toBe(
      "FORBIDDEN",
    );
  });

  it("rejects a card that isn't in the deck", async () => {
    expect((await riley.emitWithAck("vote:cast", { roundId, value: "4" })).error.code).toBe(
      "INVALID_PAYLOAD",
    );
  });
});
