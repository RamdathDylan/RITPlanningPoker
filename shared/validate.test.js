import { describe, expect, it } from "vitest";
import { arrayOf, object, oneOf, string, uuid } from "./validate.js";

const VALID_UUID = "3f2b8c1e-9d4a-4f6b-8a2c-1e5d7f9b0a3c";

describe("string", () => {
  const name = string({ min: 1, max: 5 });

  it("returns the normalized text", () => {
    expect(name("  Al   ex ")).toEqual({ ok: true, value: "Al ex" });
  });

  it.each([42, null, undefined, ["a"], { a: 1 }])("rejects the non-string %j", (value) => {
    expect(name(value)).toMatchObject({ ok: false, reason: "must be text" });
  });

  it("rejects text that is empty after trimming", () => {
    expect(name("   ")).toMatchObject({ ok: false, reason: "must be 1 to 5 characters" });
  });

  it("counts length after normalization, in characters not UTF-16 units", () => {
    expect(name("🚀🚀🚀🚀🚀")).toEqual({ ok: true, value: "🚀🚀🚀🚀🚀" });
    expect(name("🚀🚀🚀🚀🚀🚀")).toMatchObject({ ok: false });
  });

  it("rejects forbidden characters", () => {
    expect(name("A‮b")).toMatchObject({ ok: false, reason: "contains unsupported characters" });
  });
});

describe("uuid", () => {
  it("accepts a UUID and lowercases it", () => {
    expect(uuid()(VALID_UUID.toUpperCase())).toEqual({ ok: true, value: VALID_UUID });
  });

  it.each(["not-a-uuid", `${VALID_UUID}x`, "", 123, null])("rejects %j", (value) => {
    expect(uuid()(value)).toMatchObject({ ok: false, reason: "must be an id" });
  });
});

describe("oneOf", () => {
  const card = oneOf(["1", "2", "?"]);

  it("accepts a listed value", () => {
    expect(card("?")).toEqual({ ok: true, value: "?" });
  });

  it.each(["4", 1, null, "1 "])("rejects %j, including look-alike types", (value) => {
    expect(card(value)).toMatchObject({ ok: false, reason: "is not an allowed value" });
  });
});

describe("arrayOf", () => {
  const titles = arrayOf(string({ min: 1, max: 10 }), { min: 1, max: 3 });

  it("validates and normalizes every item", () => {
    expect(titles([" a ", "b"])).toEqual({ ok: true, value: ["a", "b"] });
  });

  it("rejects non-arrays", () => {
    expect(titles("a")).toMatchObject({ ok: false, reason: "must be a list" });
  });

  it.each([[[]], [["a", "b", "c", "d"]]])(
    "rejects a list with the wrong number of items",
    (list) => {
      expect(titles(list)).toMatchObject({ ok: false, reason: "must have 1 to 3 items" });
    },
  );

  it("reports which item failed", () => {
    expect(titles(["ok", "this is far too long"])).toMatchObject({ ok: false, path: "[1]" });
  });
});

describe("object", () => {
  const vote = object({ roundId: uuid(), value: oneOf(["1", "2"]) });

  it("accepts exactly the listed keys and returns validated values", () => {
    expect(vote({ roundId: VALID_UUID, value: "2" })).toEqual({
      ok: true,
      value: { roundId: VALID_UUID, value: "2" },
    });
  });

  it("rejects a missing key", () => {
    expect(vote({ roundId: VALID_UUID })).toMatchObject({ ok: false, path: "value" });
  });

  it("rejects an extra key", () => {
    expect(vote({ roundId: VALID_UUID, value: "2", admin: true })).toMatchObject({
      ok: false,
      path: "admin",
      reason: "is not allowed",
    });
  });

  it.each([
    ["an array", []],
    ["null", null],
    ["a string", "hello"],
    ["a Date", new Date()],
    ["an object with a custom prototype", Object.create({ inherited: true })],
  ])("rejects %s", (_label, value) => {
    expect(vote(value)).toMatchObject({ ok: false, reason: "must be an object" });
  });

  it.each(["__proto__", "constructor", "prototype"])(
    "rejects a payload that carries a %s key",
    (key) => {
      const payload = JSON.parse(`{"roundId":"${VALID_UUID}","value":"2","${key}":{"x":1}}`);
      expect(vote(payload)).toMatchObject({ ok: false, path: key });
    },
  );

  it("prefixes nested failure paths", () => {
    const outer = object({ inner: vote });
    expect(outer({ inner: { roundId: "nope", value: "2" } })).toMatchObject({
      ok: false,
      path: "inner.roundId",
    });
  });

  it("returns a new object, not the caller's", () => {
    const payload = { roundId: VALID_UUID, value: "1" };
    expect(vote(payload).value).not.toBe(payload);
  });
});
