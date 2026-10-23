import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderRoomPage, snapshot } from "../../test/room-page.jsx";

const stories = [
  { id: "s1", title: "Login", position: 0, status: "estimated", finalEstimate: "5" },
  { id: "s2", title: "Signup", position: 1, status: "pending", finalEstimate: null },
  { id: "s3", title: "Reset password", position: 2, status: "pending", finalEstimate: null },
];

function facilitatorView(overrides = {}) {
  const base = snapshot();
  return snapshot({
    stories,
    me: { ...base.me, participantId: "dana", isFacilitator: true },
    ...overrides,
  });
}

const backlog = () => screen.getByRole("region", { name: /Stories/ });
const storyInput = () => screen.getByLabelText("Add stories");

describe("backlog panel", () => {
  it("lists stories with their status in words", async () => {
    const page = renderRoomPage();
    await page.joinWith(
      snapshot({
        stories,
        room: { ...snapshot().room, status: "voting", currentStoryId: "s2" },
        round: { id: "r1", number: 1, revealed: false },
      }),
    );

    const items = within(backlog()).getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringContaining("Estimated: 5"),
      expect.stringContaining("Current"),
      expect.stringContaining("Pending"),
    ]);
  });

  it("says when there are no stories yet", async () => {
    const page = renderRoomPage();
    await page.joinWith();
    expect(within(backlog()).getByText("No stories yet.")).toBeTruthy();
  });

  it("lets the facilitator add one story and clears the box afterwards", async () => {
    const page = renderRoomPage();
    await page.joinWith(facilitatorView());

    await page.user.type(storyInput(), "Profile page");
    await page.user.click(screen.getByRole("button", { name: "Add stories" }));

    expect(page.socket.emitted.at(-1)).toEqual({
      event: "story:add",
      payload: { titles: ["Profile page"] },
    });
    expect(storyInput().value).toBe("");
  });

  it("adds a pasted list, one story per line, skipping blank lines", async () => {
    const page = renderRoomPage();
    await page.joinWith(facilitatorView());

    await page.user.click(storyInput());
    await page.user.paste("  First  \n\nSecond\n   \nThird\n");
    await page.user.click(screen.getByRole("button", { name: "Add stories" }));

    expect(page.socket.emitted.at(-1).payload).toEqual({ titles: ["First", "Second", "Third"] });
  });

  it("refuses more than 50 lines at once", async () => {
    const page = renderRoomPage();
    await page.joinWith(facilitatorView());

    await page.user.click(storyInput());
    await page.user.paste(Array.from({ length: 51 }, (_, index) => `Story ${index}`).join("\n"));
    await page.user.click(screen.getByRole("button", { name: "Add stories" }));

    expect(screen.getByText("Add at most 50 stories at a time.")).toBeTruthy();
    expect(page.socket.emitted.some((emit) => emit.event === "story:add")).toBe(false);
  });

  it("names the line that is too long", async () => {
    const page = renderRoomPage();
    await page.joinWith(facilitatorView());

    await page.user.click(storyInput());
    await page.user.paste(`Fine\n${"x".repeat(201)}`);
    await page.user.click(screen.getByRole("button", { name: "Add stories" }));

    expect(screen.getByText("Line 2: Use 1 to 200 characters.")).toBeTruthy();
  });

  it("lets the facilitator start voting on a specific story", async () => {
    const page = renderRoomPage();
    await page.joinWith(facilitatorView());

    await page.user.click(screen.getByRole("button", { name: "Vote on Reset password" }));

    expect(page.socket.emitted.at(-1)).toEqual({
      event: "story:select",
      payload: { storyId: "s3" },
    });
  });

  it("gives other participants a read-only list", async () => {
    const page = renderRoomPage();
    await page.joinWith(snapshot({ stories }));

    expect(screen.queryByLabelText("Add stories")).toBeNull();
    expect(screen.queryByRole("button", { name: /^Vote on / })).toBeNull();
  });

  it("can be collapsed and expanded", async () => {
    const page = renderRoomPage();
    await page.joinWith(snapshot({ stories }));
    const toggle = screen.getByRole("button", { name: "Stories (3)" });

    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    await page.user.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    // Role queries skip hidden content (text queries don't), matching what users perceive.
    expect(within(backlog()).queryAllByRole("listitem")).toHaveLength(0);
  });
});
