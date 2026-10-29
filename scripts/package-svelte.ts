// Builds the Svelte component package in the current directory into package-dist/ with svelte-package, which keeps
// each .svelte file for the app's own compiler and writes .js and .d.ts beside it. The published package.json points
// its exports there, with the `svelte` condition bundlers read for component libraries.
import { execFileSync } from "node:child_process";
import { copyFileSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

type Manifest = {
  name: string;
  version: string;
  private?: boolean;
  scripts?: Record<string, string>;
  devDependencies?: Record<string, string>;
  dependencies?: Record<string, string>;
};

const ROOT = join(import.meta.dirname, "..");
const read = (dir: string): Manifest => JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));

const versions = new Map(
  readdirSync(join(ROOT, "packages")).map((name) => [
    read(join(ROOT, "packages", name)).name,
    read(join(ROOT, "packages", name)).version,
  ]),
);

const dir = process.cwd();
const out = join(dir, "package-dist");

rmSync(out, { recursive: true, force: true });

execFileSync(
  join(dir, "node_modules/.bin/svelte-package"),
  ["-i", "src", "-o", "package-dist", "--tsconfig", "tsconfig.json"],
  { cwd: dir, stdio: "inherit" },
);

const { private: _, scripts: __, devDependencies: ___, ...manifest } = read(dir);

const dependencies = Object.fromEntries(
  Object.entries(manifest.dependencies ?? {}).map(([name, range]) => [
    name,
    range.startsWith("workspace:") ? `^${versions.get(name)}` : range,
  ]),
);

writeFileSync(
  join(out, "package.json"),
  `${JSON.stringify(
    {
      ...manifest,
      exports: { ".": { types: "./index.d.ts", svelte: "./index.js", default: "./index.js" } },
      ...(manifest.dependencies && { dependencies }),
    },
    null,
    2,
  )}\n`,
);

copyFileSync(join(dir, "README.md"), join(out, "README.md"));

copyFileSync(join(ROOT, "LICENSE"), join(out, "LICENSE"));
