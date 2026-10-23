import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetDatabase } from "../../test/helpers/db.js";
import { connectionOutcome, startTestServer, waitFor } from "../../test/helpers/socket-harness.js";

describe("socket handshake authentication", () => {
  let server;

  beforeEach(async () => {
    await resetDatabase();
    server = await startTestServer();
  });

  afterEach(async () => {
    await server.close();
  });

  it("accepts a valid rejoin token and remembers who and which room on the server", async () => {
    const room = await server.seedRoom();
    const socket = server.connectClient({ auth: { token: room.facilitatorToken } });

    expect(await connectionOutcome(socket)).toBe("connected");
    const [serverSocket] = await server.server.io.fetchSockets();
    expect(serverSocket.data).toEqual({ participantId: room.facilitatorId, roomId: room.roomId });
  });

  it("accepts the token returned by POST /api/rooms on the same server", async () => {
    const { body } = await request(server.url)
      .post("/api/rooms")
      .send({ roomName: "Sprint", displayName: "Dana" });
    const socket = server.connectClient({ auth: { token: body.rejoinToken } });

    expect(await connectionOutcome(socket)).toBe("connected");
  });

  it.each([
    ["no auth at all", undefined],
    ["an empty auth object", {}],
    ["a malformed token", { token: "not-a-token" }],
    ["a well-formed token nobody has", { token: "A".repeat(43) }],
    ["a non-string token", { token: { $ne: null } }],
  ])("refuses %s with a generic error", async (_label, auth) => {
    await server.seedRoom();
    expect(await connectionOutcome(server.connectClient({ auth }))).toBe("Unauthorized");
  });

  it("refuses the token of a participant who was removed", async () => {
    const room = await server.seedRoom();
    const riley = await server.addParticipant(room.roomId, "Riley");
    await server.roomService.dispatch(room.roomId, {
      type: "participantRemoved",
      actorId: room.facilitatorId,
      participantId: riley.participantId,
    });

    expect(await connectionOutcome(server.connectClient({ auth: { token: riley.token } }))).toBe(
      "Unauthorized",
    );
  });

  it("allows 10 sockets per participant and refuses the 11th until one closes", async () => {
    const room = await server.seedRoom();
    const auth = { token: room.facilitatorToken };
    const sockets = [];
    for (let index = 0; index < 10; index += 1) {
      const socket = server.connectClient({ auth });
      expect(await connectionOutcome(socket)).toBe("connected");
      sockets.push(socket);
    }

    expect(await connectionOutcome(server.connectClient({ auth }))).toBe("Too many connections");

    sockets[0].disconnect();
    await waitFor(sockets[0], "disconnect");
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(await connectionOutcome(server.connectClient({ auth }))).toBe("connected");
  });
});
