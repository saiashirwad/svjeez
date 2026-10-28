// Builds the plugin package in the current directory into package-dist/, the folder npm packs and publishes.
// The workspace's package.json points its exports at TypeScript source, because Astro loads the integrations in a
// config through Vite without the @svjeez/source condition. The published package.json points them at JavaScript.
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

type Manifest = Record<string, unknown> & {
  name: string;
  version: string;
  exports: Record<string, string | { types: string }>;
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

execFileSync(join(dir, "node_modules/.bin/tsc"), ["-p", "tsconfig.package.json"], {
  cwd: dir,
  stdio: "inherit",
});

const copy = (from: string, to: string) => {
  mkdirSync(dirname(join(out, to)), { recursive: true });
  copyFileSync(join(dir, from), join(out, to));
};

// "./src/scene.ts" is compiled to "./scene.js" and "./scene.d.ts"; any other file is copied as it is.
const exports = Object.fromEntries(
  Object.entries(read(dir).exports).map(([key, target]) => {
    if (typeof target !== "string") return (copy(target.types, target.types), [key, target]);
    const path = target.replace(/^\.\/src\//, "./");

    if (!path.endsWith(".ts")) return (copy(target, path), [key, path]);

    return [key, { types: path.replace(/\.ts$/, ".d.ts"), default: path.replace(/\.ts$/, ".js") }];
  }),
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
  `${JSON.stringify({ ...manifest, exports, ...(manifest.dependencies && { dependencies }) }, null, 2)}\n`,
);

copy("README.md", "README.md");

copyFileSync(join(ROOT, "LICENSE"), join(out, "LICENSE"));
