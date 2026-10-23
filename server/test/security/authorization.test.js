// CLAUDE.md required test: only the facilitator can reveal, re-vote, accept estimates, or
// change stories, and the same holds for every other facilitator-only event (threat model T-18).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resetDatabase } from "../helpers/db.js";
import { recordPackets } from "../helpers/recorder.js";
import { connectAndJoin, startTestServer, waitFor } from "../helpers/socket-harness.js";

describe("facilitator-only events", () => {
  let server;
  let room;
  let sockets;
  let ids;
  let storyId;
  let roundId;
  const received = {};

  beforeAll(async () => {
    await resetDatabase();
    server = await startTestServer();
    room = await server.seedRoom();
    const voter = await server.addParticipant(room.roomId, "Riley");
    const observer = await server.addParticipant(room.roomId, "Olive", "observer");
    ids = { voter: voter.participantId, observer: observer.participantId };
    sockets = {
      facilitator: (await connectAndJoin(server, { token: room.facilitatorToken, code: room.code }))
        .socket,
      voter: (await connectAndJoin(server, { token: voter.token, code: room.code })).socket,
      observer: (await connectAndJoin(server, { token: observer.token, code: room.code })).socket,
    };
    for (const [name, socket] of Object.entries(sockets)) {
      received[name] = recordPackets(socket);
    }

    // A revealed round, so every event has something real to act on.
    const added = waitFor(sockets.facilitator, "story:update");
    await sockets.facilitator.emitWithAck("story:add", { titles: ["Login"] });
    storyId = (await added).stories[0].id;
    const selected = waitFor(sockets.facilitator, "story:update");
    await sockets.facilitator.emitWithAck("story:select", { storyId });
    roundId = (await selected).round.id;
    await sockets.voter.emitWithAck("vote:cast", { roundId, value: "5" });
    await sockets.facilitator.emitWithAck("round:reveal", { roundId });
  });

  afterAll(async () => {
    await server.close();
  });

  // Payloads are built lazily because the ids only exist after beforeAll.
  const FACILITATOR_ONLY = {
    "story:add": () => ({ titles: ["Sneaky"] }),
    "story:select": () => ({ storyId }),
    "round:reveal": () => ({ roundId }),
    "round:revote": () => ({ roundId }),
    "estimate:accept": () => ({ storyId, value: "5" }),
    "participant:remove": () => ({ participantId: ids.observer }),
    "facilitator:transfer": () => ({ participantId: ids.voter }),
    "room:end": () => ({}),
    "room:delete": () => ({ code: room.code }),
  };

  const cases = ["voter", "observer"].flatMap((role) =>
    Object.keys(FACILITATOR_ONLY).map((event) => [role, event]),
  );

  it.each(cases)(
    "refuses the %s's %s with FORBIDDEN and broadcasts nothing",
    async (role, event) => {
      const counts = Object.fromEntries(
        Object.entries(received).map(([name, list]) => [name, list.length]),
      );

      const ack = await sockets[role].emitWithAck(event, FACILITATOR_ONLY[event]());
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(ack).toEqual({
        ok: false,
        error: { code: "FORBIDDEN", message: "You don't have permission to do that." },
      });
      for (const [name, list] of Object.entries(received)) {
        expect(list.slice(counts[name]), `${name} received something`).toEqual([]);
      }
    },
  );

  it("left the room exactly as it was", async () => {
    const state = await server.roomService.getRoom(room.roomId);
    expect(state).toMatchObject({ status: "revealed", facilitatorId: room.facilitatorId });
    expect(state.participants).toHaveLength(3);
    expect(state.stories).toHaveLength(1);
  });
});
