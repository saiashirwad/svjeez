import {
  ease,
  el,
  motion,
  rect,
  type Color,
  type Rect,
  type Span,
  type Stack,
  type SvgNode,
} from "svjeez";
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
  /** The point of the box that `x` and `y` place, as fractions of its width and height. `[0.5, 0.5]` centers the formula on `x`, `y`. Default `[0, 0]`, the top-left. */
  readonly anchor?: readonly [number, number];
}

export interface WriteOptions {
  /** Each glyph's outline draws, then fills, this long. Default 0.6. */
  readonly stroke?: number;
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
  /** The formula written on in reading order during `span`: each glyph's outline draws, then fills. It stays once written. */
  write(span: Span, options?: WriteOptions): SvgNode;
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
  const { fontSize = 32, theme = defaultDark, display = true, anchor = [0, 0] } = options;

  if (
    !(fontSize > 0) ||
    !Number.isFinite((options.x ?? 0) + (options.y ?? 0) + anchor[0] + anchor[1])
  )
    throw new Error(
      `tex() needs finite coordinates and anchor and a positive fontSize, got x ${options.x}, y ${options.y}, anchor [${anchor.join(", ")}] and fontSize ${fontSize}.`,
    );
  const compiled = compile(source, display);
  const [minX, minY, boxW, boxH] = compiled.box;
  const k = fontSize / 1000;
  const x = (options.x ?? 0) - anchor[0] * boxW * k;
  const y = (options.y ?? 0) - anchor[1] * boxH * k;
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

  const write = ({ at, over }: Span, { stroke = 0.6 }: WriteOptions = {}): SvgNode => {
    if (!(over >= 0 && stroke > 0))
      throw new Error(
        `tex.write() needs a non-negative span and a positive stroke time, got over ${over} and stroke ${stroke}.`,
      );
    const step = glyphs.length > 1 ? Math.max(0, over - stroke) / (glyphs.length - 1) : 0;

    return el.g(
      {},
      glyphs.map((g, i) => {
        const start = at + i * step;
        const paint = (g.fill as Color | undefined) ?? ink;
        const transform = `matrix(${g.matrix.join(" ")})`;

        // The outline is in glyph units, so its width undoes the matrix's scale to stay near 1px on screen.
        return el.g({}, [
          el.path({
            d: g.d,
            transform,
            fill: "none",
            stroke: paint,
            strokeWidth: round(1.2 / Math.hypot(g.matrix[0], g.matrix[1])),
            strokeLinejoin: "round",
            animation: motion({ draw: 0, opacity: 1 })
              .at(start)
              .to({ draw: 1 }, stroke * 0.7, ease.inOut)
              .to({ opacity: 0 }, stroke * 0.3),
          }),
          el.path({
            d: g.d,
            transform,
            fill: paint,
            animation: motion({ opacity: 0 })
              .at(start + stroke * 0.5)
              .to({ opacity: 1 }, stroke * 0.5),
          }),
        ]);
      }),
    );
  };

  return {
    node: el.g(
      {},
      glyphs.map((g) => draw(g)),
    ),
    write,
    words: glyphs,
    bounds,
    width: bounds.w,
    height: bounds.h,
    get,
    find,
    draw,
  };
}

export {
  epicycles,
  type Epicycles,
  type EpicyclesOptions,
  type EpicyclesSource,
  type Outline,
} from "./epicycles.ts";

export { derive, type Derivation, type DeriveOptions, type DeriveStep } from "./derive.ts";

export { readout, type Readout, type ReadoutOptions, type ReadoutValue } from "./readout.ts";

export {
  construct,
  type AngleOptions,
  type BisectOptions,
  type CircleOptions,
  type ConstructOptions,
  type Construction,
  type GeoCircle,
  type GeoCurve,
  type GeoLine,
  type GeoPoint,
  type IntersectOptions,
  type LineOptions,
  type Look,
  type Pace,
  type PointOptions,
  type PolygonOptions,
  type SegmentOptions,
  type SettleOptions,
  type TickOptions,
  type Timing,
} from "./construct.ts";

export {
  plane,
  type LabelOptions as PlaneLabelOptions,
  type LineOptions as SpanOptions,
  type Plane,
  type PlaneFunction,
  type PlaneMatrix,
  type PlaneOptions,
  type PolygonOptions as PlanePolygonOptions,
  type StepOptions,
  type Vec2,
  type VectorOptions,
} from "./plane.ts";
