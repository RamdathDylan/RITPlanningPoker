// CLAUDE.md required test: vote values are not present in any broadcast before reveal.
// Every packet every client receives is recorded and scanned.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetDatabase } from "../helpers/db.js";
import { findKeyDeep, recordPackets } from "../helpers/recorder.js";
import { connectAndJoin, startTestServer, waitFor } from "../helpers/socket-harness.js";

// Distinctive cards so a leak is unmistakable: Dana votes 8, Riley 13, Sam 21.
const CARD = { dana: "8", riley: "13", sam: "21" };

describe("vote secrecy before reveal", () => {
  let server;
  let room;
  let seats;
  let clients;
  let packets;
  let roundId;

  async function join(name, token) {
    const socket = server.connectClient({ auth: { token } });
    packets[name] = recordPackets(socket);
    const stateArrives = waitFor(socket, "room:state");
    await waitFor(socket, "connect");
    expect(await socket.emitWithAck("room:join", { code: room.code })).toEqual({ ok: true });
    await stateArrives;
    clients[name] = socket;
  }

  beforeEach(async () => {
    await resetDatabase();
    server = await startTestServer();
    room = await server.seedRoom();
    seats = {
      dana: { token: room.facilitatorToken },
      riley: await server.addParticipant(room.roomId, "Riley"),
      sam: await server.addParticipant(room.roomId, "Sam"),
      olive: await server.addParticipant(room.roomId, "Olive", "observer"),
    };
    clients = {};
    packets = {};
    for (const [name, seat] of Object.entries(seats)) {
      await join(name, seat.token);
    }

    const added = waitFor(clients.dana, "story:update");
    await clients.dana.emitWithAck("story:add", { titles: ["Login"] });
    const storyId = (await added).stories[0].id;
    const selected = waitFor(clients.dana, "story:update");
    await clients.dana.emitWithAck("story:select", { storyId });
    roundId = (await selected).round.id;
  });

  afterEach(async () => {
    await server.close();
  });

  async function voteEverywhere() {
    const acks = [
      await clients.dana.emitWithAck("vote:cast", { roundId, value: CARD.dana }),
      await clients.riley.emitWithAck("vote:cast", { roundId, value: "3" }),
      await clients.riley.emitWithAck("vote:cast", { roundId, value: CARD.riley }),
      await clients.sam.emitWithAck("vote:cast", { roundId, value: CARD.sam }),
      await clients.sam.emitWithAck("vote:clear", { roundId }),
      await clients.sam.emitWithAck("vote:cast", { roundId, value: CARD.sam }),
    ];
    for (const ack of acks) {
      expect(ack).toEqual({ ok: true });
    }
    // Let the last broadcasts arrive everywhere.
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  it("never sends any client another participant's vote", async () => {
    await voteEverywhere();

    expect(Object.keys(packets).sort()).toEqual(["dana", "olive", "riley", "sam"]);
    for (const [name, received] of Object.entries(packets)) {
      const json = JSON.stringify(received);
      for (const [voter, card] of Object.entries(CARD)) {
        if (voter !== name) {
          expect(json, `${name} received ${voter}'s vote`).not.toContain(`"${card}"`);
        }
      }
      expect(findKeyDeep(received, "value"), `${name} received a value field`).toEqual([]);
      expect(findKeyDeep(received, "votes"), `${name} received a votes field`).toEqual([]);
    }
  });

  it("only ever announces who has voted", async () => {
    await voteEverywhere();

    const statuses = packets.olive.filter((packet) => packet.event === "vote:status");
    expect(statuses.length).toBeGreaterThan(0);
    for (const { args } of statuses) {
      expect(Object.keys(args[0]).sort()).toEqual(["roundId", "votedIds"]);
    }
  });

  it("gives a reconnecting voter their own vote and nobody else's", async () => {
    await voteEverywhere();
    const closed = waitFor(clients.riley, "disconnect");
    clients.riley.disconnect();
    await closed;

    const { state } = await connectAndJoin(server, { token: seats.riley.token, code: room.code });

    expect(state.me.myVote).toBe(CARD.riley);
    const json = JSON.stringify(state);
    expect(json).not.toContain(`"${CARD.dana}"`);
    expect(json).not.toContain(`"${CARD.sam}"`);
    expect(state.round).toEqual({ id: roundId, number: 1, revealed: false });
  });

  it("acks failed votes without echoing any value", async () => {
    const ack = await clients.olive.emitWithAck("vote:cast", { roundId, value: CARD.sam });
    expect(ack.ok).toBe(false);
    expect(JSON.stringify(ack)).not.toContain(`"${CARD.sam}"`);
  });
});
