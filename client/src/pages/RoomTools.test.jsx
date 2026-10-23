import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderRoomPage, snapshot } from "../../test/room-page.jsx";

function asFacilitator() {
  const base = snapshot();
  return snapshot({ me: { ...base.me, participantId: "dana", isFacilitator: true } });
}

describe("participant tools", () => {
  it("give the facilitator remove and transfer buttons for everyone else", async () => {
    const page = renderRoomPage();
    await page.joinWith(asFacilitator());

    expect(screen.getByRole("button", { name: "Remove Riley" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Make facilitator: Riley" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Remove Dana" })).toBeNull();
  });

  it("are not offered to other participants", async () => {
    const page = renderRoomPage();
    await page.joinWith();
    expect(screen.queryByRole("button", { name: /^Remove / })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Make facilitator/ })).toBeNull();
  });

  it("confirm before removing someone, with focus on Cancel", async () => {
    const page = renderRoomPage();
    await page.joinWith(asFacilitator());

    await page.user.click(screen.getByRole("button", { name: "Remove Riley" }));

    expect(screen.getByText("Remove Riley from the room?")).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Cancel" }));
    expect(page.socket.emitted.some((emit) => emit.event === "participant:remove")).toBe(false);

    await page.user.click(screen.getByRole("button", { name: "Confirm remove" }));
    expect(page.socket.emitted.at(-1)).toEqual({
      event: "participant:remove",
      payload: { participantId: "riley" },
    });
  });

  it("cancel a removal and return focus", async () => {
    const page = renderRoomPage();
    await page.joinWith(asFacilitator());
    await page.user.click(screen.getByRole("button", { name: "Remove Riley" }));

    await page.user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByText("Remove Riley from the room?")).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Remove Riley" }));
  });

  it("hand facilitator control to someone else", async () => {
    const page = renderRoomPage();
    await page.joinWith(asFacilitator());

    await page.user.click(screen.getByRole("button", { name: "Make facilitator: Riley" }));

    expect(page.socket.emitted.at(-1)).toEqual({
      event: "facilitator:transfer",
      payload: { participantId: "riley" },
    });
  });

  it("let anyone switch themselves between voting and observing", async () => {
    const page = renderRoomPage();
    await page.joinWith();

    await page.user.click(screen.getByRole("button", { name: "Switch to observer" }));
    expect(page.socket.emitted.at(-1)).toEqual({
      event: "participant:setRole",
      payload: { role: "observer" },
    });

    const base = snapshot();
    await page.serverSends("participant:update", {
      participants: base.participants.map((participant) =>
        participant.id === "riley" ? { ...participant, role: "observer" } : participant,
      ),
      facilitatorId: "dana",
    });
    await page.user.click(screen.getByRole("button", { name: "Switch to voter" }));
    expect(page.socket.emitted.at(-1)).toEqual({
      event: "participant:setRole",
      payload: { role: "voter" },
    });
  });

  it("are disabled while reconnecting", async () => {
    const page = renderRoomPage();
    await page.joinWith(asFacilitator());
    await page.serverSends("disconnect", "transport close");
    expect(screen.getByRole("button", { name: "Remove Riley" }).disabled).toBe(true);
  });
});
