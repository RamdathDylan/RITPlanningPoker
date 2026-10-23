import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderRoomPage, snapshot } from "../../test/room-page.jsx";

describe("RoomPage states", () => {
  it("sends people without a seat to the join page", () => {
    renderRoomPage({ seated: false });
    expect(screen.getByTestId("path").textContent).toBe("/join/ABCDEFGH");
  });

  it("shows a loading message while joining", () => {
    renderRoomPage();
    expect(screen.getByRole("status").textContent).toBe("Joining the room…");
  });

  it("shows the room name and code once joined", async () => {
    const page = renderRoomPage();
    await page.joinWith();

    expect(screen.getByRole("heading", { level: 1, name: "Sprint 12" })).toBeTruthy();
    expect(screen.getByText("ABCD-EFGH")).toBeTruthy();
  });

  it("lists the participants once joined", async () => {
    const page = renderRoomPage();
    await page.joinWith();

    expect(screen.getByRole("heading", { level: 2, name: "Participants (2)" })).toBeTruthy();
  });

  it("warns and disables actions while reconnecting", async () => {
    const page = renderRoomPage();
    await page.joinWith();

    await page.serverSends("disconnect", "transport close");

    expect(screen.getByRole("alert").textContent).toBe("Connection lost. Reconnecting…");
    expect(screen.getByRole("main").getAttribute("aria-busy")).toBe("true");
  });

  it("explains an invalid seat and offers to join again", async () => {
    const page = renderRoomPage();
    await page.serverSends("connect_error", new Error("Unauthorized"));

    expect(
      screen.getByRole("heading", { level: 1, name: "Your seat isn't valid anymore" }),
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "Join again" }).getAttribute("href")).toBe(
      "/join/ABCDEFGH",
    );
  });

  it.each([
    ["kicked", "You were removed from this room"],
    ["deleted", "This room was deleted"],
  ])("explains removal (%s)", async (reason, heading) => {
    const page = renderRoomPage();
    await page.joinWith();

    await page.serverSends("room:removed", { reason });

    expect(screen.getByRole("heading", { level: 1, name: heading })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Go to the home page" }).getAttribute("href")).toBe(
      "/",
    );
  });

  it("explains a failed join", async () => {
    const error = { code: "FORBIDDEN", message: "You don't have permission to do that." };
    const page = renderRoomPage({ respond: () => ({ ok: false, error }) });

    await page.serverSends("connect");

    expect(screen.getByRole("heading", { level: 1, name: "Couldn't open this room" })).toBeTruthy();
    expect(screen.getByText(error.message)).toBeTruthy();
  });

  it("shows that the session has ended", async () => {
    const page = renderRoomPage();
    await page.joinWith(snapshot({ room: { ...snapshot().room, status: "ended" } }));

    expect(screen.getByRole("heading", { level: 2, name: "This session has ended" })).toBeTruthy();
  });
});
