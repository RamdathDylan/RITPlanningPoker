import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderRoomPage, snapshot } from "../../test/room-page.jsx";

const story = {
  id: "s1",
  title: "Login page",
  position: 0,
  status: "pending",
  finalEstimate: null,
};

function votingAs(meOverrides = {}) {
  const base = snapshot();
  return snapshot({
    room: { ...base.room, status: "voting", currentStoryId: "s1" },
    stories: [story],
    round: { id: "r1", number: 1, revealed: false },
    me: { ...base.me, ...meOverrides },
  });
}

const numericReveal = {
  roundId: "r1",
  votes: [
    { participantId: "dana", value: "3" },
    { participantId: "riley", value: "8" },
  ],
  stats: {
    count: 2,
    numericCount: 2,
    min: 3,
    max: 8,
    mean: 5.5,
    median: 5.5,
    suggestion: "8",
    consensus: false,
    unsureCount: 0,
    breakCount: 0,
    distribution: { 3: 1, 8: 1 },
  },
};

async function revealed(meOverrides, reveal = numericReveal) {
  const page = renderRoomPage();
  await page.joinWith(votingAs(meOverrides));
  await page.serverSends("round:revealed", reveal);
  return page;
}

const asFacilitator = { participantId: "dana", isFacilitator: true };

describe("reveal view", () => {
  it("shows every vote next to the voter's name", async () => {
    await revealed();

    const votes = within(screen.getByRole("list", { name: "Votes" })).getAllByRole("listitem");
    expect(votes.map((item) => item.textContent)).toEqual(["Dana3", "Riley8"]);
  });

  it("states the results in words", async () => {
    await revealed();
    expect(screen.getByText("Average 5.5 · Median 5.5 · Range 3 to 8")).toBeTruthy();
    expect(screen.getByText("Votes differ.")).toBeTruthy();
  });

  it("announces the reveal to screen readers", async () => {
    await revealed();
    expect(screen.getByTestId("announcer").textContent).toBe(
      "Votes revealed. Average 5.5, median 5.5, range 3 to 8.",
    );
  });

  it("announces the reveal once, not again on later room updates", async () => {
    const page = await revealed();
    const announcements = [];
    const observer = new MutationObserver(() =>
      announcements.push(screen.getByTestId("announcer").textContent),
    );
    observer.observe(screen.getByTestId("announcer"), {
      childList: true,
      characterData: true,
      subtree: true,
    });

    await page.serverSends("participant:update", {
      participants: snapshot().participants.map((participant) => ({
        ...participant,
        connected: false,
      })),
      facilitatorId: "dana",
    });
    observer.disconnect();

    expect(announcements).toEqual([]);
  });

  it("hides the cards once votes are revealed", async () => {
    await revealed();
    expect(screen.queryByRole("group", { name: "Your estimate" })).toBeNull();
  });

  it("lets the facilitator accept the suggested estimate", async () => {
    const page = await revealed(asFacilitator);

    expect(screen.getByLabelText("Final estimate").value).toBe("8");
    await page.user.click(screen.getByRole("button", { name: "Accept estimate" }));

    expect(page.socket.emitted.at(-1)).toEqual({
      event: "estimate:accept",
      payload: { storyId: "s1", value: "8" },
    });
  });

  it("lets the facilitator choose a different estimate", async () => {
    const page = await revealed(asFacilitator);

    await page.user.selectOptions(screen.getByLabelText("Final estimate"), "5");
    await page.user.click(screen.getByRole("button", { name: "Accept estimate" }));

    expect(page.socket.emitted.at(-1).payload).toEqual({ storyId: "s1", value: "5" });
  });

  it("doesn't offer accepting to anyone else", async () => {
    await revealed();
    expect(screen.queryByLabelText("Final estimate")).toBeNull();
  });

  it("handles a round where nobody picked a number", async () => {
    const reveal = {
      roundId: "r1",
      votes: [{ participantId: "riley", value: "?" }],
      stats: {
        ...numericReveal.stats,
        numericCount: 0,
        min: null,
        max: null,
        mean: null,
        median: null,
        suggestion: null,
        unsureCount: 1,
      },
    };
    const page = await revealed(asFacilitator, reveal);

    expect(screen.getByText("No numeric votes.")).toBeTruthy();
    expect(screen.getByText("1 unsure")).toBeTruthy();
    expect(screen.getByLabelText("Final estimate").value).toBe("");
    expect(screen.getByRole("button", { name: "Accept estimate" }).disabled).toBe(true);

    await page.user.selectOptions(screen.getByLabelText("Final estimate"), "3");
    expect(screen.getByRole("button", { name: "Accept estimate" }).disabled).toBe(false);
  });
});
