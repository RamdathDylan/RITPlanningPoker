import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const clientSrc = path.join(path.dirname(fileURLToPath(import.meta.url)), "../client/src");
const TOKENS_FILE = "tokens.css";
const HARD_CODED_VALUE = /#[0-9a-fA-F]{3,8}\b|\b\d*\.?\d+px\b/g;
const STYLED_FILE = /\.(css|jsx)$/;

function stripComments(source) {
  // Keep newlines so reported line numbers still match the file.
  return source.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " "));
}

export function findHardCodedStyles(source) {
  return stripComments(source)
    .split("\n")
    .flatMap((text, index) =>
      [...text.matchAll(HARD_CODED_VALUE)].map(([match]) => ({ line: index + 1, match })),
    );
}

export async function scanClientStyles() {
  const entries = await readdir(clientSrc, { recursive: true });
  const files = entries.filter(
    (entry) => STYLED_FILE.test(entry) && path.basename(entry) !== TOKENS_FILE,
  );
  const findings = await Promise.all(
    files.map(async (file) => {
      const source = await readFile(path.join(clientSrc, file), "utf8");
      return findHardCodedStyles(source).map((finding) => ({ file, ...finding }));
    }),
  );
  return findings.flat();
}
