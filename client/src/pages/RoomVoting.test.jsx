import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderRoomPage, snapshot } from "../../test/room-page.jsx";

const story = {
  id: "s1",
  title: "Login page",
  position: 0,
  status: "pending",
  finalEstimate: null,
};

function votingSnapshot(meOverrides = {}) {
  const base = snapshot();
  return snapshot({
    room: { ...base.room, status: "voting", currentStoryId: "s1" },
    stories: [story],
    round: { id: "r1", number: 1, revealed: false },
    me: { ...base.me, ...meOverrides },
  });
}

const announcer = () => screen.getByTestId("announcer");

describe("voting in the room", () => {
  it("shows the current story and the deck to a voter", async () => {
    const page = renderRoomPage();
    await page.joinWith(votingSnapshot());

    expect(screen.getByRole("heading", { level: 2, name: "Login page" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Your estimate" })).toBeTruthy();
  });

  it("casts a vote, marks the card selected, and announces it", async () => {
    const page = renderRoomPage();
    await page.joinWith(votingSnapshot());

    await page.user.click(screen.getByRole("button", { name: "5 points" }));

    expect(page.socket.emitted.at(-1)).toEqual({
      event: "vote:cast",
      payload: { roundId: "r1", value: "5" },
    });
    expect(screen.getByRole("button", { name: "5 points" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(announcer().textContent).toBe("You voted 5");
  });

  it("clears the vote when the selected card is pressed again", async () => {
    const page = renderRoomPage();
    await page.joinWith(votingSnapshot({ myVote: "5" }));

    await page.user.click(screen.getByRole("button", { name: "5 points" }));

    expect(page.socket.emitted.at(-1)).toEqual({ event: "vote:clear", payload: { roundId: "r1" } });
    expect(announcer().textContent).toBe("Vote cleared");
  });

  it("shows why a vote was refused", async () => {
    const error = { code: "STALE_ROUND", message: "That round has already changed." };
    const page = renderRoomPage({
      respond: (event) => (event === "vote:cast" ? { ok: false, error } : { ok: true }),
    });
    await page.joinWith(votingSnapshot());

    await page.user.click(screen.getByRole("button", { name: "8 points" }));

    expect(screen.getByRole("alert").textContent).toBe(error.message);
  });

  it("announces voting progress after a short pause", async () => {
    const page = renderRoomPage();
    await page.joinWith(votingSnapshot());

    await page.serverSends("vote:status", { roundId: "r1", votedIds: ["dana"] });

    expect(await screen.findByText("1 of 2 voters have voted", {}, { timeout: 2000 })).toBe(
      announcer(),
    );
  });

  it("tells an observer they are watching instead of showing cards", async () => {
    const page = renderRoomPage();
    await page.joinWith(votingSnapshot({ role: "observer" }));

    expect(screen.getByText("You're observing this round.")).toBeTruthy();
    expect(screen.queryByRole("group", { name: "Your estimate" })).toBeNull();
  });

  it("asks everyone to wait before a story is picked", async () => {
    const page = renderRoomPage();
    await page.joinWith();

    expect(screen.getByText("Waiting for the facilitator to pick a story.")).toBeTruthy();
  });

  it("disables the cards while reconnecting", async () => {
    const page = renderRoomPage();
    await page.joinWith(votingSnapshot());

    await page.serverSends("disconnect", "transport close");

    expect(screen.getByRole("button", { name: "5 points" }).disabled).toBe(true);
  });
});
