import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderRoomPage, snapshot } from "../../test/room-page.jsx";

function asFacilitator(overrides = {}) {
  const base = snapshot();
  return snapshot({ me: { ...base.me, participantId: "dana", isFacilitator: true }, ...overrides });
}

const confirmButton = () => screen.getByRole("button", { name: "Delete permanently" });

describe("deleting a room", () => {
  it("is only offered to the facilitator", async () => {
    const page = renderRoomPage();
    await page.joinWith();
    expect(screen.queryByRole("button", { name: "Delete room" })).toBeNull();
  });

  it("explains what will be lost and asks for the room code, focusing the field", async () => {
    const page = renderRoomPage();
    await page.joinWith(asFacilitator());

    await page.user.click(screen.getByRole("button", { name: "Delete room" }));

    expect(
      screen.getByText(
        "This permanently deletes the room, its stories, and its votes for everyone. Type the room code to confirm.",
      ),
    ).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByLabelText("Room code to confirm"));
    expect(confirmButton().disabled).toBe(true);
  });

  it("keeps the delete button disabled until the code matches", async () => {
    const page = renderRoomPage();
    await page.joinWith(asFacilitator());
    await page.user.click(screen.getByRole("button", { name: "Delete room" }));

    await page.user.type(screen.getByLabelText("Room code to confirm"), "ABCD-EFGX");
    expect(confirmButton().disabled).toBe(true);

    await page.user.clear(screen.getByLabelText("Room code to confirm"));
    await page.user.type(screen.getByLabelText("Room code to confirm"), "abcd-efgh");
    expect(confirmButton().disabled).toBe(false);
  });

  it("deletes the room once confirmed", async () => {
    const page = renderRoomPage();
    await page.joinWith(asFacilitator());
    await page.user.click(screen.getByRole("button", { name: "Delete room" }));
    await page.user.type(screen.getByLabelText("Room code to confirm"), "ABCDEFGH");

    await page.user.click(confirmButton());

    expect(page.socket.emitted.at(-1)).toEqual({
      event: "room:delete",
      payload: { code: "ABCDEFGH" },
    });
    await page.serverSends("room:removed", { reason: "deleted" });
    expect(screen.getByRole("heading", { level: 1, name: "This room was deleted" })).toBeTruthy();
  });

  it("can be cancelled, returning focus to the Delete room button", async () => {
    const page = renderRoomPage();
    await page.joinWith(asFacilitator());
    await page.user.click(screen.getByRole("button", { name: "Delete room" }));

    await page.user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByLabelText("Room code to confirm")).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Delete room" }));
  });

  it("is available after the session has ended", async () => {
    const page = renderRoomPage();
    await page.joinWith(asFacilitator({ room: { ...snapshot().room, status: "ended" } }));
    expect(screen.getByRole("button", { name: "Delete room" })).toBeTruthy();
  });
});
