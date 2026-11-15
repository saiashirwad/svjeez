// Checks that a @svjeez/dom recording draws what Chromium painted: `bun run fidelity [name ...]` reads the examples'
// recordings again with screenshots, draws every state of every card at rest and pixel-diffs the two.
// `--dir <folder>` checks screenshots a `snapshots({ screenshots })` already wrote, whatever made them.
import { readdir, readFile, rm } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fidelity, type StateFidelity } from "@svjeez/dom/fidelity";

const ROOT = join(import.meta.dir, "..");
const WORK = join(ROOT, ".fidelity");

const flags = new Map<string, string>();
const wanted: string[] = [];
const argv = process.argv.slice(2);

for (let i = 0; i < argv.length; i++) {
  const arg = argv[i]!;

  if (arg.startsWith("--")) flags.set(arg.slice(2), argv[++i] ?? "");
  else wanted.push(arg);
}

const options = {
  out: join(WORK, "diffs"),
  tolerance: flags.has("tolerance") ? Number(flags.get("tolerance")) : undefined,
  threshold: flags.has("threshold") ? Number(flags.get("threshold")) : undefined,
};

/** Examples that use @svjeez/dom, as `bun run build` names them. */
const users = async (): Promise<string[]> => {
  const names = [...new Bun.Glob("**/*.tsx").scanSync(ROOT)].filter(
    (f) => !f.startsWith("node_modules") && !f.startsWith("dist"),
  );

  const found: string[] = [];

  for (const file of names)
    if ((await readFile(join(ROOT, file), "utf8")).includes("@svjeez/dom")) {
      const name = file.replace(/\.tsx$/, "");

      if (name.endsWith("/index")) found.push(dirname(name));
      else if (/^(readme|site)\//.test(name)) found.push(name);
    }

  return found.sort();
};

const dirs: string[] = [];

if (flags.has("dir")) {
  dirs.push(resolve(flags.get("dir")!));
} else {
  const shots = join(WORK, "shots");

  await rm(shots, { recursive: true, force: true });
  process.env.SVJEEZ_DOM_SHOTS = shots;

  for (const name of wanted.length > 0 ? wanted : await users()) {
    const before = new Set(await readdir(shots).catch(() => []));

    await import(join(ROOT, name.includes("/") ? `${name}.tsx` : join(name, "index.tsx")));

    for (const dir of await readdir(shots)) if (!before.has(dir)) dirs.push(join(shots, dir));
  }
}

const pct = (n: number) => `${(n * 100).toFixed(2)}%`;
let failed = 0;

for (const dir of dirs) {
  const results: StateFidelity[] = await fidelity(dir, options);

  console.log(`\n${basename(dir)}`);
  console.log("  card  state             scheme  time     painted  mismatch");

  for (const r of results) {
    failed += r.failed ? 1 : 0;

    console.log(
      `  ${String(r.card).padEnd(5)} ${r.name.padEnd(17)} ${r.scheme.padEnd(6)}  ${r.time.toFixed(2).padStart(5)}s  ${String(r.painted).padStart(7)}  ${pct(r.mismatch).padStart(7)}${r.failed ? `  FAIL ${r.image ?? ""}` : ""}`,
    );
  }
}

console.log(failed > 0 ? `\n${failed} state(s) over the threshold` : "\nall states match");

process.exit(failed > 0 ? 1 : 0);
