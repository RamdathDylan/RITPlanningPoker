import { describe, expect, it } from "vitest";
import {
  CLIENT_EVENTS,
  FIBONACCI_DECK,
  LIMITS,
  NUMERIC_CARDS,
  ROLES,
  ROOM_STATUSES,
  SERVER_EVENTS,
} from "./events.js";

describe("event names", () => {
  it("lists every client-to-server event from the contract", () => {
    expect(Object.values(CLIENT_EVENTS)).toEqual([
      "room:join",
      "room:leave",
      "story:add",
      "story:select",
      "vote:cast",
      "vote:clear",
      "round:reveal",
      "round:revote",
      "estimate:accept",
      "participant:remove",
      "participant:setRole",
      "facilitator:transfer",
      "room:end",
      "room:delete",
    ]);
  });

  it("lists every server-to-client event from the contract", () => {
    expect(Object.values(SERVER_EVENTS)).toEqual([
      "room:state",
      "participant:update",
      "vote:status",
      "round:revealed",
      "story:update",
      "room:ended",
      "room:removed",
      "error",
    ]);
  });

  it("never reuses a name across directions", () => {
    const all = [...Object.values(CLIENT_EVENTS), ...Object.values(SERVER_EVENTS)];
    expect(new Set(all).size).toBe(all.length);
  });

  it("cannot be changed at runtime", () => {
    expect(Object.isFrozen(CLIENT_EVENTS)).toBe(true);
    expect(Object.isFrozen(SERVER_EVENTS)).toBe(true);
  });
});

describe("limits", () => {
  it("match the caps in CLAUDE.md", () => {
    expect(LIMITS).toEqual({
      displayNameMax: 40,
      roomNameMax: 60,
      storyTitleMax: 200,
      participantsPerRoom: 50,
      storiesPerRoom: 200,
      storiesPerAdd: 50,
      socketsPerParticipant: 10,
    });
    expect(Object.isFrozen(LIMITS)).toBe(true);
  });
});

describe("deck and enums", () => {
  it("uses the Fibonacci deck with unsure and break cards", () => {
    expect(FIBONACCI_DECK).toEqual(["0", "1", "2", "3", "5", "8", "13", "21", "?", "☕"]);
  });

  it("treats only number cards as acceptable final estimates", () => {
    expect(NUMERIC_CARDS).toEqual(["0", "1", "2", "3", "5", "8", "13", "21"]);
  });

  it("defines the participant roles and room statuses from the schema", () => {
    expect(ROLES).toEqual(["voter", "observer"]);
    expect(ROOM_STATUSES).toEqual(["idle", "voting", "revealed", "ended"]);
  });

  it("freezes every list", () => {
    for (const list of [FIBONACCI_DECK, NUMERIC_CARDS, ROLES, ROOM_STATUSES]) {
      expect(Object.isFrozen(list)).toBe(true);
    }
  });
});
