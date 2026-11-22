import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import * as nodeModule from "node:module";
import { join } from "node:path";
import { validateSvg } from "svjeez/frames";
import { isScene, loadTypeGpu, svg as backend, type Scene } from "svjeez/tools";

const ROOT = join(import.meta.dirname, "..");

const flat = async (dir: string) =>
  (await readdir(join(ROOT, dir)))
    .filter((name) => name.endsWith(".tsx"))
    .map((name) => join(dir, name));

// A directory with an index.html is a film of a web page. Its index.tsx imports that HTML (Bun only) and
// needs Chromium, so `bun run build` covers it and Node can't load it.
const scenes = [
  ...(await readdir(ROOT, { withFileTypes: true }))
    .filter(
      (entry) =>
        entry.isDirectory() &&
        existsSync(join(ROOT, entry.name, "index.tsx")) &&
        !existsSync(join(ROOT, entry.name, "index.html")),
    )
    .map((entry) => join(entry.name, "index.tsx")),
  ...(await flat("readme")),
];

const GPU = join("gpu-card", "index.tsx");

type Made = string | Scene;

const isBuild = (value: Made | (() => Made)): value is () => Made => typeof value === "function";

const svgOf = (exported: Made | (() => Made)): string => {
  const made = isBuild(exported) ? exported() : exported;

  return isScene(made) ? backend.emit(made) : made;
};

// A scene with a <Shader> is written with TypeGPU: its "use gpu" functions are compiled as the scene is imported, by a
// Node hook that Node 20 does not have.
await loadTypeGpu(ROOT);

const compiles = "registerHooks" in nodeModule;

let failed = 0;

for (const scene of scenes) {
  if (!compiles && scene === GPU) {
    console.log(`- ${scene} (needs Node with module.registerHooks)`);
    continue;
  }

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
