import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { validateSvg } from "svjeez";

// Renders every example on the running runtime; CI runs it on Node 20 and 22 through tsx.
const ROOT = join(import.meta.dirname, "..");

const scenes = [
  ...(await readdir(join(ROOT, "examples"), { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && entry.name !== "readme" && entry.name !== "site")
    .map((entry) => join("examples", entry.name, "index.tsx")),
  ...(await readdir(join(ROOT, "examples/readme")))
    .filter((name) => name.endsWith(".tsx"))
    .map((name) => join("examples/readme", name)),
  ...(await readdir(join(ROOT, "examples/site")))
    .filter((name) => name.endsWith(".tsx"))
    .map((name) => join("examples/site", name)),
  ...(await readdir(join(ROOT, "skills/svjeez/examples")))
    .filter((name) => name.endsWith(".tsx"))
    .map((name) => join("skills/svjeez/examples", name)),
];

let failed = 0;

for (const scene of scenes) {
  try {
    const { default: build }: { default: () => string } = await import(join(ROOT, scene));
    const { errors } = validateSvg(build());

    if (errors.length > 0) throw new Error(errors.join("\n"));
    console.log(`✓ ${scene}`);
  } catch (error) {
    failed++;
    console.error(`✗ ${scene}\n  ${error instanceof Error ? error.message : error}`);
  }
}

console.log(`${scenes.length - failed}/${scenes.length} scenes rendered on ${process.version}`);

if (failed > 0) process.exit(1);
