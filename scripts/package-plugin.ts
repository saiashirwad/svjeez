// Builds the plugin package in the current directory into package-dist/, the folder npm packs and publishes.
// The workspace's package.json points its exports at TypeScript source, because Astro loads the integrations in a
// config through Vite without the @svjeez/source condition. The published package.json points them at JavaScript.
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

type Target = string | { types: string };

type Manifest = {
  name: string;
  version: string;
  private?: boolean;
  scripts?: Record<string, string>;
  devDependencies?: Record<string, string>;
  exports: Record<string, Target>;
  dependencies?: Record<string, string>;
};

const isPath = (target: Target): target is string => typeof target === "string";

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

// tsc rewrites `./x.ts` in imports to `./x.js` but leaves strings alone, so a worker started with
// `new URL("./worker.ts", import.meta.url)` would point at a file the package does not have.
for (const entry of readdirSync(out, { recursive: true, encoding: "utf8" }))
  if (entry.endsWith(".js")) {
    const file = join(out, entry);
    const code = readFileSync(file, "utf8");

    const fixed = code.replaceAll(
      /new URL\((["'])(\.{1,2}\/[^"']+)\.ts\1, import\.meta\.url\)/g,
      "new URL($1$2.js$1, import.meta.url)",
    );

    if (fixed !== code) writeFileSync(file, fixed);
  }

const copy = (from: string, to: string) => {
  mkdirSync(dirname(join(out, to)), { recursive: true });
  copyFileSync(join(dir, from), join(out, to));
};

// "./src/scene.ts" is compiled to "./scene.js" and "./scene.d.ts"; any other file is copied as it is.
const exports = Object.fromEntries(
  Object.entries(read(dir).exports).map(([key, target]) => {
    if (!isPath(target)) return (copy(target.types, target.types), [key, target]);
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
