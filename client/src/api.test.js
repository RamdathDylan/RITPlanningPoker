import { describe, expect, it } from "vitest";
import { ApiError, createApi } from "./api.js";

// A fake fetch that records requests and answers with the given status and body.
function fakeFetch(status, body) {
  const requests = [];
  const fetch = async (url, init) => {
    requests.push({ url, init });
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => {
        if (body === undefined) {
          throw new SyntaxError("Unexpected end of JSON input");
        }
        return body;
      },
    };
  };
  return { fetch, requests };
}

async function caught(promise) {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("expected the call to fail");
}

describe("createApi", () => {
  it("creates a room with a JSON POST and returns the server's answer", async () => {
    const answer = { code: "ABCDEFGH", participantId: "p-1", rejoinToken: "t".repeat(43) };
    const { fetch, requests } = fakeFetch(201, answer);

    const result = await createApi({ fetch }).createRoom({
      roomName: "Sprint 12",
      displayName: "Dana",
    });

    expect(result).toEqual(answer);
    expect(requests).toEqual([
      {
        url: "/api/rooms",
        init: {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomName: "Sprint 12", displayName: "Dana" }),
        },
      },
    ]);
  });

  it("joins a room using the canonical code in the URL", async () => {
    const { fetch, requests } = fakeFetch(201, {
      participantId: "p-2",
      rejoinToken: "x".repeat(43),
    });

    await createApi({ fetch }).joinRoom("abcd-efgh", { displayName: "Riley", role: "voter" });

    expect(requests[0].url).toBe("/api/rooms/ABCDEFGH/participants");
  });

  it("turns a server error into an ApiError with the server's code and message", async () => {
    const { fetch } = fakeFetch(409, {
      code: "NAME_TAKEN",
      error: "Someone in this room already uses that name.",
    });

    const error = await caught(
      createApi({ fetch }).joinRoom("ABCDEFGH", { displayName: "Dana", role: "voter" }),
    );

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      code: "NAME_TAKEN",
      message: "Someone in this room already uses that name.",
    });
  });

  it.each([
    [429, "RATE_LIMITED", "Too many requests. Please slow down."],
    [503, "CAPACITY", "The server is busy. Please try again later."],
    [404, "NOT_FOUND", "Room not found."],
    [500, "INTERNAL", "Something went wrong"],
  ])("explains a %i response even when its body isn't usable", async (status, code, message) => {
    const { fetch } = fakeFetch(status, undefined);

    expect(
      await caught(createApi({ fetch }).createRoom({ roomName: "x", displayName: "y" })),
    ).toMatchObject({
      code,
      message,
    });
  });

  it("explains a network failure", async () => {
    const fetch = async () => {
      throw new TypeError("Failed to fetch");
    };

    expect(
      await caught(createApi({ fetch }).createRoom({ roomName: "x", displayName: "y" })),
    ).toMatchObject({
      code: "NETWORK",
      message: "Can't reach the server. Check your connection and try again.",
    });
  });

  it("rejects an invalid code without contacting the server", async () => {
    const { fetch, requests } = fakeFetch(201, {});

    expect(
      await caught(createApi({ fetch }).joinRoom("nope", { displayName: "Riley", role: "voter" })),
    ).toMatchObject({
      code: "NOT_FOUND",
    });
    expect(requests).toEqual([]);
  });
});
