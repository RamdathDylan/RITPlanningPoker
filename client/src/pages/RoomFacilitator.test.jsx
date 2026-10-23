import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderRoomPage, snapshot } from "../../test/room-page.jsx";

const stories = [
  { id: "s1", title: "Login", position: 0, status: "estimated", finalEstimate: "5" },
  { id: "s2", title: "Signup", position: 1, status: "pending", finalEstimate: null },
  { id: "s3", title: "Reset", position: 2, status: "pending", finalEstimate: null },
];

function asFacilitator(overrides = {}) {
  const base = snapshot();
  return snapshot({
    stories,
    me: { ...base.me, participantId: "dana", isFacilitator: true },
    ...overrides,
  });
}

const voting = (overrides) =>
  asFacilitator({
    room: { ...snapshot().room, status: "voting", currentStoryId: "s2" },
    round: { id: "r1", number: 1, revealed: false },
    ...overrides,
  });

const controls = () => screen.queryByRole("region", { name: "Facilitator controls" });

describe("facilitator controls", () => {
  it("are hidden from everyone else", async () => {
    const page = renderRoomPage();
    await page.joinWith();
    expect(controls()).toBeNull();
  });

  it("only allow revealing once someone has voted", async () => {
    const page = renderRoomPage();
    await page.joinWith(voting());
    expect(screen.getByRole("button", { name: "Reveal votes" }).disabled).toBe(true);

    await page.serverSends("vote:status", { roundId: "r1", votedIds: ["riley"] });
    await page.user.click(screen.getByRole("button", { name: "Reveal votes" }));

    expect(page.socket.emitted.at(-1)).toEqual({
      event: "round:reveal",
      payload: { roundId: "r1" },
    });
  });

  it("offer a revote after the reveal", async () => {
    const page = renderRoomPage();
    await page.joinWith(
      voting({
        room: { ...snapshot().room, status: "revealed", currentStoryId: "s2" },
        round: { id: "r1", number: 1, revealed: true, votes: [], stats: {} },
      }),
    );

    await page.user.click(screen.getByRole("button", { name: "Vote again" }));

    expect(page.socket.emitted.at(-1)).toEqual({
      event: "round:revote",
      payload: { roundId: "r1" },
    });
  });

  it("start the next pending story when idle", async () => {
    const page = renderRoomPage();
    await page.joinWith(asFacilitator());

    await page.user.click(screen.getByRole("button", { name: "Next story" }));

    expect(page.socket.emitted.at(-1)).toEqual({
      event: "story:select",
      payload: { storyId: "s2" },
    });
  });

  it("offer no next story when everything is estimated", async () => {
    const page = renderRoomPage();
    await page.joinWith(asFacilitator({ stories: [stories[0]] }));
    expect(screen.queryByRole("button", { name: "Next story" })).toBeNull();
  });

  it("are disabled while reconnecting", async () => {
    const page = renderRoomPage();
    await page.joinWith(asFacilitator());
    await page.serverSends("disconnect", "transport close");
    expect(screen.getByRole("button", { name: "Next story" }).disabled).toBe(true);
  });

  it("show why an action was refused", async () => {
    const error = { code: "FORBIDDEN", message: "You don't have permission to do that." };
    const page = renderRoomPage({
      respond: (event) => (event === "story:select" ? { ok: false, error } : { ok: true }),
    });
    await page.joinWith(asFacilitator());

    await page.user.click(screen.getByRole("button", { name: "Next story" }));

    expect(screen.getByRole("alert").textContent).toBe(error.message);
  });
});
