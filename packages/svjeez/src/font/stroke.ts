import { flatten } from "../ink/path";
import type { Point } from "../layout/box";
import type { GlyphPath, PathOptions, TextPath } from "./font";
import { readSource } from "../source";

/**
 * A single-line font: each glyph is a centerline, as a plotter or an engraver draws it, instead of a filled outline.
 * Read from an SVG font, the format Hershey and EMS fonts ship in. Its paths suit `<Ink>`, which inks a centerline
 * with a pen, brush or nib, and `draw`, which writes it on in order, so text can appear as handwriting.
 */
export interface StrokeFont {
  readonly family: string;
  readonly unitsPerEm: number;
  /** Whether the font draws this character. */
  has(char: string): boolean;
  /** Advance width of `text` in px. */
  measure(text: string, size: number): number;
  /** The text's centerlines in scene coordinates, one glyph after another from the baseline's left end. */
  path(text: string, options: PathOptions): TextPath;
}

interface Glyph {
  readonly advance: number;
  readonly lines: readonly (readonly { readonly x: number; readonly y: number }[])[];
}

const ENTITIES = new Map([
  ["amp", "&"],
  ["lt", "<"],
  ["gt", ">"],
  ["quot", '"'],
  ["apos", "'"],
]);

const decode = (value: string): string =>
  value.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (whole, name: string) =>
    name[0] === "#"
      ? String.fromCodePoint(
          name[1]?.toLowerCase() === "x" ? parseInt(name.slice(2), 16) : Number(name.slice(1)),
        )
      : (ENTITIES.get(name) ?? whole),
  );

const attributes = (tag: string): Map<string, string> =>
  new Map(
    [...tag.matchAll(/([\w:-]+)\s*=\s*("([^"]*)"|'([^']*)')/g)].map((m) => [
      m[1]!,
      decode(m[3] ?? m[4] ?? ""),
    ]),
  );

const number = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);

  return value !== undefined && Number.isFinite(parsed) ? parsed : fallback;
};

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * A curve through every point: Catmull-Rom, as cubic Béziers. Single-line fonts store their strokes as short polylines,
 * which a wide nib would show as facets; a corner sharper than a right angle stays a corner.
 */
const smooth = (points: readonly Point[]): string => {
  const at = (p: Point) => `${round(p.x)} ${round(p.y)}`;

  if (points.length < 3) return `M${points.map(at).join("L")}`;

  const sharp = (i: number) => {
    const [a, b, c] = [points[i - 1]!, points[i]!, points[i + 1]!];

    return (b.x - a.x) * (c.x - b.x) + (b.y - a.y) * (c.y - b.y) < 0;
  };

  const tangent = (i: number): Point => {
    if (i === 0 || i === points.length - 1 || sharp(i)) return { x: 0, y: 0 };

    return {
      x: (points[i + 1]!.x - points[i - 1]!.x) / 6,
      y: (points[i + 1]!.y - points[i - 1]!.y) / 6,
    };
  };

  let d = `M${at(points[0]!)}`;

  for (let i = 1; i < points.length; i++) {
    const [a, b] = [points[i - 1]!, points[i]!];
    const [ta, tb] = [tangent(i - 1), tangent(i)];
    d += `C${at({ x: a.x + ta.x, y: a.y + ta.y })} ${at({ x: b.x - tb.x, y: b.y - tb.y })} ${at(b)}`;
  }

  return d;
};

const isMarkup = (markup: string | Uint8Array | ArrayBuffer): markup is string =>
  typeof markup === "string";

/** Read an SVG font's markup. Glyph coordinates are y-up from the baseline, as SVG fonts store them. */
export const strokeFont = Object.assign(
  (markup: string | Uint8Array | ArrayBuffer): StrokeFont => {
    const text = isMarkup(markup) ? markup : new TextDecoder().decode(markup);
    const fontTag = /<font\b[^>]*>/.exec(text)?.[0];

    if (!fontTag) throw new Error("strokeFont() reads SVG fonts, and this has no <font> element.");
    const font = attributes(fontTag);
    const face = attributes(/<font-face\b[^>]*>/.exec(text)?.[0] ?? "");
    const unitsPerEm = number(face.get("units-per-em"), 1000);
    const fallback = number(font.get("horiz-adv-x"), unitsPerEm / 2);
    const glyphs = new Map<string, Glyph>();

    for (const [tag] of text.matchAll(/<glyph\b[^>]*>/g)) {
      const glyph = attributes(tag);
      const char = glyph.get("unicode");

      if (char === undefined || [...char].length !== 1) continue;
      const d = glyph.get("d");
      glyphs.set(char, {
        advance: number(glyph.get("horiz-adv-x"), fallback),
        lines: d ? flatten(d).map((line) => line.points) : [],
      });
    }

    if (glyphs.size === 0)
      throw new Error("strokeFont() found no single-character <glyph> elements.");
    const glyphOf = (char: string): Glyph => glyphs.get(char) ?? { advance: fallback, lines: [] };

    return {
      family: face.get("font-family") ?? font.get("id") ?? "stroke font",
      unitsPerEm,
      has: (char) => glyphs.has(char),
      measure: (line, size) =>
        [...line].reduce((sum, char) => sum + glyphOf(char).advance, 0) * (size / unitsPerEm),
      path: (line, { size, x = 0, y = 0 }): TextPath => {
        if (!(size > 0) || !Number.isFinite(x + y))
          throw new Error(
            `path() needs a positive size and finite coordinates, got size ${size} at ${x}, ${y}.`,
          );
        const scale = size / unitsPerEm;
        let pen = x;

        const placed = [...line].map((char): GlyphPath => {
          const glyph = glyphOf(char);

          const d = glyph.lines
            .map((points) =>
              smooth(points.map((p) => ({ x: pen + p.x * scale, y: y - p.y * scale }))),
            )
            .join("");

          const out = { char, d, x: pen, advance: glyph.advance * scale };
          pen += out.advance;

          return out;
        });

        return { d: placed.map((g) => g.d).join(""), width: pen - x, glyphs: placed };
      },
    };
  },
  {
    /** Read an SVG font from an http(s) URL with fetch, or from a path or file: URL on disk. */
    load: async (source: string | URL): Promise<StrokeFont> => strokeFont(await readSource(source)),
  },
);
