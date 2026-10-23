import { describe, expect, it } from "vitest";
import { CLIENT_EVENTS, CLIENT_EVENT_SCHEMAS, validateClientEvent } from "./events.js";

const ID = "3f2b8c1e-9d4a-4f6b-8a2c-1e5d7f9b0a3c";

const validPayloads = {
  "room:join": { code: "ABCD-EFGH" },
  "room:leave": {},
  "story:add": { titles: ["Login page", "Signup page"] },
  "story:select": { storyId: ID },
  "vote:cast": { roundId: ID, value: "5" },
  "vote:clear": { roundId: ID },
  "round:reveal": { roundId: ID },
  "round:revote": { roundId: ID },
  "estimate:accept": { storyId: ID, value: "8" },
  "participant:remove": { participantId: ID },
  "participant:setRole": { role: "observer" },
  "facilitator:transfer": { participantId: ID },
  "room:end": {},
  "room:delete": { code: "ABCDEFGH" },
};

const events = Object.values(CLIENT_EVENTS);
const eventsWithKeys = events.filter((event) => Object.keys(validPayloads[event]).length > 0);

describe("client event schemas", () => {
  it("define a schema for every client event and nothing else", () => {
    expect(Object.keys(CLIENT_EVENT_SCHEMAS).sort()).toEqual([...events].sort());
    expect(Object.isFrozen(CLIENT_EVENT_SCHEMAS)).toBe(true);
  });

  it.each(events)("%s accepts a valid payload", (event) => {
    expect(validateClientEvent(event, validPayloads[event])).toMatchObject({ ok: true });
  });

  it.each(eventsWithKeys)("%s rejects a payload with a missing key", (event) => {
    const [firstKey] = Object.keys(validPayloads[event]);
    const { [firstKey]: _removed, ...missing } = validPayloads[event];
    expect(validateClientEvent(event, missing)).toMatchObject({ ok: false });
  });

  it.each(events)("%s rejects a payload with an extra key", (event) => {
    expect(validateClientEvent(event, { ...validPayloads[event], extra: 1 })).toMatchObject({
      ok: false,
    });
  });

  it.each(eventsWithKeys)("%s rejects wrong value types", (event) => {
    for (const key of Object.keys(validPayloads[event])) {
      expect(validateClientEvent(event, { ...validPayloads[event], [key]: 42 })).toMatchObject({
        ok: false,
        path: expect.stringContaining(key),
      });
    }
  });

  it.each(events)("%s rejects a __proto__ key", (event) => {
    const payload = JSON.parse(
      JSON.stringify(validPayloads[event])
        .replace(/^\{/, '{"__proto__":{"admin":true},')
        .replace(",}", "}"),
    );
    expect(validateClientEvent(event, payload)).toMatchObject({ ok: false });
  });

  it.each(events)("%s rejects a non-object payload", (event) => {
    expect(validateClientEvent(event, "hello")).toMatchObject({ ok: false });
  });

  it("rejects an unknown event name", () => {
    expect(validateClientEvent("admin:promote", {})).toMatchObject({
      ok: false,
      reason: "unknown event",
    });
  });
});

describe("specific payload rules", () => {
  it("normalizes story titles and accepts up to 50 per add", () => {
    const titles = Array.from({ length: 50 }, (_, index) => `  Story   ${index} `);
    const result = validateClientEvent("story:add", { titles });
    expect(result.ok).toBe(true);
    expect(result.value.titles[0]).toBe("Story 0");
  });

  it("rejects 51 titles in one add", () => {
    const titles = Array.from({ length: 51 }, (_, index) => `Story ${index}`);
    expect(validateClientEvent("story:add", { titles })).toMatchObject({ ok: false });
  });

  it("rejects a title over 200 characters", () => {
    expect(validateClientEvent("story:add", { titles: ["x".repeat(201)] })).toMatchObject({
      ok: false,
      path: "titles[0]",
    });
  });

  it.each(["?", "☕", "0", "21"])("accepts the card %j as a vote", (value) => {
    expect(validateClientEvent("vote:cast", { roundId: ID, value })).toMatchObject({ ok: true });
  });

  it.each(["4", "100", 5])("rejects %j as a vote", (value) => {
    expect(validateClientEvent("vote:cast", { roundId: ID, value })).toMatchObject({ ok: false });
  });

  it.each(["?", "☕"])("rejects %j as a final estimate", (value) => {
    expect(validateClientEvent("estimate:accept", { storyId: ID, value })).toMatchObject({
      ok: false,
    });
  });

  it("returns the canonical join code", () => {
    expect(validateClientEvent("room:join", { code: "abcd-efgh" }).value).toEqual({
      code: "ABCDEFGH",
    });
  });

  it.each(["admin", "facilitator"])("rejects the role %j", (role) => {
    expect(validateClientEvent("participant:setRole", { role })).toMatchObject({ ok: false });
  });
});
