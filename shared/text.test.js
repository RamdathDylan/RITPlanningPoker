import { describe, expect, it } from "vitest";
import { containsForbiddenCharacters, normalizeText, textLength } from "./text.js";

describe("normalizeText", () => {
  it("trims and collapses runs of whitespace, including tabs and newlines, to one space", () => {
    expect(normalizeText("  Fix \t the\n\nlogin   bug  ")).toBe("Fix the login bug");
  });

  it("converts to NFC so visually identical text compares equal", () => {
    const decomposed = "José";
    expect(normalizeText(decomposed)).toBe("José");
  });
});

describe("containsForbiddenCharacters", () => {
  it.each([
    ["a null byte", "Al\u0000ex"],
    ["a bell control character", "Al\u0007ex"],
    ["a right-to-left override", "‮exela"],
    ["a left-to-right isolate", "Alex⁦"],
    ["a left-to-right mark", "Alex‎"],
    ["a zero-width space", "Al​ex"],
    ["a word joiner", "Al⁠ex"],
    ["a byte order mark", "﻿Alex"],
    ["a zero-width joiner between letters", "Al‍ex"],
  ])("rejects text containing %s", (_label, text) => {
    expect(containsForbiddenCharacters(text)).toBe(true);
  });

  it.each([
    ["accented letters", "Zoë Müller"],
    ["non-Latin scripts", "李雷"],
    ["a single emoji", "Sam 🚀"],
    ["an emoji built with zero-width joiners", "👩‍💻 Dev"],
    ["an emoji with a variation selector and joiner", "🏳️‍🌈"],
    ["punctuation", "Fix #42: login (again)!"],
  ])("allows %s", (_label, text) => {
    expect(containsForbiddenCharacters(text)).toBe(false);
  });
});

describe("textLength", () => {
  it("counts characters the way Postgres char_length does (code points, not UTF-16 units)", () => {
    expect(textLength("🚀🚀")).toBe(2);
    expect(textLength("abc")).toBe(3);
  });

  it("counts a normalized accented letter as one character", () => {
    expect(textLength(normalizeText("é"))).toBe(1);
  });
});
