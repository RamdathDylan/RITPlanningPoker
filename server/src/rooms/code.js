import { randomInt as cryptoRandomInt } from "node:crypto";
import { JOIN_CODE_ALPHABET, JOIN_CODE_LENGTH } from "../../../shared/join-code.js";

// randomInt is injectable so tests can control it; production always uses crypto (rule 5).
export function generateJoinCode(randomInt = cryptoRandomInt) {
  let code = "";
  for (let index = 0; index < JOIN_CODE_LENGTH; index += 1) {
    code += JOIN_CODE_ALPHABET[randomInt(JOIN_CODE_ALPHABET.length)];
  }
  return code;
}
