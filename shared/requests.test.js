import { describe, expect, it } from "vitest";
import { CREATE_ROOM_BODY, JOIN_ROOM_BODY } from "./requests.js";

describe("CREATE_ROOM_BODY", () => {
  it("accepts and normalizes a room name and display name", () => {
    expect(CREATE_ROOM_BODY({ roomName: "  Sprint   12 ", displayName: " Dana " })).toEqual({
      ok: true,
      value: { roomName: "Sprint 12", displayName: "Dana" },
    });
  });

  it.each([
    [{ roomName: "x".repeat(61), displayName: "Dana" }, "roomName"],
    [{ roomName: "Sprint", displayName: "x".repeat(41) }, "displayName"],
    [{ roomName: "Sprint", displayName: "Dana", admin: true }, "admin"],
    [{ roomName: "Sprint" }, "displayName"],
  ])("rejects %j at %s", (body, path) => {
    expect(CREATE_ROOM_BODY(body)).toMatchObject({ ok: false, path });
  });
});

describe("JOIN_ROOM_BODY", () => {
  it("accepts a display name and a role", () => {
    expect(JOIN_ROOM_BODY({ displayName: "Riley", role: "observer" })).toMatchObject({ ok: true });
  });

  it("rejects the facilitator role", () => {
    expect(JOIN_ROOM_BODY({ displayName: "Riley", role: "facilitator" })).toMatchObject({
      ok: false,
      path: "role",
    });
  });
});
