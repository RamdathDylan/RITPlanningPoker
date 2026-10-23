import { execFileSync } from "node:child_process";
import path from "node:path";

const ENV_FILE_NAME = /^\.env(\..+)?$/;

export function findForbiddenEnvFiles(trackedPaths) {
  return trackedPaths.filter((trackedPath) => {
    const name = path.posix.basename(trackedPath);
    return ENV_FILE_NAME.test(name) && name !== ".env.example";
  });
}

function listTrackedFiles() {
  const output = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" });
  return output.split("\0").filter(Boolean);
}

function main() {
  const forbidden = findForbiddenEnvFiles(listTrackedFiles());
  if (forbidden.length > 0) {
    console.error(
      "Environment files are tracked by git. Remove them and rotate every secret they contained:",
    );
    console.error(forbidden.join("\n"));
    process.exitCode = 1;
  }
}

if (import.meta.main) {
  main();
}
