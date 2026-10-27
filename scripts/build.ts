import { mkdir } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { validateSvg } from "svg-motion";

const ROOT = join(import.meta.dir, "..");
const OUT = join(ROOT, "dist");

const readme = [...new Bun.Glob("examples/readme/*.tsx").scanSync(ROOT)].map((entry) => `readme/${basename(entry, ".tsx")}`);
const examples = [...new Bun.Glob("examples/*/index.tsx").scanSync(ROOT)].map((entry) => basename(dirname(entry))).concat(readme).sort();
const wanted = process.argv.slice(2);
const unknown = wanted.filter((name) => !examples.includes(name));
if (unknown.length > 0) {
  console.error(`unknown example: ${unknown.join(", ")}\navailable: ${examples.join(", ")}`);
  process.exit(1);
}

const xmllint = Bun.which("xmllint");

const lint = (svg: string): string | undefined => {
  if (!xmllint) return;
  const result = Bun.spawnSync([xmllint, "--noout", "-"], { stdin: Buffer.from(svg) });
  return result.exitCode === 0 ? undefined : result.stderr.toString().trim();
};

const build = async (name: string): Promise<boolean> => {
  try {
    const { default: make } = (await import(join(ROOT, "examples", name.startsWith("readme/") ? `${name}.tsx` : join(name, "index.tsx")))) as { default: () => string };
    const svg = make();
    const { warnings } = validateSvg(svg);
    const problem = lint(svg);
    if (problem) throw new Error(`xmllint: ${problem}`);
    await Bun.write(join(OUT, `${name}.svg`), svg);
    const keyframes = svg.match(/@keyframes /g)?.length ?? 0;
    const tracks = svg.match(/animation-name:/g)?.length ?? 0;
    console.log(`✓ dist/${name}.svg  ${(svg.length / 1024).toFixed(1)} KB · ${keyframes} keyframes · ${tracks} tracks`);
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
