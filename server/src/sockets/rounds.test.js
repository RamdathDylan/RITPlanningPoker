import { afterEach, describe, expect, it } from "vitest";
import { persist } from "../db/persist.js";
import { resetDatabase } from "../../test/helpers/db.js";
import {
  connectAndJoin,
  nothingReceived,
  startTestServer,
  waitFor,
} from "../../test/helpers/socket-harness.js";

let server;

// Dana (facilitator), Riley (voter), and Olive (observer), voting on one story.
async function votingRoom(options) {
  await resetDatabase();
  server = await startTestServer(options);
  const room = await server.seedRoom();
  const rileySeat = await server.addParticipant(room.roomId, "Riley");
  const oliveSeat = await server.addParticipant(room.roomId, "Olive", "observer");
  const dana = (await connectAndJoin(server, { token: room.facilitatorToken, code: room.code }))
    .socket;
  const riley = (await connectAndJoin(server, { token: rileySeat.token, code: room.code })).socket;
  const olive = (await connectAndJoin(server, { token: oliveSeat.token, code: room.code })).socket;

  const added = waitFor(dana, "story:update");
  await dana.emitWithAck("story:add", { titles: ["Login"] });
  const storyId = (await added).stories[0].id;
  const selected = waitFor(dana, "story:update");
  await dana.emitWithAck("story:select", { storyId });
  const roundId = (await selected).round.id;
  return { room, dana, riley, olive, storyId, roundId, rileyId: rileySeat.participantId };
}

afterEach(async () => {
  await server.close();
});

describe("reveal, revote, and accept over sockets", () => {
  it("reveals every vote with stats to everyone", async () => {
    const { room, dana, riley, olive, roundId, rileyId } = await votingRoom();
    await dana.emitWithAck("vote:cast", { roundId, value: "3" });
    await riley.emitWithAck("vote:cast", { roundId, value: "8" });
    const oliveSees = waitFor(olive, "round:revealed");

    expect(await dana.emitWithAck("round:reveal", { roundId })).toEqual({ ok: true });

    const revealed = await oliveSees;
    expect(revealed.roundId).toBe(roundId);
    expect(revealed.votes).toEqual([
      { participantId: room.facilitatorId, value: "3" },
      { participantId: rileyId, value: "8" },
    ]);
    expect(revealed.stats).toMatchObject({ mean: 5.5, median: 5.5, suggestion: "8" });
  });

  it("starts round 2 on a revote", async () => {
    const { dana, olive, roundId } = await votingRoom();
    await dana.emitWithAck("vote:cast", { roundId, value: "3" });
    await dana.emitWithAck("round:reveal", { roundId });
    const oliveSees = waitFor(olive, "story:update");

    expect(await dana.emitWithAck("round:revote", { roundId })).toEqual({ ok: true });

    expect(await oliveSees).toMatchObject({ status: "voting", round: { number: 2 } });
  });

  it("records an accepted estimate and returns to idle", async () => {
    const { dana, olive, roundId, storyId } = await votingRoom();
    await dana.emitWithAck("vote:cast", { roundId, value: "5" });
    await dana.emitWithAck("round:reveal", { roundId });
    const oliveSees = waitFor(olive, "story:update");

    expect(await dana.emitWithAck("estimate:accept", { storyId, value: "5" })).toEqual({
      ok: true,
    });

    const update = await oliveSees;
    expect(update).toMatchObject({ status: "idle", currentStoryId: null, round: null });
    expect(update.stories[0]).toMatchObject({ status: "estimated", finalEstimate: "5" });
  });
});

describe("concurrency", () => {
  it("handles a double-clicked reveal exactly once", async () => {
    const { dana, olive, roundId } = await votingRoom();
    await dana.emitWithAck("vote:cast", { roundId, value: "5" });
    let reveals = 0;
    olive.on("round:revealed", () => {
      reveals += 1;
    });

    const acks = await Promise.all([
      dana.emitWithAck("round:reveal", { roundId }),
      dana.emitWithAck("round:reveal", { roundId }),
    ]);
    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(acks.map((ack) => ack.ok).sort()).toEqual([false, true]);
    expect(acks.find((ack) => !ack.ok).error.code).toBe("INVALID_STATE");
    expect(reveals).toBe(1);
  });

  it("never acknowledges a vote that the reveal then leaves out (50 races)", async () => {
    let { dana, riley, olive, roundId, rileyId } = await votingRoom();

    for (let attempt = 0; attempt < 50; attempt += 1) {
      await dana.emitWithAck("vote:cast", { roundId, value: "5" });
      const revealed = waitFor(olive, "round:revealed");

      const [voteAck, revealAck] = await Promise.all([
        riley.emitWithAck("vote:cast", { roundId, value: "8" }),
        dana.emitWithAck("round:reveal", { roundId }),
      ]);

      expect(revealAck).toEqual({ ok: true });
      const included = (await revealed).votes.some((vote) => vote.participantId === rileyId);
      expect(voteAck.ok, `attempt ${attempt}`).toBe(included);
      if (!voteAck.ok) {
        expect(voteAck.error.code).toBe("INVALID_STATE");
      }

      const next = waitFor(dana, "story:update");
      await dana.emitWithAck("round:revote", { roundId });
      roundId = (await next).round.id;
    }
  }, 30_000);

  it("broadcasts nothing and keeps the room unchanged when the database write fails", async () => {
    const failReveal = async (client, change) => {
      if (change.action.type === "roundRevealed") {
        throw new Error("database unavailable");
      }
      return persist(client, change);
    };
    const { room, dana, olive, roundId } = await votingRoom({ persistChange: failReveal });
    await dana.emitWithAck("vote:cast", { roundId, value: "5" });
    const quiet = nothingReceived(olive, "round:revealed");

    const ack = await dana.emitWithAck("round:reveal", { roundId });

    expect(ack).toEqual({
      ok: false,
      error: { code: "INTERNAL", message: "Something went wrong" },
    });
    await quiet;
    expect((await server.roomService.getRoom(room.roomId)).status).toBe("voting");
  });
});
