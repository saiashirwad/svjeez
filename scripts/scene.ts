// Runs the svjeez CLI from source on one scene, named the short way:
//   bun run scene check pendulum           examples/pendulum/index.tsx
//   bun run scene frames readme/hero       examples/readme/hero.tsx
//   bun run scene dev site:hero            site/src/scenes/hero.tsx
//   bun run scene svg ./any/path/scene.tsx
// The CLI runs inside the scene's package (examples/ or site/), so that package's bunfig.toml preloads apply.

import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";

const ROOT = join(import.meta.dir, "..");
const CLI = join(ROOT, "packages/svjeez/src/cli.ts");
const EXAMPLES = join(ROOT, "examples");
const SITE = join(ROOT, "site");
const SCENES = join(SITE, "src/scenes");

// A folder with an index.tsx is one scene; a folder without one holds a scene per file (readme/, mermaid-types/).
const exampleNames = (): string[] => {
  const files = [...new Bun.Glob("*/*.tsx").scanSync({ cwd: EXAMPLES })].filter(
    (file) => !file.startsWith("node_modules/") && !file.startsWith("scripts/"),
  );

  const whole = new Set(
    files.flatMap((file) => (file.endsWith("/index.tsx") ? [dirname(file)] : [])),
  );

  return files
    .flatMap((file) => (whole.has(dirname(file)) ? [] : [file.slice(0, -".tsx".length)]))
    .concat([...whole])
    .sort();
};

const candidates = (name: string): string[] => {
  if (name.startsWith("site:")) {
    const rest = name.slice("site:".length);

    return [join(SCENES, `${rest}.tsx`), join(SCENES, rest, "index.tsx")];
  }

  return [
    resolve(process.cwd(), name),
    join(EXAMPLES, name, "index.tsx"),
    join(EXAMPLES, `${name}.tsx`),
    join(EXAMPLES, name),
    join(SCENES, `${name}.tsx`),
    join(SCENES, name, "index.tsx"),
  ];
};

const find = (name: string): string | undefined =>
  candidates(name).find((file) => existsSync(file) && file.match(/\.(tsx?|jsx?|svg)$/));

// The package whose bunfig.toml and node_modules a scene expects.
const homeOf = (file: string): string => {
  if (!relative(EXAMPLES, file).startsWith("..")) return EXAMPLES;

  if (!relative(SITE, file).startsWith("..")) return SITE;

  return dirname(file);
};

// Flags whose values are paths: resolved against where you ran the command, not the package.
const PATH_FLAGS = new Set(["--out", "-o", "--params"]);

const USAGE = `usage: bun run scene <svg|dev|check|frames|video> <scene> [flags]

<scene> is an example name (pendulum, readme/hero, mermaid-types/pie), site:<name> for
site/src/scenes, or a path. Flags go straight to the svjeez CLI, whose usage follows.
frames writes to ${join(tmpdir(), "svjeez", "<scene>")} unless you pass --out.

examples: ${exampleNames().join(", ")}`;

const [command, target, ...rest] = process.argv.slice(2);

if (command === undefined || command === "help" || command === "--help" || command === "-h") {
  console.log(USAGE);
  Bun.spawnSync(["bun", CLI, "--help"], { stdout: "inherit", stderr: "inherit" });
  process.exit(0);
}

if (target === undefined) {
  console.error(USAGE);
  process.exit(1);
}

const file = find(target);

if (!file) {
  console.error(
    `No scene called ${JSON.stringify(target)}. Tried:\n  ${candidates(target).join("\n  ")}\n`,
  );
  console.error(USAGE);
  process.exit(1);
}

const flags = rest.map((arg, i) =>
  i > 0 && PATH_FLAGS.has(rest[i - 1]!) && !isAbsolute(arg) ? resolve(process.cwd(), arg) : arg,
);

const name = target
  .replace(/^site:/, "")
  .replace(/[/\\]/g, "-")
  .replace(/\.tsx?$/, "");

if (command === "frames" && !rest.some((arg) => arg === "--out" || arg === "-o"))
  flags.push("--out", join(tmpdir(), "svjeez", basename(name)));

const run = Bun.spawnSync(["bun", "--conditions", "@svjeez/source", CLI, command, file, ...flags], {
  cwd: homeOf(file),
  stdin: "inherit",
  stdout: "inherit",
  stderr: "inherit",
});

process.exit(run.exitCode ?? 1);
