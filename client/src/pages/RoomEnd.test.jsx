import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderRoomPage, snapshot } from "../../test/room-page.jsx";

const stories = [
  { id: "s1", title: "Login", position: 0, status: "estimated", finalEstimate: "5" },
  { id: "s2", title: "Signup", position: 1, status: "pending", finalEstimate: null },
];

function asFacilitator(overrides = {}) {
  const base = snapshot();
  return snapshot({
    stories,
    me: { ...base.me, participantId: "dana", isFacilitator: true },
    ...overrides,
  });
}

const ended = (overrides) =>
  snapshot({ stories, room: { ...snapshot().room, status: "ended" }, ...overrides });

describe("ending a session", () => {
  it("asks the facilitator to confirm, with focus on Keep going", async () => {
    const page = renderRoomPage();
    await page.joinWith(asFacilitator());

    await page.user.click(screen.getByRole("button", { name: "End session" }));

    expect(
      screen.getByText(
        "End the session for everyone? Voting stops and the room becomes read-only.",
      ),
    ).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Keep going" }));
    expect(page.socket.emitted.some((emit) => emit.event === "room:end")).toBe(false);
  });

  it("ends the session once confirmed", async () => {
    const page = renderRoomPage();
    await page.joinWith(asFacilitator());
    await page.user.click(screen.getByRole("button", { name: "End session" }));

    await page.user.click(screen.getByRole("button", { name: "Confirm end session" }));

    expect(page.socket.emitted.at(-1)).toEqual({ event: "room:end", payload: {} });
  });

  it("isn't offered to other participants", async () => {
    const page = renderRoomPage();
    await page.joinWith(snapshot({ stories }));
    expect(screen.queryByRole("button", { name: "End session" })).toBeNull();
  });

  it("shows everyone a summary of the estimates", async () => {
    const page = renderRoomPage();
    await page.joinWith(ended());

    const table = screen.getByRole("table", { name: "Estimates" });
    const rows = within(table)
      .getAllByRole("row")
      .map((row) => row.textContent);
    expect(rows).toEqual(["StoryEstimate", "Login5", "SignupNot estimated"]);
  });

  it("switches to the summary as soon as the facilitator ends the session", async () => {
    const page = renderRoomPage();
    await page.joinWith(snapshot({ stories }));

    await page.serverSends("room:ended", {});

    expect(screen.getByRole("heading", { level: 2, name: "This session has ended" })).toBeTruthy();
    expect(screen.getByRole("table", { name: "Estimates" })).toBeTruthy();
  });

  it("removes every voting and editing control afterwards", async () => {
    const page = renderRoomPage();
    await page.joinWith(
      ended({ me: { ...snapshot().me, participantId: "dana", isFacilitator: true } }),
    );

    expect(screen.queryByRole("group", { name: "Your estimate" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Facilitator controls" })).toBeNull();
    expect(screen.queryByLabelText("Add stories")).toBeNull();
    expect(screen.queryByRole("button", { name: /^Vote on / })).toBeNull();
  });

  it("says when no stories were estimated", async () => {
    const page = renderRoomPage();
    await page.joinWith(ended({ stories: [] }));
    expect(screen.getByText("No stories were added in this session.")).toBeTruthy();
  });
});
