import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createFakeSessions, createFakeSocket } from "../../test/fakes.js";
import { ServicesProvider } from "../services.jsx";
import { useRoom } from "./useRoom.js";

const TOKEN = "t".repeat(43);

const snapshot = {
  room: {
    code: "ABCDEFGH",
    name: "Sprint 12",
    status: "voting",
    facilitatorId: "dana",
    currentStoryId: "s1",
  },
  participants: [
    { id: "riley", displayName: "Riley", role: "voter", connected: true, hasVoted: false },
  ],
  stories: [],
  round: { id: "r1", number: 1, revealed: false },
  me: { participantId: "riley", role: "voter", isFacilitator: false, myVote: null },
};

function setup({ seated = true, respond } = {}) {
  const sessions = createFakeSessions();
  if (seated) {
    sessions.save("ABCDEFGH", { participantId: "riley", token: TOKEN });
  }
  const socket = createFakeSocket({ respond });
  const tokensUsed = [];
  const connectSocket = (token) => {
    tokensUsed.push(token);
    return socket;
  };
  const wrapper = ({ children }) => (
    <ServicesProvider value={{ api: {}, sessions, connectSocket }}>{children}</ServicesProvider>
  );
  const hook = renderHook(() => useRoom("ABCDEFGH"), { wrapper });
  return { ...hook, socket, sessions, tokensUsed };
}

async function connected(context) {
  await act(async () => {
    context.socket.serverSends("connect");
  });
  await act(async () => {
    context.socket.serverSends("room:state", snapshot);
  });
}

describe("useRoom", () => {
  it("reports no-seat and never connects when this browser hasn't joined", () => {
    const { result, tokensUsed } = setup({ seated: false });
    expect(result.current.status).toBe("no-seat");
    expect(tokensUsed).toEqual([]);
  });

  it("connects with the stored token and joins the room", async () => {
    const context = setup();
    expect(context.tokensUsed).toEqual([TOKEN]);
    expect(context.result.current.status).toBe("connecting");

    await connected(context);

    expect(context.socket.emitted[0]).toEqual({
      event: "room:join",
      payload: { code: "ABCDEFGH" },
    });
    expect(context.result.current.status).toBe("connected");
    expect(context.result.current.room).toEqual(snapshot);
  });

  it("applies server updates to the room", async () => {
    const context = setup();
    await connected(context);

    await act(async () => {
      context.socket.serverSends("vote:status", { roundId: "r1", votedIds: ["riley"] });
    });

    expect(context.result.current.room.participants[0].hasVoted).toBe(true);
  });

  it("shows reconnecting when the connection drops, then rejoins on reconnect", async () => {
    const context = setup();
    await connected(context);

    await act(async () => {
      context.socket.serverSends("disconnect", "transport close");
    });
    expect(context.result.current.status).toBe("reconnecting");

    await connected(context);
    expect(context.result.current.status).toBe("connected");
    expect(context.socket.emitted.filter((emit) => emit.event === "room:join")).toHaveLength(2);
  });

  it("forgets the seat when the server no longer recognizes the token", async () => {
    const context = setup();

    await act(async () => {
      context.socket.serverSends("connect_error", new Error("Unauthorized"));
    });

    expect(context.result.current.status).toBe("unauthorized");
    expect(context.sessions.load("ABCDEFGH")).toBeNull();
    expect(context.socket.disconnected).toBe(true);
  });

  it("keeps trying through other connection errors", async () => {
    const context = setup();
    await act(async () => {
      context.socket.serverSends("connect_error", new Error("xhr poll error"));
    });
    expect(context.result.current.status).toBe("reconnecting");
  });

  it("reports removal and forgets the seat", async () => {
    const context = setup();
    await connected(context);

    await act(async () => {
      context.socket.serverSends("room:removed", { reason: "kicked" });
    });

    expect(context.result.current.status).toBe("removed");
    expect(context.result.current.removedReason).toBe("kicked");
    expect(context.sessions.load("ABCDEFGH")).toBeNull();
  });

  it("reports a failed join", async () => {
    const error = { code: "FORBIDDEN", message: "You don't have permission to do that." };
    const context = setup({ respond: () => ({ ok: false, error }) });

    await act(async () => {
      context.socket.serverSends("connect");
    });

    expect(context.result.current.status).toBe("failed");
    expect(context.result.current.error).toEqual(error);
  });

  it("sends actions and remembers my vote once the server accepts it", async () => {
    const context = setup();
    await connected(context);

    let ack;
    await act(async () => {
      ack = await context.result.current.send("vote:cast", { roundId: "r1", value: "8" });
    });

    expect(ack).toEqual({ ok: true });
    expect(context.result.current.room.me.myVote).toBe("8");
  });

  it("leaves my vote alone when the server refuses it", async () => {
    const error = { code: "STALE_ROUND", message: "That round has already changed." };
    const context = setup({
      respond: (event) => (event === "vote:cast" ? { ok: false, error } : { ok: true }),
    });
    await connected(context);

    let ack;
    await act(async () => {
      ack = await context.result.current.send("vote:cast", { roundId: "r1", value: "8" });
    });

    expect(ack).toEqual({ ok: false, error });
    expect(context.result.current.room.me.myVote).toBeNull();
  });

  it("leaves the room: tells the server, forgets the seat, and disconnects", async () => {
    const context = setup();
    await connected(context);

    await act(async () => {
      await context.result.current.leave();
    });

    expect(context.socket.emitted.at(-1)).toEqual({ event: "room:leave", payload: {} });
    expect(context.sessions.load("ABCDEFGH")).toBeNull();
    expect(context.socket.disconnected).toBe(true);
    expect(context.result.current.status).toBe("left");
  });

  it("disconnects when the page closes", async () => {
    const context = setup();
    context.unmount();
    await waitFor(() => expect(context.socket.disconnected).toBe(true));
  });
});
