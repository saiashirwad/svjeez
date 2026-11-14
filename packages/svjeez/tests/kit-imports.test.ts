import { expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";

// The diagrams, the field, calculus and axes kits and the voxel scene will each become a package. A package can import
// only what svjeez exports, so until then these files may use core internals only by names the entries already publish.
const src = join(import.meta.dir, "../src");

const read = (file: string) => readFileSync(join(src, file), "utf8");

const files = (dir: string): string[] =>
  readdirSync(join(src, dir), { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? files(join(dir, entry.name)) : [join(dir, entry.name)],
  );

/** Modules that move together, so they can keep importing each other. */
const kit = [
  /^extras\/diagrams\//,
  /^extras\/(field|calculus|axes)$/,
  /^(voxel|texture|space)$/,
  /^layout\/(layered|lanes|sequence|tree|contour|field|route)$/,
];

const inKit = (module: string) => kit.some((pattern) => pattern.test(module));

const stripped = (file: string) => file.replace(/\.tsx?$/, "");

const exported = (file: string): Set<string> => {
  const names = new Set<string>();
  const blocks = read(file).matchAll(/export\s+(?:type\s+)?\{([^}]*)\}/g);

  for (const [, list = ""] of blocks)
    for (const item of list.split(",")) {
      const name = item
        .trim()
        .replace(/^type\s+/, "")
        .split(/\s+as\s+/)
        .at(-1);

      if (name) names.add(name);
    }

  return names;
};

const imports = (file: string) =>
  [...read(file).matchAll(/(?:import|export)\s+(?:type\s+)?\{([^}]*)\}\s+from\s+"(\.[^"]*)"/g)].map(
    ([, list = "", from = ""]) => ({
      from: stripped(relative(".", join(dirname(file), from))),
      names: list
        .split(",")
        .map(
          (item) =>
            item
              .trim()
              .replace(/^type\s+/, "")
              .split(/\s+as\s+/)[0]!,
        )
        .filter(Boolean),
    }),
  );

const entries = ["index.ts", "frames.ts", "page.ts", "params.ts", "jsx-runtime.ts"];
const published = new Set(entries.flatMap((entry) => [...exported(entry)]));

const scanned = [
  ...files("extras/diagrams"),
  "extras/field.ts",
  "extras/calculus.ts",
  "extras/axes.ts",
  "voxel.ts",
  "texture.ts",
  "space.ts",
];

test("the kit files exist", () => {
  for (const file of scanned) expect(existsSync(join(src, file))).toBe(true);
  expect(statSync(join(src, "extras/diagrams")).isDirectory()).toBe(true);
});

test("the kits import core internals only by names svjeez publishes", () => {
  const private_: string[] = [];

  for (const file of scanned)
    for (const { from, names } of imports(file)) {
      if (inKit(from)) continue;

      for (const name of names)
        if (!published.has(name)) private_.push(`${file} imports ${name} from ${from}`);
    }

  expect(private_).toEqual([]);
});
