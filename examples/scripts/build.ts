import { mkdir } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
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
  .concat(flat("readme"))
  .sort();

const wanted = process.argv.slice(2);
const unknown = wanted.filter((name) => !examples.includes(name));

if (unknown.length > 0) {
  console.error(`unknown example: ${unknown.join(", ")}\navailable: ${examples.join(", ")}`);
  process.exit(1);
}

type Made = string | Scene;

const isBuild = (value: Made | (() => Made)): value is () => Made => typeof value === "function";

const svgOf = (exported: Made | (() => Made)): string => {
  const made = isBuild(exported) ? exported() : exported;

  return isScene(made) ? backend.emit(made) : made;
};

const xmllint = Bun.which("xmllint");

const lint = (svg: string): string | undefined => {
  if (!xmllint) return;
  const result = Bun.spawnSync([xmllint, "--noout", "-"], { stdin: Buffer.from(svg) });

  return result.exitCode === 0 ? undefined : result.stderr.toString().trim();
};

const build = async (name: string): Promise<boolean> => {
  try {
    const { default: exported }: { default: Made | (() => Made) } = await import(
      join(ROOT, name.includes("/") ? `${name}.tsx` : join(name, "index.tsx"))
    );

    const svg = svgOf(exported);
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
    console.error(`✗ ${name}\n  ${error instanceof Error ? error.message : String(error)}`);

    return false;
  }
};

await mkdir(join(OUT, "readme"), { recursive: true });

const results = await Promise.all((wanted.length > 0 ? wanted : examples).map(build));

if (!xmllint) console.warn("xmllint not installed, skipped");

if (results.includes(false)) process.exit(1);
