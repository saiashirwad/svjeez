import { hexBytes, hexOf, type Hex } from "../model/color";
import { ringsOf } from "../model/paths";
import type { Box, Contour, Cubic, Geometry as Outline, Rgba, Vec } from "../model/ir";
import type { Gradient } from "./paint";

export type { Hex };

const lerp = (a: Vec, b: Vec, u: number): Vec => [
  a[0] + (b[0] - a[0]) * u,
  a[1] + (b[1] - a[1]) * u,
];

const straight = (from: Vec, to: Vec): Cubic => [lerp(from, to, 1 / 3), lerp(from, to, 2 / 3), to];

const positive = (value: number, what: string): number => {
  if (!(value >= 0 && Number.isFinite(value)))
    throw new Error(`${what} needs a finite size of 0 or more, got ${value}.`);

  return value;
};

/** A path under construction. Every method returns a new one, so a path can be shared and extended. */
export class PathBuilder {
  readonly #done: readonly Contour[];
  readonly #open: Contour | undefined;

  constructor(done: readonly Contour[] = [], open?: Contour) {
    this.#done = done;
    this.#open = open;
  }

  get contours(): readonly Contour[] {
    return this.#open ? [...this.#done, this.#open] : this.#done;
  }

  #pen(what: string): Contour {
    if (!this.#open) throw new Error(`${what} needs a start: call moveTo() first.`);

    return this.#open;
  }

  #add(curve: Cubic, what: string): PathBuilder {
    const open = this.#pen(what);

    return new PathBuilder(this.#done, { ...open, curves: [...open.curves, curve] });
  }

  moveTo(to: Vec): PathBuilder {
    return new PathBuilder(this.contours, { start: to, curves: [], closed: false });
  }

  lineTo(to: Vec): PathBuilder {
    const open = this.#pen("lineTo()");

    return this.#add(straight(open.curves.at(-1)?.[2] ?? open.start, to), "lineTo()");
  }

  curveTo(control1: Vec, control2: Vec, to: Vec): PathBuilder {
    return this.#add([control1, control2, to], "curveTo()");
  }

  quadTo(control: Vec, to: Vec): PathBuilder {
    const open = this.#pen("quadTo()");
    const from = open.curves.at(-1)?.[2] ?? open.start;

    return this.#add([lerp(from, control, 2 / 3), lerp(to, control, 2 / 3), to], "quadTo()");
  }

