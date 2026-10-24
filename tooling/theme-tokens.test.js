import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const tokensPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../client/src/styles/tokens.css",
);

// Returns the declarations inside the first `{ ... }` block that follows `selector`.
function blockAfter(css, selector) {
  const start = css.indexOf(selector);
  if (start === -1) {
    return null;
  }
  const open = css.indexOf("{", start);
  const close = css.indexOf("}", open);
  return css
    .slice(open + 1, close)
    .split(";")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("--"))
    .sort();
}

describe("theme tokens", () => {
  it("define dark colors both for the device setting and for a chosen Dark theme", async () => {
    const css = await readFile(tokensPath, "utf8");
    const followsDevice = blockAfter(css, ':root:not([data-theme="light"])');
    const chosenDark = blockAfter(css, ':root[data-theme="dark"]');

    expect(followsDevice?.length).toBeGreaterThan(10);
    expect(chosenDark).toEqual(followsDevice);
  });

  it("define the RIT-style header colors", async () => {
    const css = await readFile(tokensPath, "utf8");
    for (const token of [
      "--color-header-bg: #000000",
      "--color-header-text: #ffffff",
      "--color-brand: #f76902",
    ]) {
      expect(css).toContain(token);
    }
  });
});
