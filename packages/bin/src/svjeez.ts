#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";
import { assetFor, launch } from "./launch";

const built = process.env.SVJEEZ_VERSION;

if (built === undefined) {
  console.error(
    "svjeez: run scripts/package.ts to bundle this launcher, which gives it a version.",
  );
  process.exit(1);
}

const translated =
  process.platform === "darwin" &&
  process.arch === "x64" &&
  spawnSync("sysctl", ["-n", "sysctl.proc_translated"], { encoding: "utf8" }).stdout?.trim() ===
    "1";

const asset = assetFor(process.platform, process.arch, translated);

if (asset === undefined) {
  console.error(
    `svjeez: no single-file build for ${process.platform} ${process.arch}. See https://github.com/saiashirwad/svjeez/releases.`,
  );
  process.exit(1);
}

process.exit(
  await launch({
    version: built,
    releases:
      process.env.SVJEEZ_RELEASES ?? "https://github.com/saiashirwad/svjeez/releases/download",
    cache: join(process.env.XDG_CACHE_HOME || join(homedir(), ".cache"), "svjeez", "bin"),
    asset,
    argv: process.argv.slice(2),
  }).catch((error: Error) => {
    console.error(`svjeez: ${error.message}`);

    return 1;
  }),
);
