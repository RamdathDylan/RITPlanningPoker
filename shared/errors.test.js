import { describe, expect, it } from "vitest";
import { ERROR_CODES, ERROR_MESSAGES, errorFor } from "./errors.js";

const expectedCodes = [
  "INVALID_PAYLOAD",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "INVALID_STATE",
  "NOT_FOUND",
  "ROOM_FULL",
  "NAME_TAKEN",
  "STORY_LIMIT",
  "STALE_ROUND",
  "NO_VOTE",
  "NO_VOTES",
  "INVALID_TARGET",
  "RATE_LIMITED",
  "CAPACITY",
  "INTERNAL",
];

describe("error codes", () => {
  it("cover every rejection named in the architecture", () => {
    expect(Object.values(ERROR_CODES)).toEqual(expectedCodes);
    expect(Object.isFrozen(ERROR_CODES)).toBe(true);
    expect(Object.isFrozen(ERROR_MESSAGES)).toBe(true);
  });

  it.each(expectedCodes)("%s has a fixed, human-readable message", (code) => {
    const message = ERROR_MESSAGES[code];
    expect(typeof message).toBe("string");
    expect(message.length).toBeGreaterThan(0);
    expect(message).not.toMatch(/\$\{|%s|\{\w*\}/);
  });
});

describe("errorFor", () => {
  it("returns the code and its constant message", () => {
    expect(errorFor("ROOM_FULL")).toEqual({
      code: "ROOM_FULL",
      message: ERROR_MESSAGES.ROOM_FULL,
    });
  });

  it.each(["SOMETHING_ELSE", undefined, "__proto__"])(
    "maps the unknown code %j to the generic internal error",
    (code) => {
      expect(errorFor(code)).toEqual({ code: "INTERNAL", message: "Something went wrong" });
    },
  );
});
