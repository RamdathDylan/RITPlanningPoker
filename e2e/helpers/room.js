import { expect } from "@playwright/test";

export const cardName = (value) => `${value} ${value === "1" ? "point" : "points"}`;

// Cards are matched exactly: by default Playwright would also match "1 point" inside "21 points".
export const card = (page, value) =>
  page.getByRole("button", { name: cardName(value), exact: true });

// On phones the stories panel starts collapsed (it keeps the voting screen focused).
export async function openStories(page) {
  const toggle = page.getByRole("button", { name: /^Stories \(\d+\)$/ });
  if ((await toggle.getAttribute("aria-expanded")) === "false") {
    await toggle.click();
  }
}

// Each participant gets their own browser context, so each has separate localStorage.
export async function newPage(browser) {
  const context = await browser.newContext();
  return context.newPage();
}

export async function createRoom(
  browser,
  { roomName = "E2E Sprint", displayName = "Facilitator" } = {},
) {
  const host = await newPage(browser);
  await host.goto("/");
  await host.getByRole("link", { name: "Create a room" }).click();
  await host.getByLabel("Room name").fill(roomName);
  await host.getByLabel("Your name").fill(displayName);
  await host.getByRole("button", { name: "Create room" }).click();
  await expect(host.getByRole("heading", { level: 1, name: roomName })).toBeVisible();
  const code = /room\/([A-Z0-9]{8})$/.exec(host.url())[1];
  return { host, code };
}

export async function joinRoom(browser, code, displayName) {
  const page = await newPage(browser);
  await page.goto(`/join/${code}`);
  await page.getByLabel("Your name").fill(displayName);
  await page.getByRole("button", { name: "Join room" }).click();
  await expect(page.getByRole("heading", { level: 2, name: /Participants/ })).toBeVisible();
  return page;
}

export async function startVoting(host, title = "Login page") {
  await openStories(host);
  await host.getByLabel("Add stories").fill(title);
  await host.getByRole("button", { name: "Add stories" }).click();
  await host.getByRole("button", { name: `Vote on ${title}` }).click();
}
