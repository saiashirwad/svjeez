import { readFile } from "node:fs/promises";

type Point = readonly [x: number, y: number];

interface Glyph {
  readonly advance: number;
  /** Centerlines in font units, y up from the baseline. */
  readonly lines: readonly (readonly Point[])[];
}

/** A single-line font read from an SVG font (Hershey, EMS): each glyph is a centerline to stroke, not an outline. */
export interface StrokeFont {
  /** The centerlines of `text` as path data, from the left end of the baseline at `x`, `y`, one `M` per stroke. */
  path(
    text: string,
    options: { readonly size: number; readonly x?: number; readonly y?: number },
  ): string;
}

const attributes = (tag: string): Map<string, string> =>
  new Map(
    [...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, name, value]) => [
      name!,
      value!.replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
        String.fromCodePoint(parseInt(hex, 16)),
      ),
    ]),
  );

/** Points along a cubic, one about every 3 font units. */
const cubic = (p0: Point, p1: Point, p2: Point, p3: Point): Point[] => {
  const hull =
    Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) +
    Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) +
    Math.hypot(p3[0] - p2[0], p3[1] - p2[1]);

  const count = Math.max(2, Math.min(64, Math.ceil(hull / 3)));

  return Array.from({ length: count }, (_, i) => {
    const t = (i + 1) / count;
    const u = 1 - t;
    const [a, b, c, d] = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];

    return [
      a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
      a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1],
    ];
  });
};

/** A glyph's `d`, which these fonts write with absolute M, L and C only, as polylines. */
const polylines = (d: string): Point[][] => {
  const lines: Point[][] = [];

  for (const [, command, args] of d.matchAll(/([MLC])([^MLC]*)/g)) {
    const n = (args!.match(/-?[\d.]+(?:e-?\d+)?/g) ?? []).map(Number);
    const pairs: Point[] = [];

    for (let i = 0; i + 1 < n.length; i += 2) pairs.push([n[i]!, n[i + 1]!]);

    if (command === "M") lines.push([pairs[0]!, ...pairs.slice(1)]);
    else if (command === "L") lines.at(-1)!.push(...pairs);
    else
      for (let i = 0; i + 2 < pairs.length; i += 3) {
        const line = lines.at(-1)!;
        line.push(...cubic(line.at(-1)!, pairs[i]!, pairs[i + 1]!, pairs[i + 2]!));
      }
  }

  return lines.filter((line) => line.length > 1);
};

const round = (n: number) => Math.round(n * 100) / 100;

/** A polyline as a smooth curve through its points, keeping the corners where it doubles back sharp. */
const smooth = (points: readonly Point[]): string => {
  const at = ([x, y]: Point) => `${round(x)} ${round(y)}`;

  if (points.length < 3) return `M${points.map(at).join("L")}`;

  const tangent = (i: number): Point => {
    if (i === 0 || i === points.length - 1) return [0, 0];
    const [a, b, c] = [points[i - 1]!, points[i]!, points[i + 1]!];

    if ((b[0] - a[0]) * (c[0] - b[0]) + (b[1] - a[1]) * (c[1] - b[1]) < 0) return [0, 0];

    return [(c[0] - a[0]) / 6, (c[1] - a[1]) / 6];
  };

  let d = `M${at(points[0]!)}`;

  for (let i = 1; i < points.length; i++) {
    const [a, b] = [points[i - 1]!, points[i]!];
    const [ta, tb] = [tangent(i - 1), tangent(i)];
    d += `C${at([a[0] + ta[0], a[1] + ta[1]])} ${at([b[0] - tb[0], b[1] - tb[1]])} ${at(b)}`;
  }

  return d;
};

/** Reads an SVG font's markup. */
export const strokeFont = (markup: string): StrokeFont => {
  const font = attributes(/<font\b[^>]*>/.exec(markup)?.[0] ?? "");
  const face = attributes(/<font-face\b[^>]*>/.exec(markup)?.[0] ?? "");
  const em = Number(face.get("units-per-em") ?? 1000);
  const fallback = Number(font.get("horiz-adv-x") ?? em / 2);
  const glyphs = new Map<string, Glyph>();

  for (const [tag] of markup.matchAll(/<glyph\b[^>]*>/g)) {
    const glyph = attributes(tag);
    const char = glyph.get("unicode");

    if (char === undefined || [...char].length !== 1) continue;
    const d = glyph.get("d");
    glyphs.set(char, {
      advance: Number(glyph.get("horiz-adv-x") ?? fallback),
      lines: d ? polylines(d) : [],
    });
  }

  return {
    path: (text, { size, x = 0, y = 0 }) => {
      const scale = size / em;
      let pen = x;
      let d = "";

      for (const char of text) {
        const { advance, lines } = glyphs.get(char) ?? { advance: fallback, lines: [] };
        const left = pen;

        for (const line of lines)
          d += smooth(line.map(([gx, gy]) => [left + gx * scale, y - gy * scale]));
        pen += advance * scale;
      }

      return d;
    },
  };
};

/** Reads an SVG font from a file. */
strokeFont.load = async (url: URL): Promise<StrokeFont> => strokeFont(await readFile(url, "utf8"));
