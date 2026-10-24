import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderRoomPage, snapshot } from "../../test/room-page.jsx";
import { ApiError } from "../api.js";

const stories = [
  { id: "s1", title: "Login", position: 0, status: "estimated", finalEstimate: "5" },
];

function endedAs({ facilitator }) {
  const base = snapshot();
  return snapshot({
    stories,
    room: { ...base.room, status: "ended" },
    me: facilitator ? { ...base.me, participantId: "dana", isFacilitator: true } : base.me,
  });
}

describe("exporting the summary", () => {
  it("downloads a CSV for the facilitator using their seat", async () => {
    const file = new Blob(["csv"]);
    const calls = [];
    const saved = [];
    const page = renderRoomPage({
      api: { exportCsv: async (...args) => (calls.push(args), file) },
      saveFile: (...args) => saved.push(args),
    });
    await page.joinWith(endedAs({ facilitator: true }));

    await page.user.click(screen.getByRole("button", { name: "Download CSV" }));

    expect(calls).toEqual([["ABCDEFGH", "t".repeat(43)]]);
    expect(saved).toEqual([[file, "planning-poker-ABCDEFGH.csv"]]);
  });

  it("is offered to every participant, using their own seat", async () => {
    const file = new Blob(["csv"]);
    const calls = [];
    const page = renderRoomPage({
      api: { exportCsv: async (...args) => (calls.push(args), file) },
      saveFile: () => {},
    });
    await page.joinWith(endedAs({ facilitator: false }));

    await page.user.click(screen.getByRole("button", { name: "Download CSV" }));

    expect(calls).toEqual([["ABCDEFGH", "t".repeat(43)]]);
  });

  it("explains a failed download", async () => {
    const page = renderRoomPage({
      api: {
        exportCsv: async () => {
          throw new ApiError("RATE_LIMITED", "Too many requests. Please slow down.");
        },
      },
    });
    await page.joinWith(endedAs({ facilitator: true }));

    await page.user.click(screen.getByRole("button", { name: "Download CSV" }));

    expect(screen.getByRole("alert").textContent).toBe("Too many requests. Please slow down.");
  });
});
