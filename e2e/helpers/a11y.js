import AxeBuilder from "@axe-core/playwright";
import { expect } from "@playwright/test";

const WCAG_21_AA_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

// Fails with a readable list of violations (rule, impact, and the elements involved).
export async function expectNoA11yViolations(page) {
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_21_AA_TAGS).analyze();
  const summary = violations.map(({ id, impact, nodes }) => ({
    id,
    impact,
    targets: nodes.map((node) => node.target.join(" ")),
  }));
  expect(summary).toEqual([]);
}

export async function expectNoHorizontalScroll(page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}
