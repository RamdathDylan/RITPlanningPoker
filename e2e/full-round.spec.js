// CLAUDE.md required E2E: four voters (plus the facilitator) complete a full round.
import { expect, test } from "@playwright/test";
import { expectNoA11yViolations } from "./helpers/a11y.js";

// Distinct cards so a leak in the browser's socket traffic is unmistakable.
const VOTES = { Facilitator: "13", "Voter 1": "1", "Voter 2": "2", "Voter 3": "3", "Voter 4": "8" };

const cardName = (value) => `${value} ${value === "1" ? "point" : "points"}`;

// Cards are matched exactly: by default Playwright would also match "1 point" inside "21 points".
const card = (page, value) => page.getByRole("button", { name: cardName(value), exact: true });

// On phones the stories panel starts collapsed (it keeps the voting screen focused).
async function openStories(page) {
  const toggle = page.getByRole("button", { name: /^Stories \(\d+\)$/ });
  if ((await toggle.getAttribute("aria-expanded")) === "false") {
    await toggle.click();
  }
}

async function newPage(browser) {
  const context = await browser.newContext();
  return context.newPage();
}

test("four voters and a facilitator complete a round", async ({ browser }, testInfo) => {
  test.setTimeout(60_000);

  // Facilitator creates the room.
  const host = await newPage(browser);
  await host.goto("/");
  await host.getByRole("link", { name: "Create a room" }).click();
  await host.getByLabel("Room name").fill("E2E Sprint");
  await host.getByLabel("Your name").fill("Facilitator");
  await host.getByRole("button", { name: "Create room" }).click();
  await expect(host.getByRole("heading", { level: 1, name: "E2E Sprint" })).toBeVisible();
  const code = /room\/([A-Z0-9]{8})$/.exec(host.url())[1];

  // Four voters join with the code, each in their own browser context (separate storage).
  const voters = {};
  for (const name of ["Voter 1", "Voter 2", "Voter 3", "Voter 4"]) {
    const page = await newPage(browser);
    await page.goto(`/join/${code}`);
    await page.getByLabel("Your name").fill(name);
    await page.getByRole("button", { name: "Join room" }).click();
    await expect(page.getByRole("heading", { level: 2, name: /Participants/ })).toBeVisible();
    voters[name] = page;
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
});
