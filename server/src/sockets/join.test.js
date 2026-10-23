import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetDatabase } from "../../test/helpers/db.js";
import {
  connectAndJoin,
  connectionOutcome,
  nothingReceived,
  startTestServer,
  waitFor,
} from "../../test/helpers/socket-harness.js";

describe("room:join and presence", () => {
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

  it("acknowledges the join and sends this socket its own view of the room", async () => {
    const { state } = await connectAndJoin(server, {
      token: room.facilitatorToken,
      code: room.code,
    });

    expect(state.room).toMatchObject({
      code: room.code,
      status: "idle",
      facilitatorId: room.facilitatorId,
    });
    expect(state.me).toEqual({
      participantId: room.facilitatorId,
      role: "voter",
      isFacilitator: true,
      myVote: null,
    });
    expect(state.participants).toEqual([
      {
        id: room.facilitatorId,
        displayName: "Dana",
        role: "voter",
        connected: true,
        hasVoted: false,
      },
    ]);
  });

  it("accepts the code in any case and with a dash", async () => {
    const typed = `${room.code.slice(0, 4)}-${room.code.slice(4)}`.toLowerCase();
    await connectAndJoin(server, { token: room.facilitatorToken, code: typed });
  });

  it("tells everyone else in the room that the participant is now connected", async () => {
    const riley = await server.addParticipant(room.roomId, "Riley");
    const { socket: dana } = await connectAndJoin(server, {
      token: room.facilitatorToken,
      code: room.code,
    });
    const danaHearsRiley = waitFor(dana, "participant:update");
    const noExtraState = nothingReceived(dana, "room:state");

    await connectAndJoin(server, { token: riley.token, code: room.code });

    const update = await danaHearsRiley;
    expect(update.facilitatorId).toBe(room.facilitatorId);
    expect(
      update.participants.find((participant) => participant.id === riley.participantId).connected,
    ).toBe(true);
    await noExtraState;
  });

  it("rejects a code for a different room than the token's", async () => {
    const other = await server.seedRoom({ code: "Z2345678" });
    const socket = server.connectClient({ auth: { token: room.facilitatorToken } });
    await connectionOutcome(socket);

    const ack = await socket.emitWithAck("room:join", { code: other.code });

    expect(ack).toEqual({
      ok: false,
      error: { code: "FORBIDDEN", message: "You don't have permission to do that." },
    });
  });

  it("rejects an invalid payload", async () => {
    const socket = server.connectClient({ auth: { token: room.facilitatorToken } });
    await connectionOutcome(socket);

    const ack = await socket.emitWithAck("room:join", { code: room.code, extra: true });

    expect(ack).toEqual({
      ok: false,
      error: { code: "INVALID_PAYLOAD", message: "That request wasn't valid." },
    });
  });

  it("marks a participant disconnected only when their last socket closes", async () => {
    const riley = await server.addParticipant(room.roomId, "Riley");
    const { socket: dana } = await connectAndJoin(server, {
      token: room.facilitatorToken,
      code: room.code,
    });
    const { socket: rileyTab1 } = await connectAndJoin(server, {
      token: riley.token,
      code: room.code,
    });
    const { socket: rileyTab2 } = await connectAndJoin(server, {
      token: riley.token,
      code: room.code,
    });

    const quietAfterFirstTab = nothingReceived(dana, "participant:update");
    rileyTab1.disconnect();
    await quietAfterFirstTab;

    const update = waitFor(dana, "participant:update");
    rileyTab2.disconnect();
    expect(
      (await update).participants.find((participant) => participant.id === riley.participantId)
        .connected,
    ).toBe(false);
  });
});
