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
