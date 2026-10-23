// CLAUDE.md required E2E: four voters (plus the facilitator) complete a full round.
import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { expectNoA11yViolations } from "./helpers/a11y.js";
import { card, createRoom, joinRoom, openStories } from "./helpers/room.js";

// Distinct cards so a leak in the browser's socket traffic is unmistakable.
const VOTES = { Facilitator: "13", "Voter 1": "1", "Voter 2": "2", "Voter 3": "3", "Voter 4": "8" };

test("four voters and a facilitator complete a round", async ({ browser }, testInfo) => {
  test.setTimeout(60_000);

  const { host, code } = await createRoom(browser);
  const voters = {};
  for (const name of ["Voter 1", "Voter 2", "Voter 3", "Voter 4"]) {
    voters[name] = await joinRoom(browser, code, name);
  }
  await expect(host.getByRole("heading", { level: 2, name: "Participants (5)" })).toBeVisible();

  // Record every WebSocket frame Voter 1's browser receives.
  const voter1Frames = [];
  voters["Voter 1"].on("websocket", (socket) =>
    socket.on("framereceived", (frame) => voter1Frames.push(String(frame.payload))),
  );

  // Facilitator adds stories and starts voting on the first.
  await openStories(host);
  await host.getByLabel("Add stories").fill("Login page\nSignup page");
  await host.getByRole("button", { name: "Add stories" }).click();
  await host.getByRole("button", { name: "Vote on Login page" }).click();
  for (const page of [host, ...Object.values(voters)]) {
    await expect(page.getByRole("heading", { level: 2, name: "Login page" })).toBeVisible();
  }
  await expectNoA11yViolations(voters["Voter 2"]);

  // Everyone votes.
  const everyone = { Facilitator: host, ...voters };
  for (const [name, page] of Object.entries(everyone)) {
    await card(page, VOTES[name]).click();
    await expect(card(page, VOTES[name])).toHaveAttribute("aria-pressed", "true");
  }
  await expect(host.getByText("Voted", { exact: true })).toHaveCount(5);
  await testInfo.attach("voting", {
    body: await host.screenshot({ fullPage: true }),
    contentType: "image/png",
  });

  // Before the reveal, Voter 1's browser never received anyone else's vote.
  for (const frame of voter1Frames) {
    expect(frame).not.toContain('"value"');
    for (const [name, value] of Object.entries(VOTES)) {
      if (name !== "Voter 1") {
        expect(frame, `Voter 1 received ${name}'s vote`).not.toContain(`"${value}"`);
      }
    }
  }

  // Reveal.
  await host.getByRole("button", { name: "Reveal votes" }).click();
  for (const page of Object.values(everyone)) {
    await expect(page.getByRole("list", { name: "Votes" }).getByRole("listitem")).toHaveCount(5);
    await expect(page.getByText("Average 5.4 · Median 3 · Range 1 to 13")).toBeVisible();
  }
  await expectNoA11yViolations(host);
  await testInfo.attach("revealed", {
    body: await host.screenshot({ fullPage: true }),
    contentType: "image/png",
  });

  // Accept the suggested estimate (median 3 → card 3).
  await expect(host.getByLabel("Final estimate")).toHaveValue("3");
  await host.getByRole("button", { name: "Accept estimate" }).click();
  for (const page of Object.values(everyone)) {
    await openStories(page);
    await expect(page.getByText("Estimated: 3")).toBeVisible();
  }

  // The facilitator ends the session; everyone sees the summary; the CSV downloads.
  await host.getByRole("button", { name: "End session" }).click();
  await host.getByRole("button", { name: "Confirm end session" }).click();
  for (const page of Object.values(everyone)) {
    await expect(page.getByRole("table", { name: "Estimates" })).toBeVisible();
  }
  await expectNoA11yViolations(host);
  const downloading = host.waitForEvent("download");
  await host.getByRole("button", { name: "Download CSV" }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe(`planning-poker-${code}.csv`);
  expect(await readFile(await download.path(), "utf8")).toBe(
    '"Story","Final estimate"\r\n"Login page","3"\r\n"Signup page",""\r\n',
  );
});
