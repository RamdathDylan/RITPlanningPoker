import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderRoomPage } from "../../test/room-page.jsx";

describe("leaving a room", () => {
  it("asks for confirmation before leaving", async () => {
    const page = renderRoomPage();
    await page.joinWith();

    await page.user.click(screen.getByRole("button", { name: "Leave room" }));

    expect(
      screen.getByText("Leave this room? Your seat and any vote will be removed."),
    ).toBeTruthy();
    expect(page.socket.emitted.some((emit) => emit.event === "room:leave")).toBe(false);
  });

  it("stays when the person changes their mind, returning focus to the Leave button", async () => {
    const page = renderRoomPage();
    await page.joinWith();
    await page.user.click(screen.getByRole("button", { name: "Leave room" }));

    await page.user.click(screen.getByRole("button", { name: "Stay" }));

    expect(screen.queryByText(/Leave this room\?/)).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Leave room" }));
  });

  it("moves focus to the confirmation so keyboard users land on it", async () => {
    const page = renderRoomPage();
    await page.joinWith();

    await page.user.click(screen.getByRole("button", { name: "Leave room" }));

    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Stay" }));
  });

  it("leaves: tells the server, forgets the seat, and says so", async () => {
    const page = renderRoomPage();
    await page.joinWith();
    await page.user.click(screen.getByRole("button", { name: "Leave room" }));

    await page.user.click(screen.getByRole("button", { name: "Leave" }));

    expect(page.socket.emitted.at(-1)).toEqual({ event: "room:leave", payload: {} });
    expect(page.sessions.load("ABCDEFGH")).toBeNull();
    expect(screen.getByRole("heading", { level: 1, name: "You left the room" })).toBeTruthy();
  });
});
