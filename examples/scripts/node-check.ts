import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { validateSvg } from "svjeez/frames";
import { isScene, svg as backend, type Scene } from "svjeez/tools";

const ROOT = join(import.meta.dirname, "..");

const flat = async (dir: string) =>
  (await readdir(join(ROOT, dir)))
    .filter((name) => name.endsWith(".tsx"))
    .map((name) => join(dir, name));

const scenes = [
  ...(await readdir(ROOT, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && existsSync(join(ROOT, entry.name, "index.tsx")))
    .map((entry) => join(entry.name, "index.tsx")),
  ...(await flat("readme")),
];

type Made = string | Scene;

const isBuild = (value: Made | (() => Made)): value is () => Made => typeof value === "function";

const svgOf = (exported: Made | (() => Made)): string => {
  const made = isBuild(exported) ? exported() : exported;

  return isScene(made) ? backend.emit(made) : made;
};

let failed = 0;

for (const scene of scenes) {
  try {
    const { default: exported }: { default: Made | (() => Made) } = await import(join(ROOT, scene));

    const { errors } = validateSvg(svgOf(exported));

    if (errors.length > 0) throw new Error(errors.join("\n"));
    console.log(`✓ ${scene}`);
  } catch (error) {
    failed++;
    console.error(`✗ ${scene}\n  ${error instanceof Error ? error.message : error}`);
  }
}

console.log(`${scenes.length - failed}/${scenes.length} scenes rendered on ${process.version}`);

if (failed > 0) process.exit(1);
