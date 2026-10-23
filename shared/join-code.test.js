import { describe, expect, it } from "vitest";
import { JOIN_CODE_ALPHABET, formatJoinCode, joinCode, parseJoinCode } from "./join-code.js";

describe("JOIN_CODE_ALPHABET", () => {
  it("has 31 unique symbols with no easily confused characters", () => {
    expect(JOIN_CODE_ALPHABET).toHaveLength(31);
    expect(new Set(JOIN_CODE_ALPHABET).size).toBe(31);
    for (const confusing of ["0", "O", "1", "I", "L"]) {
      expect(JOIN_CODE_ALPHABET).not.toContain(confusing);
    }
  });
});

describe("parseJoinCode", () => {
  it.each([
    ["ABCD-EFGH", "ABCDEFGH"],
    ["abcd-efgh", "ABCDEFGH"],
    ["ABCDEFGH", "ABCDEFGH"],
    [" 2345 6789 ", "23456789"],
  ])("reads %j as %j", (input, expected) => {
    expect(parseJoinCode(input)).toBe(expected);
  });

  it.each([
    "ABCD-EFG",
    "ABCD-EFGHJ",
    "ABCD-EFG0",
    "ABCD-EFGI",
    "ABCD-EFGL",
    "ABCD-EFGO",
    "",
    12345678,
    null,
  ])("rejects %j", (input) => {
    expect(parseJoinCode(input)).toBeNull();
  });
});

describe("formatJoinCode", () => {
  it("adds a dash in the middle for readability", () => {
    expect(formatJoinCode("ABCDEFGH")).toBe("ABCD-EFGH");
  });
});

describe("joinCode validator", () => {
  it("returns the canonical code", () => {
    expect(joinCode()("abcd-efgh")).toEqual({ ok: true, value: "ABCDEFGH" });
  });

  it("rejects invalid codes", () => {
    expect(joinCode()("nope")).toMatchObject({ ok: false, reason: "must be a room code" });
  });
});
