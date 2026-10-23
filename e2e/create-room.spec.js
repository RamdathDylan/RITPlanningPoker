import { expect, test } from "@playwright/test";
import { expectNoA11yViolations, expectNoHorizontalScroll } from "./helpers/a11y.js";

test.describe("create room page", () => {
  for (const colorScheme of ["light", "dark"]) {
    test(`has no accessibility violations, empty and with errors (${colorScheme})`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme });
      await page.goto("/new");
      await expect(page.getByRole("heading", { level: 1, name: "Create a room" })).toBeVisible();
      await expectNoA11yViolations(page);

      await page.getByRole("button", { name: "Create room" }).click();
      await expect(page.getByText("Use 1 to 60 characters.")).toBeVisible();
      await expectNoA11yViolations(page);
    });
  }

  test("does not scroll sideways at 360px", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto("/new");
    await expectNoHorizontalScroll(page);
  });

  test("is reachable from the landing page", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Create a room" }).click();
    await expect(page).toHaveURL("/new");
  });
});
