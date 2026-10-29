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

  return load(`${file}?${Date.now()}`);
};

const load = async (specifier: string): Promise<Build> => {
  const { default: build }: { default: unknown } = await import(specifier);

  if (!(build instanceof Function))
    throw new Error(`${specifier} has no default export that builds a scene.`);

  return () => String(build());
};

const SCENE = /^examples\/(?:(?:site|readme)\/[^/]+|[^/]+\/index)\.tsx$/;

/** Scene modules that differ between `ref` and this checkout, including uncommitted edits, as repo-relative paths. */
export const changedScenes = (ref: string): string[] => {
  const diff = Bun.spawnSync(
    ["git", "diff", "--name-only", "--diff-filter=M", ref, "--", "examples"],
    { cwd: REPO },
  );

  if (diff.exitCode !== 0)
    throw new Error(`git diff ${ref} failed: ${diff.stderr.toString().trim()}`);

  return diff.stdout
    .toString()
    .split("\n")
    .filter((path) => SCENE.test(path));
};

/** The default export of `path` in this checkout. */
export const here = (path: string): Promise<Build> => load(join(REPO, path));

/** Render a scene with its own prefix, ready for `nest()`. */
export const renderAs = (prefix: string, build: Build): string => prefixed(prefix, build);