  /** Close the contour back to where it started. The next command needs a moveTo(). */
  close(): PathBuilder {
    const open = this.#pen("close()");
    const end = open.curves.at(-1)?.[2] ?? open.start;
    const [sx, sy] = open.start;

    const curves =
      end[0] === sx && end[1] === sy ? open.curves : [...open.curves, straight(end, open.start)];

    return new PathBuilder([...this.#done, { ...open, curves, closed: true }]);
  }
}

/** A shape's outline, built by `rect`, `circle`, `arc`, `path` and the rest. Never a string. */
export type Geometry = Outline | PathBuilder;

export const outlineOf = (geometry: Geometry): Outline =>
  geometry instanceof PathBuilder
    ? { kind: "path", contours: geometry.contours, rule: "nonzero" }
    : geometry;

export interface RectOptions {
  /** One radius, or top-left, top-right, bottom-right, bottom-left. */
  readonly radius?: number | readonly [number, number, number, number];
}

const isEach = (
  radius: number | readonly [number, number, number, number],
): radius is readonly [number, number, number, number] => Array.isArray(radius);

/** Its frame starts at the top-left corner. */
export const rect = (width: number, height: number, options: RectOptions = {}): Geometry => {
  const radius = options.radius ?? 0;
  const each = isEach(radius) ? radius : ([radius, radius, radius, radius] as const);
  const most = Math.min(positive(width, "rect()"), positive(height, "rect()")) / 2;

  return {
    kind: "rect",
    size: [width, height],
    radius: [
      Math.min(most, positive(each[0], "rect()")),
      Math.min(most, positive(each[1], "rect()")),
      Math.min(most, positive(each[2], "rect()")),
      Math.min(most, positive(each[3], "rect()")),
    ],
  };
};

/** Drawn around its own `[0, 0]`, as are `ellipse` and `arc`: `at` places its box, `anchor="center"` its center. */
export const circle = (radius: number): Geometry => ({
  kind: "ellipse",
  radius: [positive(radius, "circle()"), radius],
});

/** Drawn around its own `[0, 0]`, `rx` across and `ry` down: `at` places its box, `anchor="center"` its center. */
export const ellipse = (rx: number, ry: number): Geometry => ({
  kind: "ellipse",
  radius: [positive(rx, "ellipse()"), positive(ry, "ellipse()")],
});

export interface ArcOptions {
  readonly radius: number;
  /** Where it starts, in degrees clockwise from three o'clock. Default 0. */
  readonly start?: number;
  /** How far it runs, in degrees clockwise. */
  readonly sweep: number;
}

/** Part of a circle's edge. Its box is the whole circle's, so it turns around the circle's center. */
export const arc = ({ radius, start = 0, sweep }: ArcOptions): Geometry => {
  if (!Number.isFinite(start) || !Number.isFinite(sweep))
    throw new Error(`arc() needs a finite start and sweep, got ${start} and ${sweep}.`);

  return { kind: "arc", radius: positive(radius, "arc()"), start, sweep };
};

/**
 * A straight segment between two points. Without `at` it stays where they are; with one, `at` places its box. It
 * has no fill. To join two nodes, use `<Arrow>`.
 */
export const line = (from: Vec, to: Vec): Geometry => ({ kind: "line", from, to });

/** A closed outline through `points`. Without `at` it stays where they are; with one, `at` places its box. */
export const polygon = (points: readonly Vec[]): Geometry => ({
  kind: "polygon",
  points,
  closed: true,
});

/** An open outline through `points`. Without `at` it stays where they are; with one, `at` places its box. */
export const polyline = (points: readonly Vec[]): Geometry => ({
  kind: "polygon",
  points,
  closed: false,
});

/**
 * A path built step by step: `path().moveTo([0, 0]).lineTo([10, 0]).close()`. Without `at` it stays where its
 * points are; with one, `at` places its box.
 */
export const path = (): PathBuilder => new PathBuilder();

/**
 * A geometry from path data, the `d` string icon sets and drawing tools write (`"M0 0L10 0Z"`), read when the scene
 * compiles: the way in for icons and traced artwork. To build a path in code, use `path()`.
 */
export const pathData = (d: string): Geometry => ({
  kind: "path",
  contours: ringsOf(d),
  rule: "nonzero",
});

const DEG = Math.PI / 180;

/** Where an arc's edge is at `angle` degrees. */
export const onCircle = (radius: number, angle: number): Vec => [
  radius * Math.cos(angle * DEG),
  radius * Math.sin(angle * DEG),
];

const extremes = (a: number, b: number, c: number, d: number): number[] => {
  const [p, q, r] = [-a + 3 * b - 3 * c + d, 2 * (a - 2 * b + c), -a + b];

  const roots =
    Math.abs(p) < 1e-12
      ? Math.abs(q) < 1e-12
        ? []
        : [-r / q]
      : [1, -1].map((sign) => (-q + sign * Math.sqrt(Math.max(0, q * q - 4 * p * r))) / (2 * p));

  return [a, d].concat(
    roots
      .filter((t) => t > 0 && t < 1 && q * q - 4 * p * r >= 0)
      .map((t) => {
        const s = 1 - t;

        return s * s * s * a + 3 * s * s * t * b + 3 * s * t * t * c + t * t * t * d;
      }),
  );
};

const around = (xs: readonly number[], ys: readonly number[]): Box => {
  if (xs.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  const [x, y] = [Math.min(...xs), Math.min(...ys)];

  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
};

/** What an outline covers in its own frame, strokes aside. Curves are measured exactly, not by their control points. */
export const boxOf = (outline: Outline): Box => {
  switch (outline.kind) {
    case "rect":
      return { x: 0, y: 0, width: outline.size[0], height: outline.size[1] };
    case "ellipse": {
      const [rx, ry] = outline.radius;

      return { x: -rx, y: -ry, width: rx * 2, height: ry * 2 };
    }

    case "arc": {
      const r = outline.radius;

      return { x: -r, y: -r, width: r * 2, height: r * 2 };
    }

    case "line":
      return around([outline.from[0], outline.to[0]], [outline.from[1], outline.to[1]]);
    case "polygon":
      return around(
        outline.points.map((point) => point[0]),
        outline.points.map((point) => point[1]),
      );
    case "path": {
      const xs: number[] = [];
      const ys: number[] = [];

      for (const contour of outline.contours) {
        let from = contour.start;

        xs.push(from[0]);
        ys.push(from[1]);

        for (const [c1, c2, to] of contour.curves) {
          xs.push(...extremes(from[0], c1[0], c2[0], to[0]));
          ys.push(...extremes(from[1], c1[1], c2[1], to[1]));
          from = to;
        }
      }

      return around(xs, ys);
    }
  }
};

/** A color by name, with a value for light and for dark. */
export interface Token {
  readonly kind: "token";
  readonly name: string;
  readonly light: Hex;
  readonly dark: Hex;
}

/** A hex color, the same in every scheme, or a token from `tokens()`, which has a light and a dark value. */
export type Color = Hex | Token;

/** What fills or strokes: a color, or a gradient from `linear()` or `radial()`. */
export type Paint = Color | Gradient;

/** Tokens by name, as `tokens()` makes them. */
export type Theme<K extends string = string> = { readonly [N in K]: Token };

/** Name colors once: `theme.surface` is a token that follows the viewer in SVG and is baked elsewhere. */
export const tokens = <const K extends string>(values: {
  readonly light: Readonly<Record<K, Hex>>;
  readonly dark: Readonly<Record<K, Hex>>;
}): Theme<K> => {
  // SAFETY: Object.keys of a Record<K, Hex> lists exactly its K keys.
  const names = Object.keys(values.dark) as K[];

  for (const name of names) {
    if (!/^[A-Za-z_][\w-]*$/.test(name))
      throw new Error(
        `tokens() needs names made of letters, digits, _ and -, starting with a letter or _, got "${name}".`,
      );

    if (values.light[name] === undefined)
      throw new Error(`tokens() has a dark "${name}" and no light one.`);
  }

  // SAFETY: names are the keys of `dark`, so each K gets exactly one token.
  return Object.fromEntries(
    names.map((name): [K, Token] => [
      name,
      {
        kind: "token",
        name,
        light: hexOf(values.light[name], "tokens()", true),
        dark: hexOf(values.dark[name], "tokens()", true),
      },
    ]),
  ) as Theme<K>;
};

export const rgbaOf = (hex: Hex, caller: string): Rgba => {
  const [r, g, b, a] = hexBytes(hexOf(hex, caller, true));

  return [r / 255, g / 255, b / 255, a / 255];
};
