// Scene modules as they stand at a git ref, so a reel can render main's copy of a scene beside this branch's.
import { mkdir } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { prefixed } from "svjeez";

const REPO = resolve(import.meta.dir, "../..");
const CACHE = join(import.meta.dir, ".refs");

type Build = () => string;

/**
 * The default export of `path` (relative to the repo) at `ref`. The file is written under `.refs/`, with its relative
 * imports pointed back at this checkout, so only the scene file itself is taken from the ref.
 */
export const atRef = async (ref: string, path: string): Promise<Build> => {
  const show = Bun.spawnSync(["git", "show", `${ref}:${path}`], { cwd: REPO });

  if (show.exitCode !== 0)
    throw new Error(`git show ${ref}:${path} failed: ${show.stderr.toString().trim()}`);
  const home = dirname(join(REPO, path));
  const file = join(CACHE, ref.replace(/[^\w.-]/g, "_"), path);
  await mkdir(dirname(file), { recursive: true });
  const from = dirname(file);
  const source = show.stdout
    .toString()
    .replace(/(from\s+|import\s*\(\s*)"(\.\.?\/[^"]+)"/g, (_, lead: string, spec: string) => {
      const target = relative(from, resolve(home, spec));
      return `${lead}"${target.startsWith(".") ? target : `./${target}`}"`;
    });
  await Bun.write(file, source);

  return (await import(`${file}?${Date.now()}`)).default as Build;
};

/** The default export of `path` in this checkout. */
export const here = async (path: string): Promise<Build> =>
  (await import(join(REPO, path))).default as Build;

/** Render a scene with its own prefix, ready for `nest()`. */
export const renderAs = (prefix: string, build: Build): string => prefixed(prefix, build);
