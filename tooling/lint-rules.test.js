import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const eslint = new ESLint();

async function ruleIdsFor(code, filePath) {
  const [result] = await eslint.lintText(code, { filePath });
  return result.messages.map((message) => message.ruleId);
}

describe("project lint rules", () => {
  it("rejects dangerouslySetInnerHTML as a JSX attribute", async () => {
    const code =
      "export const Bad = ({ html }) => <div dangerouslySetInnerHTML={{ __html: html }} />;\n";
    expect(await ruleIdsFor(code, "client/src/Bad.jsx")).toContain("no-restricted-syntax");
  });

  it("rejects dangerouslySetInnerHTML passed as an object property", async () => {
    const code = "export const props = { dangerouslySetInnerHTML: { __html: '' } };\n";
    expect(await ruleIdsFor(code, "client/src/bad-props.js")).toContain("no-restricted-syntax");
  });

  it.each([
    ["it.only", "it.only('x', () => {});"],
    ["test.only", "test.only('x', () => {});"],
    ["describe.only", "describe.only('x', () => {});"],
    ["it.skip", "it.skip('x', () => {});"],
    ["test.skip", "test.skip('x', () => {});"],
    ["describe.skip", "describe.skip('x', () => {});"],
  ])("rejects %s in test files", async (_name, call) => {
    const code = `import { it, test, describe } from "vitest";\n${call}\n`;
    expect(await ruleIdsFor(code, "server/test/example.test.js")).toContain(
      "no-restricted-properties",
    );
  });

  it.each(["xit", "xtest", "xdescribe"])("rejects %s in test files", async (name) => {
    const code = `${name}("x", () => {});\n`;
    expect(await ruleIdsFor(code, "server/test/example.test.js")).toContain("no-restricted-syntax");
  });

  it("rejects console.log in server source", async () => {
    const code = "console.log('debug');\n";
    expect(await ruleIdsFor(code, "server/src/example.js")).toContain("no-console");
  });

  it.each(["server/src/rooms/code.js", "shared/join-code.js"])(
    "rejects Math.random in %s, where randomness must come from crypto",
    async (filePath) => {
      const code = "export const pick = () => Math.random();\n";
      expect(await ruleIdsFor(code, filePath)).toContain("no-restricted-properties");
    },
  );

  it("rejects SQL built with a template literal inside query() in server source", async () => {
    const code =
      "export const find = (db, name) => db.query(`SELECT * FROM rooms WHERE name = '${name}'`);\n";
    expect(await ruleIdsFor(code, "server/src/db/example.js")).toContain("no-restricted-syntax");
  });

  it("allows parameterized queries and template literals without placeholders", async () => {
    const code = [
      'export const find = (db, name) => db.query("SELECT * FROM rooms WHERE name = $1", [name]);',
      "export const all = (db) => db.query(`",
      "  SELECT * FROM rooms",
      "`);",
      "",
    ].join("\n");
    expect(await ruleIdsFor(code, "server/src/db/example.js")).not.toContain(
      "no-restricted-syntax",
    );
  });

  it("allows ordinary code without reporting the restricted rules", async () => {
    const code = "export const greet = (name) => `Hello ${name}`;\n";
    const ruleIds = await ruleIdsFor(code, "server/src/greet.js");
    expect(ruleIds).not.toContain("no-restricted-syntax");
    expect(ruleIds).not.toContain("no-console");
  });
});
