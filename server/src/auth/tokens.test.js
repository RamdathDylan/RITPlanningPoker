import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { generateRejoinToken, hashToken, isWellFormedToken } from "./tokens.js";

describe("generateRejoinToken", () => {
  it("encodes 32 random bytes as URL-safe base64 without padding", () => {
    const bytes = Buffer.from(Array.from({ length: 32 }, (_, index) => index * 8));
    const requested = [];
    const token = generateRejoinToken((size) => {
      requested.push(size);
      return bytes;
    });

    expect(requested).toEqual([32]);
    expect(token).toBe(bytes.toString("base64url"));
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("produces a different token every time when using crypto", () => {
    const tokens = new Set(Array.from({ length: 200 }, () => generateRejoinToken()));
    expect(tokens.size).toBe(200);
  });
});

describe("hashToken", () => {
  it("returns the 32-byte SHA-256 digest stored in the database", () => {
    const token = generateRejoinToken();
    const expected = createHash("sha256").update(token).digest();

    expect(hashToken(token)).toEqual(expected);
    expect(hashToken(token)).toHaveLength(32);
  });

  it("gives different hashes for different tokens", () => {
    expect(hashToken(generateRejoinToken())).not.toEqual(hashToken(generateRejoinToken()));
  });
});

describe("isWellFormedToken", () => {
  it("accepts a generated token", () => {
    expect(isWellFormedToken(generateRejoinToken())).toBe(true);
  });

  it.each([
    ["too short", "a".repeat(42)],
    ["too long", "a".repeat(44)],
    ["padded", `${"a".repeat(42)}=`],
    ["standard base64 characters", `${"a".repeat(41)}+/`],
    ["not a string", 12345],
    ["missing", undefined],
  ])("rejects a token that is %s", (_label, token) => {
    expect(isWellFormedToken(token)).toBe(false);
  });
});
