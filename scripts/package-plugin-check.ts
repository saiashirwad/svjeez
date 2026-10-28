// Checks the plugin package in the current directory the way users install it. It builds and lints package-dist/,
// packs it with svjeez and every workspace package it depends on, installs the tarballs into a copy of
// test/consumer/, and runs that project's `check` script, which builds the project and reads what the build wrote.
import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const dir = process.cwd();

type Target = string | { types: string };

interface Manifest {
  name: string;
  version: string;
  exports: Record<string, Target>;
  dependencies?: Record<string, string>;
}

const isPath = (target: Target): target is string => typeof target === "string";

const manifest = (path: string): Manifest =>
  JSON.parse(readFileSync(join(path, "package.json"), "utf8"));

const run = (command: string, args: readonly string[], cwd = dir) =>
  execFileSync(command, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });

const tmp = mkdtempSync(join(tmpdir(), "svjeez-plugin-"));

try {
  run("bun", ["run", "build:package"]);
  run(join(ROOT, "packages/svjeez/node_modules/.bin/publint"), ["--strict", "package-dist"]);
  console.log("✓ publint");

  const pack = (cwd: string) =>
    join(
      tmp,
      run("npm", ["pack", "--silent", "--pack-destination", tmp], cwd).trim().split("\n").at(-1)!,
    );

  const workspace = (name: string) => join(ROOT, "packages", name.replace(/^@svjeez\//, ""));
  const tarball = pack(join(dir, "package-dist"));

  // Only compiled entry points: .astro files and type-only entries reach into other packages, which the consumer covers.
  const compiled = Object.entries(manifest(dir).exports).filter(
    ([, target]) => isPath(target) && target.endsWith(".ts"),
  );

  run(join(ROOT, "packages/svjeez/node_modules/.bin/attw"), [
    tarball,
    "--profile",
    "esm-only",
    "--entrypoints",
    ...compiled.map(([key]) => key),
  ]);
  console.log("✓ arethetypeswrong");
  const tarballs = [pack(join(ROOT, "packages/svjeez")), tarball];

  for (const name of Object.keys(manifest(dir).dependencies ?? {})) {
    if (!name.startsWith("@svjeez/")) continue;
    run("bun", ["run", "build:package"], workspace(name));
    tarballs.push(pack(join(workspace(name), "package-dist")));
  }

  // Posters launch the Chromium that this repository's playwright-core installed, so the consumer uses the same version.
  const playwright = manifest(join(ROOT, "packages/svjeez/node_modules/playwright-core")).version;
  const consumer = join(tmp, "consumer");
  cpSync(join(dir, "test/consumer"), consumer, { recursive: true });
  // npm 10, which Node 20 ships, can't install Vite 8 even on its own: arborist fails on Vite's optional peers. npm 11 can.
  run(
    "npx",
    [
      "--yes",
      "npm@11",
      "install",
      "--no-audit",
      "--no-fund",
      "--loglevel=error",
      ...tarballs,
      `playwright-core@${playwright}`,
    ],
    consumer,
  );
  console.log(`✓ installed ${tarballs.length} tarballs`);
  process.stdout.write(run("npm", ["run", "--silent", "check"], consumer));
  console.log(
    `${manifest(dir).name} package checks passed on Node ${run("node", ["--version"]).trim()}`,
  );
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
