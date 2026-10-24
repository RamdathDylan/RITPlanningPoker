import { expect, test } from "@playwright/test";
import { expectNoA11yViolations } from "./helpers/a11y.js";

const background = (page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
const DARK_BG = "rgb(15, 17, 21)";
const LIGHT_BG = "rgb(255, 255, 255)";

test("Dark can be chosen on a light device, and is remembered after a reload", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  expect(await background(page)).toBe(LIGHT_BG);

  await page.getByRole("radio", { name: "Dark" }).check();
  expect(await background(page)).toBe(DARK_BG);
  await expectNoA11yViolations(page);

  await page.reload();
  expect(await background(page)).toBe(DARK_BG);
  await expect(page.getByRole("radio", { name: "Dark" })).toBeChecked();
});

test("Light can be chosen on a dark device", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  expect(await background(page)).toBe(DARK_BG);

  await page.getByRole("radio", { name: "Light" }).check();
  expect(await background(page)).toBe(LIGHT_BG);
  await expectNoA11yViolations(page);
});

test("the header is black with the app name linking home", async ({ page }) => {
  await page.goto("/privacy");
  const banner = page.getByRole("banner");
  expect(await banner.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe(
    "rgb(0, 0, 0)",
  );
  await banner.getByRole("link", { name: "Planning Poker" }).click();
  await expect(page).toHaveURL("/");
});
