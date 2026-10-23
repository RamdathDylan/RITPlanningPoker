import { beforeEach, describe, expect, it } from "vitest";
import { createSessionStore } from "./session.js";

const seat = { participantId: "p-1", token: "t".repeat(43) };

function throwingStorage() {
  const fail = () => {
    throw new DOMException("The operation is insecure.", "SecurityError");
  };
  return { getItem: fail, setItem: fail, removeItem: fail };
}

describe("createSessionStore", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("saves and loads a seat per room, by canonical code", () => {
    const sessions = createSessionStore({ storage: window.localStorage });

    expect(sessions.save("abcd-efgh", seat)).toBe(true);

    expect(sessions.load("ABCDEFGH")).toEqual(seat);
    expect(window.localStorage.getItem("pp:room:ABCDEFGH")).toBe(JSON.stringify(seat));
    expect(sessions.load("Z2345678")).toBeNull();
  });

  it("forgets a seat when the participant leaves", () => {
    const sessions = createSessionStore({ storage: window.localStorage });
    sessions.save("ABCDEFGH", seat);

    sessions.forget("ABCDEFGH");

    expect(sessions.load("ABCDEFGH")).toBeNull();
  });

  it("works without crashing when storage is blocked", () => {
    const sessions = createSessionStore({ storage: throwingStorage() });

    expect(sessions.save("ABCDEFGH", seat)).toBe(false);
    expect(sessions.load("ABCDEFGH")).toBeNull();
    expect(() => sessions.forget("ABCDEFGH")).not.toThrow();
  });

  it("works when there is no storage at all", () => {
    const sessions = createSessionStore({ storage: null });
    expect(sessions.save("ABCDEFGH", seat)).toBe(false);
    expect(sessions.load("ABCDEFGH")).toBeNull();
  });

  it.each([
    ["corrupted JSON", "{not json"],
    ["the wrong shape", JSON.stringify({ participantId: 5 })],
    ["a malformed token", JSON.stringify({ participantId: "p-1", token: "short" })],
  ])("ignores %s", (_label, stored) => {
    window.localStorage.setItem("pp:room:ABCDEFGH", stored);
    expect(createSessionStore({ storage: window.localStorage }).load("ABCDEFGH")).toBeNull();
  });

  it("ignores an invalid room code", () => {
    const sessions = createSessionStore({ storage: window.localStorage });
    expect(sessions.save("nope", seat)).toBe(false);
    expect(sessions.load("nope")).toBeNull();
  });
});
