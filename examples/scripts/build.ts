import { mkdir } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { runFilm } from "@svjeez/dom/vite";
import { validateSvg } from "svjeez/frames";
import { isScene, svg as backend, type Scene } from "svjeez/tools";

const ROOT = join(import.meta.dir, "..");
const OUT = join(ROOT, "dist");

const flat = (dir: string) =>
  [...new Bun.Glob(`${dir}/*.tsx`).scanSync(ROOT)].map(
    (entry) => `${dir}/${basename(entry, ".tsx")}`,
  );

const examples = [...new Bun.Glob("*/index.tsx").scanSync(ROOT)]
  .map((entry) => basename(dirname(entry)))
  .concat(flat("readme"), flat("mermaid-types"), flat("dom-component"), flat("dom-svelte"))
  .sort();

const wanted = process.argv.slice(2);
const unknown = wanted.filter((name) => !examples.includes(name));

if (unknown.length > 0) {
  console.error(`unknown example: ${unknown.join(", ")}\navailable: ${examples.join(", ")}`);
  process.exit(1);
}

type Made = string | Scene;

const isBuild = (value: Made | (() => Made)): value is () => Made => typeof value === "function";

const svgOf = (exported: Made | (() => Made), prefix?: string): string => {
  const made = isBuild(exported) ? exported() : exported;

  return isScene(made) ? backend.emit(made, { prefix }) : made;
};

const xmllint = Bun.which("xmllint");

const lint = (svg: string): string | undefined => {
  if (!xmllint) return;
  const result = Bun.spawnSync([xmllint, "--noout", "-"], { stdin: Buffer.from(svg) });

  return result.exitCode === 0 ? undefined : result.stderr.toString().trim();
};

const build = async (name: string): Promise<boolean> => {
  try {
    const file = join(ROOT, name.includes("/") ? `${name}.tsx` : join(name, "index.tsx"));

    // `*.vite.tsx` films a component through Vite, which has to load the film file itself.
    // A scene that shares a page with others exports a `prefix`, which keeps its classes, keyframes and fonts apart.
    const loaded = file.endsWith(".vite.tsx") ? undefined : await import(file);
    const exported: Made | (() => Made) = loaded ? loaded.default : (await runFilm(file)).svg;

    const svg = svgOf(exported, loaded?.prefix);
    const { warnings } = validateSvg(svg);
    const problem = lint(svg);

    if (problem) throw new Error(`xmllint: ${problem}`);
    await Bun.write(join(OUT, `${name}.svg`), svg);
    const keyframes = svg.match(/@keyframes /g)?.length ?? 0;
    const tracks = svg.match(/animation-name:/g)?.length ?? 0;
    console.log(
      `✓ dist/${name}.svg  ${(svg.length / 1024).toFixed(1)} KB · ${keyframes} keyframes · ${tracks} tracks`,
    );

    for (const warning of warnings) console.warn(`  warning: ${warning}`);

    return true;
  } catch (error) {
    // A SceneError's message says what to change; anything else is a crash, and its stack says where.
    const detail = !(error instanceof Error)
      ? String(error)
      : error.name === "SceneError"
        ? error.message
        : (error.stack ?? error.message);

    console.error(`✗ ${name}\n  ${detail}`);

    return false;
  }
};

await mkdir(join(OUT, "readme"), { recursive: true });

const names = wanted.length > 0 ? wanted : examples;

const results = await Promise.all(names.map(build));

if (!xmllint) console.warn("xmllint not installed, skipped");

if (results.includes(false)) process.exit(1);
