import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { validateSvg } from "svjeez/frames";

// Renders the skill's examples on the running runtime; CI runs it on Node 20 and 22 through tsx.
const ROOT = join(import.meta.dirname, "..");

const scenes = (await readdir(join(ROOT, "skills/svjeez/examples")))
  .filter((name) => name.endsWith(".tsx"))
  .map((name) => join("skills/svjeez/examples", name));

let failed = 0;

for (const scene of scenes) {
  try {
    const { default: build }: { default: () => string } = await import(join(ROOT, scene));
    const svg = build();
    const { errors } = validateSvg(svg);

    if (errors.length > 0) throw new Error(errors.join("\n"));

    // The skill tests ask the same of these examples.
    if (!svg.includes("@keyframes")) throw new Error("the scene has no animation.");
    console.log(`✓ ${scene}`);
  } catch (error) {
    failed++;
    console.error(`✗ ${scene}\n  ${error instanceof Error ? error.message : error}`);
  }
}

console.log(`${scenes.length - failed}/${scenes.length} scenes rendered on ${process.version}`);

if (failed > 0) process.exit(1);
