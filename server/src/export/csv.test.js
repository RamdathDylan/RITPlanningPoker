import { describe, expect, it } from "vitest";
import { toCsv } from "./csv.js";

describe("toCsv", () => {
  it("quotes every field and separates rows with CRLF", () => {
    expect(
      toCsv([
        ["Story", "Final estimate"],
        ["Login", "5"],
      ]),
    ).toBe('"Story","Final estimate"\r\n"Login","5"\r\n');
  });

  it("keeps commas, quotes, and newlines inside a cell intact", () => {
    expect(toCsv([['Say "hi", then\nleave']])).toBe('"Say ""hi"", then\nleave"\r\n');
  });

  it.each(["=SUM(A1:A9)", "+1", "-1+2", "@cmd", "\tTab", "\rReturn"])(
    "stops %j from running as a spreadsheet formula",
    (value) => {
      expect(toCsv([[value]])).toBe(`"'${value}"\r\n`);
    },
  );

  it("turns null into an empty cell", () => {
    expect(toCsv([["Login", null]])).toBe('"Login",""\r\n');
  });
});
