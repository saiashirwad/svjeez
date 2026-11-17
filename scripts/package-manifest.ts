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
