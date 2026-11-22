import { copyFileSync, existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface Manifest<Target = unknown> {
  name: string;
  version: string;
  private?: boolean;
  scripts?: Record<string, string>;
  devDependencies?: Record<string, string>;
  exports?: Record<string, Target>;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

const RANGED = ["dependencies", "peerDependencies", "optionalDependencies"] as const;

export const publishedRanges = <M extends Manifest>(
  manifest: M,
  versions: ReadonlyMap<string, string>,
): M => {
  const out = { ...manifest };

  for (const field of RANGED) {
    const ranges = manifest[field];

    if (ranges)
      out[field] = Object.fromEntries(
        Object.entries(ranges).map(([name, range]) => {
          if (!range.startsWith("workspace:")) return [name, range];
          const version = versions.get(name);

          if (version === undefined)
            throw new Error(
              `${manifest.name} has ${name} at ${range}, which is not a workspace package.`,
            );

          return [name, `^${version}`];
        }),
      );
  }

  return out;
};

export const ROOT = join(import.meta.dirname, "..");

export const read = <Target = unknown>(dir: string): Manifest<Target> =>
  JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));

// Every folder under packages/ with a package.json, released or not. A folder left behind with only node_modules isn't one.
export const packageDirs = (): string[] =>
  readdirSync(join(ROOT, "packages"))
    .map((name) => join(ROOT, "packages", name))
    .filter((dir) => existsSync(join(dir, "package.json")));

// Every package shares one version, so they release together.
export const sharedVersion = (dirs: readonly string[]): string => {
  const versions = new Set(dirs.map((dir) => read(dir).version));
  const [version] = versions;

  if (versions.size !== 1 || version === undefined)
    throw new Error(
      `The packages should share one version, but they have ${[...versions].join(", ")}.`,
    );

  return version;
};

const VERSION = /^(\d+)\.(\d+)\.(\d+)(?:-next\.(\d+))?$/;

// next: the next prerelease. minor, major: the first prerelease of a new line. stable: drops the prerelease.
// Anything else must be an exact version.
export const nextVersion = (current: string, bump: string): string => {
  const match = VERSION.exec(current);

  if (!match) throw new Error(`${current} isn't a version like 0.8.0 or 0.8.0-next.1.`);
  const [major = 0, minor = 0, patch = 0] = match.slice(1, 4).map(Number);
  const next = match[4];

  if (bump === "next")
    return next === undefined
      ? `${major}.${minor}.${patch + 1}-next.0`
      : `${major}.${minor}.${patch}-next.${Number(next) + 1}`;

  if (bump === "minor") return `${major}.${minor + 1}.0-next.0`;

  if (bump === "major") return `${major + 1}.0.0-next.0`;

  if (bump === "stable") {
    if (next === undefined) throw new Error(`${current} is already stable.`);

    return `${major}.${minor}.${patch}`;
  }

  if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(bump))
    throw new Error(`${bump} isn't next, minor, major, stable or a version like 0.8.1.`);

  return bump;
};

export const writeManifest = <Target>(
  dir: string,
  out: string,
  exports: Record<string, Target>,
) => {
  const versions = new Map(
    packageDirs().map((dir) => {
      const { name: published, version } = read(dir);

      return [published, version];
    }),
  );

  const { private: _, scripts: __, devDependencies: ___, ...manifest } = read(dir);

  writeFileSync(
    join(out, "package.json"),
    `${JSON.stringify({ ...publishedRanges(manifest, versions), exports }, null, 2)}\n`,
  );

  copyFileSync(join(dir, "README.md"), join(out, "README.md"));

  copyFileSync(join(ROOT, "LICENSE"), join(out, "LICENSE"));
};
