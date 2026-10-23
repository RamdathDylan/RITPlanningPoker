import { spawn } from "node:child_process";

// Runs the API server and the Vite dev server together, prefixing each line with its source.
// Stopping one (or pressing Ctrl+C) stops both, so no process is left running in the background.
const processes = [
  { name: "server", args: ["run", "dev", "--workspace", "server"] },
  { name: "client", args: ["run", "dev", "--workspace", "client"] },
];

const children = processes.map(({ name, args }) => {
  const child = spawn("npm", args, { stdio: ["ignore", "pipe", "pipe"], env: process.env });
  const prefix = (stream, target) =>
    stream.on("data", (chunk) => {
      for (const line of chunk.toString().split("\n").filter(Boolean)) {
        target.write(`[${name}] ${line}\n`);
      }
    });
  prefix(child.stdout, process.stdout);
  prefix(child.stderr, process.stderr);
  return child;
});

function stopAll() {
  for (const child of children) {
    if (child.exitCode === null) {
      child.kill("SIGTERM");
    }
  }
}

for (const child of children) {
  child.on("exit", (code) => {
    if (code) {
      process.exitCode = code;
    }
    stopAll();
  });
}

process.on("SIGINT", stopAll);
process.on("SIGTERM", stopAll);
