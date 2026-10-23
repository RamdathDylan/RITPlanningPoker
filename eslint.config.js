import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";

const bannedHtmlMessage =
  "Render user text as React text. dangerouslySetInnerHTML is banned (CLAUDE.md rule 8).";

// A later config block replaces (not merges) an earlier block's options for the same rule,
// so the test-file block must repeat these selectors alongside its own.
const bannedHtmlSyntax = [
  { selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']", message: bannedHtmlMessage },
  { selector: "Property[key.name='dangerouslySetInnerHTML']", message: bannedHtmlMessage },
];

// CLAUDE.md security rule 5: codes and tokens come from node:crypto, never Math.random.
const bannedMathRandom = {
  object: "Math",
  property: "random",
  message: "Use node:crypto (randomInt, randomBytes) instead of Math.random (CLAUDE.md rule 5).",
};

export default defineConfig([
  globalIgnores(["**/dist/", "coverage/", "playwright-report/", "test-results/", "blob-report/"]),
  {
    files: ["**/*.{js,jsx}"],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.node,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  {
    files: ["**/*.{js,jsx}"],
    rules: {
      "no-restricted-syntax": ["error", ...bannedHtmlSyntax],
    },
  },
  {
    files: ["server/**/*.js", "shared/**/*.js"],
    rules: {
      "no-restricted-properties": ["error", bannedMathRandom],
    },
  },
  {
    files: ["**/*.test.{js,jsx}", "e2e/**/*.js"],
    rules: {
      "no-restricted-properties": [
        "error",
        bannedMathRandom,
        ...["it", "test", "describe"].flatMap((object) =>
          ["only", "skip"].map((property) => ({
            object,
            property,
            message: "Focused or skipped tests must not be committed.",
          })),
        ),
      ],
      "no-restricted-syntax": [
        "error",
        ...bannedHtmlSyntax,
        {
          selector: "CallExpression[callee.name=/^x(it|test|describe)$/]",
          message: "Skipped tests must not be committed.",
        },
      ],
    },
  },
  {
    files: ["client/**/*.{js,jsx}"],
    ignores: ["client/vite.config.js"],
    extends: [reactHooks.configs.flat.recommended],
    languageOptions: { globals: globals.browser },
  },
  {
    // Callbacks passed to page.evaluate run inside the browser.
    files: ["e2e/**/*.js"],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  {
    files: ["server/src/**/*.js"],
    rules: {
      "no-console": "error",
    },
  },
  {
    // CLAUDE.md security rule 2: SQL is parameterized ($1, $2, ...), never built from strings.
    files: ["server/src/**/*.js"],
    ignores: ["**/*.test.js"],
    rules: {
      "no-restricted-syntax": [
        "error",
        ...bannedHtmlSyntax,
        {
          selector:
            "CallExpression[callee.property.name='query'] > TemplateLiteral[expressions.length>0]",
          message: "Use $1, $2 parameters instead of building SQL with ${} (CLAUDE.md rule 2).",
        },
      ],
    },
  },
  prettier,
]);
