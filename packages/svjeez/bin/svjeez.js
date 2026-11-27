#!/usr/bin/env node
// Published installs run the built CLI. A linked source checkout has no
// package-dist, so run src/cli.ts through bun with the source condition.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const built = new URL("../package-dist/cli.js", import.meta.url);

if (existsSync(built)) {
  await import(built.href);
} else {
  const source = fileURLToPath(new URL("../src/cli.ts", import.meta.url));

  const result = spawnSync(
    "bun",
    ["--conditions", "@svjeez/source", source, ...process.argv.slice(2)],
    { stdio: "inherit" },
  );

  if (result.error?.code === "ENOENT") {
    console.error(
      "svjeez: package-dist is not built and bun is not installed. " +
        "Install bun, or build the package with `bun run build:package` in packages/svjeez.",
    );
    process.exit(1);
  }

  if (result.error) {
    console.error(`svjeez: ${result.error.message}`);
    process.exit(1);
  }

  process.exit(result.status ?? (result.signal ? 1 : 0));
}
