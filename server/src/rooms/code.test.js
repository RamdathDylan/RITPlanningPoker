import { describe, expect, it } from "vitest";
import { JOIN_CODE_ALPHABET } from "../../../shared/join-code.js";
import { generateJoinCode } from "./code.js";

const CODE_PATTERN = /^[2-9A-HJKMNP-Z]{8}$/;

describe("generateJoinCode", () => {
  it("picks 8 symbols from the alphabet using the injected random source", () => {
    const requestedMaxima = [];
    const picks = [0, 30, 1, 2, 3, 4, 5, 6];
    const randomInt = (max) => {
      requestedMaxima.push(max);
      return picks[requestedMaxima.length - 1];
    };

    const code = generateJoinCode(randomInt);

    expect(requestedMaxima).toEqual(Array(8).fill(31));
    expect(code).toBe(picks.map((index) => JOIN_CODE_ALPHABET[index]).join(""));
  });

  it("produces codes the database constraint accepts when using crypto", () => {
    for (let attempt = 0; attempt < 500; attempt += 1) {
      expect(generateJoinCode()).toMatch(CODE_PATTERN);
    }
  });
});
