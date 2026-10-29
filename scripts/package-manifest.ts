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
}

export const ROOT = join(import.meta.dirname, "..");

export const read = <Target = unknown>(dir: string): Manifest<Target> =>
  JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));

/**
 * Writes the workspace package at `dir` into `out` for npm: no private flag, scripts or dev dependencies, each
 * `workspace:` range as the caret of the version that package has now, and `exports` as the build laid them out.
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

  const dependencies = Object.fromEntries(
    Object.entries(manifest.dependencies ?? {}).map(([name, range]) => [
      name,
      range.startsWith("workspace:") ? `^${versions.get(name)}` : range,
    ]),
  );

  writeFileSync(
    join(out, "package.json"),
    `${JSON.stringify({ ...manifest, exports, ...(manifest.dependencies && { dependencies }) }, null, 2)}\n`,
  );

  copyFileSync(join(dir, "README.md"), join(out, "README.md"));

  copyFileSync(join(ROOT, "LICENSE"), join(out, "LICENSE"));
};
