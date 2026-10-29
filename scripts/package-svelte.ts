// Builds the Svelte component package in the current directory into package-dist/ with svelte-package, which keeps
// each .svelte file for the app's own compiler and writes .js and .d.ts beside it. The published package.json points
// its exports there, with the `svelte` condition bundlers read for component libraries.
import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { writeManifest } from "./package-manifest.ts";

const dir = process.cwd();
const out = join(dir, "package-dist");

rmSync(out, { recursive: true, force: true });

execFileSync(
  join(dir, "node_modules/.bin/svelte-package"),
  ["-i", "src", "-o", "package-dist", "--tsconfig", "tsconfig.json"],
  { cwd: dir, stdio: "inherit" },
);

writeManifest(dir, out, {
  ".": { types: "./index.d.ts", svelte: "./index.js", default: "./index.js" },
});
