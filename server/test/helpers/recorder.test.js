import { describe, expect, it } from "vitest";
import { findKeyDeep } from "./recorder.js";

describe("findKeyDeep", () => {
  it("finds a key at any depth inside objects and arrays", () => {
    const packet = { round: { votes: [{ participantId: "a", value: "5" }] }, value: 1 };

    expect(findKeyDeep(packet, "value")).toEqual(["$.round.votes[0].value", "$.value"]);
  });

  it("returns an empty list when the key is absent", () => {
    expect(findKeyDeep({ participants: [{ hasVoted: true }] }, "value")).toEqual([]);
  });

  it("handles primitives and null", () => {
    expect(findKeyDeep(null, "value")).toEqual([]);
    expect(findKeyDeep("value", "value")).toEqual([]);
  });
});
