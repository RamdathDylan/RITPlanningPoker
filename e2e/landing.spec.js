import { expect, test } from "@playwright/test";
import { expectNoA11yViolations, expectNoHorizontalScroll } from "./helpers/a11y.js";

test.describe("landing page", () => {
  test("shows the heading and disclaimer with no accessibility violations", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1, name: "Planning Poker" })).toBeVisible();
    await expect(page.getByRole("contentinfo")).toContainText("not affiliated with RIT");
    await expectNoA11yViolations(page);
  });

  test("has no accessibility violations in dark mode", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/");

    await expectNoA11yViolations(page);
  });

  test("does not scroll sideways at the narrowest supported width (360px)", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto("/");

    await expectNoHorizontalScroll(page);
  });

  test("the unknown-route page links back home", async ({ page }) => {
    await page.goto("/nowhere");

    await page.getByRole("link", { name: "Go to the home page" }).click();
    await expect(page).toHaveURL("/");
  });
});
