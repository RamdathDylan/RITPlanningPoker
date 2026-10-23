import { describe, expect, it } from "vitest";
import { findHardCodedStyles, scanClientStyles } from "./hard-coded-styles.js";

describe("findHardCodedStyles", () => {
  it("flags hex colors and raw px values", () => {
    const css = ".card {\n  color: #fff;\n  padding: 12px;\n}\n";

    expect(findHardCodedStyles(css)).toEqual([
      { line: 2, match: "#fff" },
      { line: 3, match: "12px" },
    ]);
  });

  it("allows token references, rem values, and zero", () => {
    const css = ".card { color: var(--color-text); margin: 0; max-width: 40rem; }";

    expect(findHardCodedStyles(css)).toEqual([]);
  });

  it("ignores values inside comments", () => {
    expect(findHardCodedStyles("/* was #000 and 4px */\n.a { margin: 0; }")).toEqual([]);
  });
});

describe("client styles", () => {
  it("use design tokens instead of hard-coded colors and pixel sizes", async () => {
    expect(await scanClientStyles()).toEqual([]);
  });
});
