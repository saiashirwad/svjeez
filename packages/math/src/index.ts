import { el, rect, type Color, type Rect, type Stack, type SvgNode } from "svjeez";
import { defaultDark, tint, type Base16, type Morphable, type MorphPiece } from "svjeez/extras";
import { compile } from "./mathjax.ts";
import { apply, multiply, round, roundMatrix, scale, translate, type Matrix } from "./matrix.ts";
import { pathPoints } from "./path.ts";

export interface TexOptions {
  /** Left of the formula's box. Default 0. */
  readonly x?: number;
  /** Top of the formula's box. Default 0. */
  readonly y?: number;
  /** Pixels per em. Default 32. */
  readonly fontSize?: number;
  /** Colors the formula with its `plain` slot. Default `defaultDark`. */
  readonly theme?: Base16;
  /** Overrides the theme's plain color. `\color{…}` in the source still wins for the part it wraps. */
  readonly color?: Color;
  /** Display style: big operators stack their limits and fractions are full size. Default true. */
  readonly display?: boolean;
}

/** One glyph or bar of a formula, placed in the scene. morph() pairs glyphs by `text`. */
export interface Glyph extends MorphPiece {
  /** The character, NFKC-normalized (`𝑎` is `a`), or `rect` or `line` for a bar. */
  readonly char: string;
  /** Scale relative to `fontSize`: about 0.707 for a superscript. */
  readonly size: number;
  /** Path data in glyph units, 1000 to the em. */
  readonly d: string;
  /** Glyph units to scene pixels, absolute. `x` and `y` are its translation. */
  readonly matrix: Matrix;
  /** Set by `\color`. */
  readonly fill?: string;
  /** In scene pixels. */
  readonly bounds: Rect;
}

/** A typeset formula. Lines up with code(): `get` and `find` return rects for annotations. */
export interface Tex extends Morphable<Glyph> {
  readonly node: SvgNode;
  readonly bounds: Rect;
  readonly width: number;
  readonly height: number;
  /** Bounds of every glyph under `\cssId{id}{…}`. */
  get(id: string): Rect;
  /** Bounds of the `nth` run of consecutive glyphs spelling `text`, such as `2ab`. */
  find(text: string, nth?: number): Rect;
}

export type { Matrix };

const glyphBounds = (d: string, matrix: Matrix): Rect => {
  const points = pathPoints(d).map(([x, y]) => apply(matrix, x, y));
  const [xs, ys] = [points.map(([x]) => x), points.map(([, y]) => y)];
  const [left, top] = [Math.min(...xs), Math.min(...ys)];

  return rect(round(left), round(top), round(Math.max(...xs) - left), round(Math.max(...ys) - top));
};

/**
 * Typesets TeX into glyph paths while the scene compiles. Nothing reaches the viewer's browser but `<path>`s.
 * `x` and `y` place the top-left of the formula's box; one em is `fontSize` pixels.
 */
export function tex(source: string, options: TexOptions = {}): Tex {
  const { x = 0, y = 0, fontSize = 32, theme = defaultDark, display = true } = options;

  if (!(fontSize > 0) || !Number.isFinite(x + y))
    throw new Error(
      `tex() needs finite coordinates and a positive fontSize, got x ${x}, y ${y} and fontSize ${fontSize}.`,
    );
  const compiled = compile(source, display);
  const [minX, minY, boxW, boxH] = compiled.box;
  const k = fontSize / 1000;
  const place = multiply(translate(x, y), multiply(scale(k), translate(-minX, -minY)));

  const glyphs = compiled.marks.map((mark): Glyph => {
    const placed = multiply(place, mark.matrix);
    const size = round(mark.size);

    const matrix = roundMatrix(placed);

    return {
      // A bar's size is in its key, because morph only translates and cannot stretch one.
      text: `${mark.key}@${size}`,
      char: mark.char,
      size,
      d: mark.d,
      matrix,
      x: matrix[4],
      y: matrix[5],
      fill: mark.fill,
      id: mark.id,
      bounds: glyphBounds(mark.d, matrix),
    };
  });

  const ink = options.color ?? tint(theme, "plain");

  const draw = (glyph: Glyph, animation?: Stack<"x" | "y" | "opacity">): SvgNode =>
    el.g(
      { animation },
      el.path({
        d: glyph.d,
        transform: `matrix(${glyph.matrix.join(" ")})`,
        // SAFETY: the fill is a CSS color that the author wrote in `\color{…}`, which MathJax passes through unchecked.
        fill: (glyph.fill as Color | undefined) ?? ink,
      }),
    );

  const bounds = rect(x, y, round(boxW * k), round(boxH * k));

  const get = (id: string): Rect => {
    const named = glyphs.filter((g) => g.id === id);

    if (named.length === 0) throw new Error(`tex.get() found no part named ${JSON.stringify(id)}.`);

    return named.map((g) => g.bounds).reduce((a, b) => a.union(b));
  };

  const spelled = glyphs.map((g) => g.char).join("");

  const starts = [0];

  for (const g of glyphs) starts.push(starts.at(-1)! + g.char.length);

  const find = (needle: string, nth = 1): Rect => {
    let seen = 0;

    for (
      let pos = needle ? spelled.indexOf(needle) : -1;
      pos >= 0;
      pos = spelled.indexOf(needle, pos + 1)
    ) {
      const [first, last] = [starts.indexOf(pos), starts.indexOf(pos + needle.length)];

      if (first < 0 || last < 0 || ++seen !== nth) continue;

      return glyphs
        .slice(first, last)
        .map((g) => g.bounds)
        .reduce((a, b) => a.union(b));
    }

    throw new Error(`tex.find() found ${seen} of ${JSON.stringify(needle)}, not ${nth}.`);
  };

  return {
    node: el.g(
      {},
      glyphs.map((g) => draw(g)),
    ),
    words: glyphs,
    bounds,
    width: bounds.w,
    height: bounds.h,
    get,
    find,
    draw,
  };
}
