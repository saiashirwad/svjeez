// What every workspace package's build writes into package-dist/ beside its code: the package.json npm publishes, the
// README and the LICENSE.
import { copyFileSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
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

/** The fields that name other packages by range, and so can hold a `workspace:` one. */
const RANGED = ["dependencies", "peerDependencies", "optionalDependencies"] as const;

/** `manifest` with each `workspace:` range, in any of the fields npm installs from, as the caret of that package's version. */
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

/**
 * Writes the workspace package at `dir` into `out` for npm: no private flag, scripts or dev dependencies, each
 * `workspace:` range, in dependencies, peer or optional, as the caret of the version that package has now, and `exports` as the build laid them out.
 */
export const writeManifest = <Target>(
  dir: string,
  out: string,
  exports: Record<string, Target>,
) => {
  const versions = new Map(
    readdirSync(join(ROOT, "packages")).map((name) => {
      const { name: published, version } = read(join(ROOT, "packages", name));

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
