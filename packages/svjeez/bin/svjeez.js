#!/usr/bin/env node
// A source checkout (src/ is not published) runs src/cli.ts through bun with the source condition,
// so a linked checkout never runs a stale package-dist. Published installs run the built CLI.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const source = fileURLToPath(new URL("../src/cli.ts", import.meta.url));
const built = new URL("../package-dist/cli.js", import.meta.url);

// Exits with the CLI's status; returns only when bun is not installed.
const fromSource = () => {
  const result = spawnSync(
    "bun",
    ["--conditions", "@svjeez/source", source, ...process.argv.slice(2)],
    { stdio: "inherit" },
  );

  if (result.error?.code === "ENOENT") return;

  if (result.error) {
    console.error(`svjeez: ${result.error.message}`);
    process.exit(1);
  }

  process.exit(result.status ?? 1);
};

if (existsSync(source)) fromSource();

if (existsSync(built)) {
  await import(built.href);
} else {
  console.error(
    "svjeez: package-dist is not built and bun is not installed. " +
      "Install bun, or build the package with `bun run build:package` in packages/svjeez.",
  );
  process.exit(1);
}
