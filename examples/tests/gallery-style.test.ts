import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// The gallery's scenes share examples/gallery-style.ts: one canvas ratio, one set of fonts, one palette, a type floor.
const EXAMPLES = join(import.meta.dir, "..");
const SITE = join(EXAMPLES, "..", "site", "src", "examples.ts");

const names = [...readFileSync(SITE, "utf8").matchAll(/^\s+"([\w-]+)",$/gm)].map(
  (match) => match[1]!,
);

// Scenes whose material is the point: they keep their own palette. Everything else paints with var(--base0X).
const OWN_PALETTE = ["horizon", "map", "newspaper"];

// Scenes that show specimen faces or embed their own art keep their own fonts.
const OWN_FONTS = ["fonts", "map", "newspaper"];

const sources = (name: string) =>
  readdirSync(join(EXAMPLES, name))
    .filter((file) => /\.tsx?$/.test(file))
    .map((file) => [file, readFileSync(join(EXAMPLES, name, file), "utf8")] as const);

const sceneProblems = (check: (name: string, file: string, source: string) => string[]) =>
  names.flatMap((name) => sources(name).flatMap(([file, source]) => check(name, file, source)));

describe("gallery scenes follow examples/gallery-style.ts", () => {
  test("the gallery lists scenes", () => {
    expect(names.length).toBeGreaterThan(10);
  });

  test("every scene is a 16:9 canvas", () => {
    const found = names.flatMap((name) => {
      const svg = readFileSync(join(EXAMPLES, "dist", `${name}.svg`), "utf8");
      const [, w, h] = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/) ?? [];
      const ratio = Number(w) / Number(h);

      return Math.abs(ratio - 16 / 9) < 0.01 ? [] : [`${name}: ${w} x ${h} is not 16:9`];
    });

    expect(found).toEqual([]);
  });

  test("no scene writes its own palette or color scheme", () => {
    const found = sceneProblems((name, file, source) => [
      ...(/\badaptive\(|\bvariables\(|prefers-color-scheme/.test(source)
        ? [`${name}/${file}: import theme and css from examples/gallery-style.ts`]
        : []),
      ...(!OWN_PALETTE.includes(name) && /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/.test(source)
        ? [`${name}/${file}: a hex color; paint with a base16 slot from theme`]
        : []),
    ]);

    expect(found).toEqual([]);
  });

  test("scenes that follow the palette picker paint with base16 variables", () => {
    const found = names.flatMap((name) => {
      const svg = readFileSync(join(EXAMPLES, "dist", `${name}.svg`), "utf8");

      return OWN_PALETTE.includes(name) === svg.includes("var(--base0") ? [name] : [];
    });

    expect(found).toEqual([]);
  });

  test("fonts are embedded: Geist for text, JetBrains Mono for code and figures", () => {
    const found = sceneProblems((name, file, source) =>
      OWN_FONTS.includes(name) ||
      !/ui-monospace|\bGeist Mono|geistMono|IBM Plex|["']Inter["']|font-family="Inter/.test(source)
        ? []
        : [`${name}/${file}: use geist and mono from examples/gallery-style.ts`],
    );

    expect(found).toEqual([]);
  });

  test("no text under 11px and no letterspaced capitals", () => {
    const found = sceneProblems((name, file, source) => [
      ...[...source.matchAll(/fontSize(?:=\{|: )(\d+(?:\.\d+)?)\b/g)]
        .filter((match) => Number(match[1]) < 11)
        .map((match) => `${name}/${file}: font size ${match[1]} is under 11`),
      ...(/textTransform|text-transform: ?uppercase/.test(source)
        ? [`${name}/${file}: letterspaced capitals`]
        : []),
    ]);

    expect(found).toEqual([]);
  });

  test("no scene spins in", () => {
    const found = sceneProblems((name, file, source) =>
      /rotate: ?-?(?:1080|720|540)\b/.test(source) ? [`${name}/${file}: a spin-in`] : [],
    );

    expect(found).toEqual([]);
  });
});
