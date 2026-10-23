import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetDatabase } from "../../test/helpers/db.js";
import {
  connectAndJoin,
  connectionOutcome,
  startTestServer,
  waitFor,
} from "../../test/helpers/socket-harness.js";

describe("participant management over sockets", () => {
  let server;
  let room;
  let rileySeat;
  let dana;
  let riley;
  let olive;

  beforeEach(async () => {
    await resetDatabase();
    server = await startTestServer();
    room = await server.seedRoom();
    rileySeat = await server.addParticipant(room.roomId, "Riley");
    const oliveSeat = await server.addParticipant(room.roomId, "Olive", "observer");
    dana = (await connectAndJoin(server, { token: room.facilitatorToken, code: room.code })).socket;
    riley = (await connectAndJoin(server, { token: rileySeat.token, code: room.code })).socket;
    olive = (await connectAndJoin(server, { token: oliveSeat.token, code: room.code })).socket;
  });

  afterEach(async () => {
    await server.close();
  });

  const idsIn = (update) => update.participants.map((participant) => participant.id);

  it("lets the facilitator remove someone: they are told, disconnected, and locked out", async () => {
    const rileyTold = waitFor(riley, "room:removed");
    const rileyDropped = waitFor(riley, "disconnect");
    const oliveSees = waitFor(olive, "participant:update");

    const ack = await dana.emitWithAck("participant:remove", {
      participantId: rileySeat.participantId,
    });

    expect(ack).toEqual({ ok: true });
    expect(await rileyTold).toEqual({ reason: "kicked" });
    expect((await rileyDropped)[0]).toBe("io server disconnect");
    expect(idsIn(await oliveSees)).not.toContain(rileySeat.participantId);
    expect(
      await connectionOutcome(server.connectClient({ auth: { token: rileySeat.token } })),
    ).toBe("Unauthorized");
  });

  it("lets a participant switch to observer, dropping their vote", async () => {
    const added = waitFor(dana, "story:update");
    await dana.emitWithAck("story:add", { titles: ["Login"] });
    const selected = waitFor(dana, "story:update");
    await dana.emitWithAck("story:select", { storyId: (await added).stories[0].id });
    const { round } = await selected;
    const voted = waitFor(olive, "vote:status");
    await riley.emitWithAck("vote:cast", { roundId: round.id, value: "5" });
    await voted;
    const oliveSees = waitFor(olive, "participant:update");

    expect(await riley.emitWithAck("participant:setRole", { role: "observer" })).toEqual({
      ok: true,
    });

    const rileyNow = (await oliveSees).participants.find((p) => p.id === rileySeat.participantId);
    expect(rileyNow).toMatchObject({ role: "observer", hasVoted: false });
  });

  it("hands facilitator controls to someone else", async () => {
    const oliveSees = waitFor(olive, "participant:update");

    expect(
      await dana.emitWithAck("facilitator:transfer", { participantId: rileySeat.participantId }),
    ).toEqual({
      ok: true,
    });

    expect((await oliveSees).facilitatorId).toBe(rileySeat.participantId);
    expect((await dana.emitWithAck("story:add", { titles: ["Not mine anymore"] })).error.code).toBe(
      "FORBIDDEN",
    );
    expect(await riley.emitWithAck("story:add", { titles: ["Mine now"] })).toEqual({ ok: true });
  });

  it("lets a participant leave the room for good", async () => {
    const oliveSees = waitFor(olive, "participant:update");

    expect(await riley.emitWithAck("room:leave", {})).toEqual({ ok: true });

    expect(idsIn(await oliveSees)).not.toContain(rileySeat.participantId);
    expect(
      await connectionOutcome(server.connectClient({ auth: { token: rileySeat.token } })),
    ).toBe("Unauthorized");
  });
});
