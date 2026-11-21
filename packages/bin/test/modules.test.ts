import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MODULES, PACKAGES } from "../src/modules";

const ROOT = join(import.meta.dir, "../../..");

type Target = string | { readonly "@svjeez/source"?: string };

interface Manifest {
  readonly exports: Readonly<Record<string, Target>>;
}

const isPath = (target: Target): target is string => typeof target === "string";

const exportsOf = (name: string): string[] => {
  const manifest: Manifest = JSON.parse(
    readFileSync(join(ROOT, "packages", name, "package.json"), "utf8"),
  );

  const scope = name === "svjeez" ? "svjeez" : `@svjeez/${name}`;

  return Object.entries(manifest.exports)
    .filter(([, target]) =>
      /\.tsx?$/.test(isPath(target) ? target : (target["@svjeez/source"] ?? "")),
    )
    .map(([key]) => (key === "." ? scope : `${scope}/${key.slice(2)}`));
};

test("the binary carries every code export of every package it carries, and nothing else", () => {
  expect([...MODULES.keys()].sort()).toEqual(PACKAGES.flatMap(exportsOf).sort());
});
