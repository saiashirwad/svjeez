import { google } from "@svjeez/fonts";
import { init, parse } from "es-module-lexer";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { Library } from "../src/sandbox/library";

/** What a scene may import, each prebuilt as one module of the map. */
const SPECIFIERS = [
  "svjeez",
  "svjeez/jsx-runtime",
  "svjeez/geometry",
  "svjeez/params",
  "@svjeez/charts",
  "@svjeez/code",
  "@svjeez/code/palettes",
  "@svjeez/diagrams",
  "@svjeez/geo",
  "@svjeez/icons/lucide",
  "@svjeez/icons/tabler",
  "@svjeez/math",
  "@svjeez/mermaid",
  "d3-geo",
];

/** world-atlas's TopoJSON, imported by a scene as JSON. The 10m files are too large to send with every compile. */
const ATLAS = ["countries-110m", "countries-50m", "land-110m", "land-50m"];

/** The faces the @svjeez/fonts stand-in serves, since a scene has no network. */
const FACES = [
  ["Inter", [400, 500, 600, 700]],
  ["Geist", [400, 500, 600, 700]],
  ["Geist Mono", [400, 500]],
  ["JetBrains Mono", [400]],
  ["Source Serif 4", [400, 600]],
] as const;

const flat = (specifier: string) => specifier.replace(/^@/, "").replaceAll("/", "--");

/**
 * The library a scene imports, built into `dir`: one entry per specifier with the chunks they share, each chunk's
 * relative imports made absolute (a module map resolves a bare path against its importer's folder), and the imports
 * of every module, so a compile sends only what its scene reaches.
 */
const modules = async (dir: string) => {
  const entries = join(dir, "entries");

  await rm(dir, { recursive: true, force: true });
  await mkdir(entries, { recursive: true });

  for (const specifier of SPECIFIERS)
    await writeFile(
      join(entries, `${flat(specifier)}.ts`),
      `export * from ${JSON.stringify(specifier)};\n`,
    );

  const result = await Bun.build({
    entrypoints: SPECIFIERS.map((specifier) => join(entries, `${flat(specifier)}.ts`)),
    outdir: join(dir, "out"),
    target: "browser",
    format: "esm",
    splitting: true,
    minify: true,
    conditions: ["@svjeez/source"],
    naming: { entry: "[name].js", chunk: "chunk-[hash].js" },
    throw: false,
  });

  if (!result.success) throw new AggregateError(result.logs, "The library did not build.");

  await init();

  const named = (file: string) =>
    file.startsWith("chunk-") ? file : SPECIFIERS.find((s) => `${flat(s)}.js` === file)!;

  const code: Record<string, string> = {};
  const imports: Record<string, string[]> = {};

  for (const file of await readdir(join(dir, "out"))) {
    const source = await readFile(join(dir, "out", file), "utf8");
    const relative = parse(source)[0].filter((found) => found.specifier?.startsWith("./"));
    let out = source;

    // Back to front, so earlier positions stay valid.
    for (const { start, end } of relative.toReversed())
      out = `${out.slice(0, start)}${out.slice(start, end).replace("./", "/")}${out.slice(end)}`;

    code[named(file)] = out;
    imports[named(file)] = relative.map((found) => found.specifier!.slice(2));
  }

  return { code, imports };
};

/** world-atlas's files as JSON text, parsed in the Worker only when a scene imports one. */
const atlas = async () =>
  Object.fromEntries(
    await Promise.all(
      ATLAS.map(async (name) => [
        `world-atlas/${name}.json`,
        await readFile(Bun.resolveSync(`world-atlas/${name}.json`, import.meta.dir), "utf8"),
      ]),
    ),
  );

/**
 * Every face as base64. @svjeez/fonts downloads each once into its disk cache, which `cache` points at, and the file
 * is read from there.
 */
const fonts = async (cache: string) => {
  process.env.SVJEEZ_FONTS_CACHE = cache;

  const faces: Record<string, string> = {};

  for (const [family, weights] of FACES)
    for (const weight of weights) {
      await google(family, { weight });

      const file = join(cache, `${family.replaceAll(" ", "-")}-${weight}-normal.ttf`);

      faces[`${family} ${weight}`] = (await readFile(file)).toString("base64");
    }

  return faces;
};

/** The skill's text: SKILL.md, and the references and examples the model may read. */
const skill = async () => {
  const root = join(import.meta.dir, "../../packages/svjeez/skills/svjeez");

  const paths = [
    "SKILL.md",
    ...(await readdir(join(root, "references"))).toSorted().map((file) => `references/${file}`),
    ...(await readdir(join(root, "examples"))).toSorted().map((file) => `examples/${file}`),
  ];

  return Object.fromEntries(
    await Promise.all(paths.map(async (path) => [path, await readFile(join(root, path), "utf8")])),
  );
};

/**
 * Builds everything the sandbox and the prompt need into one value, written into the Worker as a module. `dir` is
 * scratch space for the library build; `fontCache` keeps the downloaded faces between builds.
 */
export const library = async (dir: string, fontCache: string): Promise<Library> => {
  const [{ code, imports }, json, faces, files] = await Promise.all([
    modules(dir),
    atlas(),
    fonts(fontCache),
    skill(),
  ]);

  return { code, imports, json, fonts: faces, skill: files };
};
