import { expect, test } from "@playwright/test";
import { card, createRoom, joinRoom, startVoting } from "./helpers/room.js";

const banner = (page) =>
  page.getByRole("alert").filter({ hasText: "Connection lost. Reconnecting…" });

test("a voter who drops offline keeps their vote when they come back", async ({ browser }) => {
  test.setTimeout(60_000);
  const { host, code } = await createRoom(browser);
  const voter = await joinRoom(browser, code, "Riley");
  await startVoting(host);
  await card(voter, "5").click();
  await expect(card(voter, "5")).toHaveAttribute("aria-pressed", "true");

  await voter.context().setOffline(true);
  await expect(banner(voter)).toBeVisible({ timeout: 15_000 });
  await voter.waitForTimeout(5_000);
  await voter.context().setOffline(false);

  await expect(banner(voter)).toBeHidden({ timeout: 20_000 });
  await expect(card(voter, "5")).toHaveAttribute("aria-pressed", "true");
  await expect(host.getByText("Voted", { exact: true })).toHaveCount(1);
});

test("refreshing the page rejoins the same seat with the same vote", async ({ browser }) => {
  const { host, code } = await createRoom(browser);
  const voter = await joinRoom(browser, code, "Riley");
  await startVoting(host);
  await card(voter, "8").click();
  await expect(card(voter, "8")).toHaveAttribute("aria-pressed", "true");

  await voter.reload();

  await expect(card(voter, "8")).toHaveAttribute("aria-pressed", "true");
  await expect(host.getByRole("heading", { level: 2, name: "Participants (2)" })).toBeVisible();
});

test("another participant takes over when the facilitator closes their tab", async ({
  browser,
}) => {
  test.setTimeout(60_000);
  const { host, code } = await createRoom(browser);
  const voter = await joinRoom(browser, code, "Riley");
  await startVoting(host);
  await expect(voter.getByRole("region", { name: "Facilitator controls" })).toHaveCount(0);

  await host.context().close();

  // The E2E server uses a short handoff delay (HANDOFF_MS in playwright.config.js).
  await expect(voter.getByRole("region", { name: "Facilitator controls" })).toBeVisible({
    timeout: 15_000,
  });
  const rileyRow = voter.getByRole("listitem").filter({ hasText: "Riley (you)" });
  await expect(rileyRow.getByText("Facilitator", { exact: true })).toBeVisible();
});
