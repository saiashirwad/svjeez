import { SceneError } from "../model/scene-error";
import { hexBytes, hexOf, type Hex } from "../model/color";
import { lineCubic, quadraticCubic } from "../model/curve";
import { contoursOf } from "../model/geometry";
import { arcToCubics, ringsOf } from "../model/paths";
import type { Contour, Cubic, Geometry as Outline, Rgba, Vec } from "../model/ir";
import type { Gradient, Noise, None, Pattern } from "./paint";
import { isArray } from "../model/guards";
import { isTrack } from "./track";

export type { Hex };

const positive = (value: number, what: string): number => {
  if (isTrack(value))
    throw new SceneError(
      `${what} takes plain numbers, but got an animated value.`,
      `To animate the size, track the shape: geometry={track(${what.replace("()", "(w0, h0)")}).to(${what.replace("()", "(w1, h1)")}, span(0, 1), ease.inOut)}.`,
    );

  if (!(value >= 0 && Number.isFinite(value)))
    throw new SceneError(`${what} needs a finite size of 0 or more, got ${value}.`);

  return value;
};

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
    if (!this.#open) throw new SceneError(`${what} needs a start: call moveTo() first.`);

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

    return this.#add(lineCubic(open.curves.at(-1)?.[2] ?? open.start, to), "lineTo()");
  }

  curveTo(control1: Vec, control2: Vec, to: Vec): PathBuilder {
    return this.#add([control1, control2, to], "curveTo()");
  }

  quadTo(control: Vec, to: Vec): PathBuilder {
    const open = this.#pen("quadTo()");
    const from = open.curves.at(-1)?.[2] ?? open.start;

    return this.#add(quadraticCubic(from, control, to), "quadTo()");
  }

  arcTo(
    rx: number,
    ry: number,
    rotation: number,
    largeArc: boolean,
    sweep: boolean,
    to: Vec,
  ): PathBuilder {
    const open = this.#pen("arcTo()");

    if (
      !Number.isFinite(rx) ||
      !Number.isFinite(ry) ||
      !Number.isFinite(rotation) ||
      !to.every((n) => Number.isFinite(n))
    )
      throw new SceneError(
        `arcTo() needs finite radii, rotation and endpoint, got (${rx}, ${ry}, ${rotation}, [${to.join(", ")}]).`,
      );

    const from = open.curves.at(-1)?.[2] ?? open.start;
    const pieces = arcToCubics(from, rx, ry, rotation, largeArc, sweep, to);

    return new PathBuilder(this.#done, { ...open, curves: [...open.curves, ...pieces] });
  }

  add(geometry: Geometry): PathBuilder {
    return new PathBuilder([...this.contours, ...contoursOf(outlineOf(geometry))]);
  }

  close(): PathBuilder {
    const open = this.#pen("close()");
    const end = open.curves.at(-1)?.[2] ?? open.start;
    const [sx, sy] = open.start;

    const curves =
      end[0] === sx && end[1] === sy ? open.curves : [...open.curves, lineCubic(end, open.start)];

    return new PathBuilder([...this.#done, { ...open, curves, closed: true }]);
  }
}

export type Geometry = Outline | PathBuilder;

export const outlineOf = (geometry: Geometry): Outline =>
  geometry instanceof PathBuilder
    ? { kind: "path", contours: geometry.contours, rule: "nonzero" }
    : geometry;

export interface RectOptions {
  /** Which point of the rectangle sits at the origin: `"top-left"` (default) or `"center"`. */
  readonly anchor?: "top-left" | "center";
  readonly radius?: number | readonly [number, number, number, number];
}

/**
 * A rectangle `width` by `height`. Its top-left corner sits at the origin, so it covers
 * `[0, 0]` to `[width, height]`; pass `{ anchor: "center" }` to center it on the origin
 * like `circle()` and `ellipse()`.
 */
export const rect = (width: number, height: number, options: RectOptions = {}): Geometry => {
  const anchor = options.anchor ?? "top-left";

  if (anchor !== "top-left" && anchor !== "center")
    throw new SceneError(
      `rect() anchor takes "top-left" or "center", got ${JSON.stringify(anchor)}.`,
    );
  const radius = options.radius ?? 0;
  const each = isArray(radius) ? radius : ([radius, radius, radius, radius] as const);
  const most = Math.min(positive(width, "rect()"), positive(height, "rect()")) / 2;

  const sharp: Geometry = {
    kind: "rect",
    size: [width, height],
    radius: [
      Math.min(most, positive(each[0], "rect()")),
      Math.min(most, positive(each[1], "rect()")),
      Math.min(most, positive(each[2], "rect()")),
      Math.min(most, positive(each[3], "rect()")),
    ],
  };

  return anchor === "center" ? centered(sharp) : sharp;
};

/** The same rectangle as a path, shifted so its center sits on the origin. */
const centered = (rectangle: Outline): Outline => {
  const [dx, dy] =
    rectangle.kind === "rect" ? [-rectangle.size[0] / 2, -rectangle.size[1] / 2] : [0, 0];

  const shift = ([x, y]: Vec): Vec => [x + dx, y + dy];

  return {
    kind: "path",
    rule: "nonzero",
    contours: contoursOf(rectangle).map((contour) => ({
      start: shift(contour.start),
      curves: contour.curves.map(([c1, c2, to]) => [shift(c1), shift(c2), shift(to)] as const),
      closed: contour.closed,
    })),
  };
};

/** A circle centered on the origin. */
export const circle = (radius: number): Geometry => ({
  kind: "ellipse",
  radius: [positive(radius, "circle()"), radius],
});

/** An ellipse centered on the origin. */
export const ellipse = (rx: number, ry: number): Geometry => ({
  kind: "ellipse",
  radius: [positive(rx, "ellipse()"), positive(ry, "ellipse()")],
});

export interface ArcOptions {
  readonly radius: number;
  readonly start?: number;
  readonly sweep: number;
}

export const arc = ({ radius, start = 0, sweep }: ArcOptions): Geometry => {
  if (!Number.isFinite(start) || !Number.isFinite(sweep))
    throw new SceneError(`arc() needs a finite start and sweep, got ${start} and ${sweep}.`);

  return { kind: "arc", radius: positive(radius, "arc()"), start, sweep };
};

/** The points of a call written either as separate points or as one array of points. */
const pointList = (args: readonly Vec[] | readonly [readonly Vec[]]): readonly Vec[] => {
  const [first] = args;

  // SAFETY: a lone first argument whose own first item is an array is a list of points, not a point.
  return args.length === 1 && isArray(first) && isArray(first[0])
    ? (first as readonly Vec[])
    : (args as readonly Vec[]);
};

/** A straight line from one point to the next: two points, or an open line through more. Also takes one array. */
export const line = (...args: readonly Vec[] | readonly [readonly Vec[]]): Geometry => {
  const points = pointList(args);
  const [from, to, ...more] = points;

  if (!from || !to) throw new SceneError(`line() needs two points or more, got ${points.length}.`);

  return more.length === 0 ? { kind: "line", from, to } : { kind: "points", points, closed: false };
};

/** A closed outline with a corner at each point: `polygon(a, b, c)` or `polygon([a, b, c])`. */
export const polygon = (...args: readonly Vec[] | readonly [readonly Vec[]]): Geometry => ({
  kind: "points",
  points: pointList(args),
  closed: true,
});

/** An outline you draw step by step, or `path.parse(text)` for one copied from an icon set or a drawing tool. */
export const path = Object.assign((): PathBuilder => new PathBuilder(), {
  parse: (text: string): Geometry => ({
    kind: "path",
    contours: ringsOf(text),
    rule: "nonzero",
  }),
});

export interface Token {
  readonly kind: "token";
  readonly name: string;
  readonly light: Hex;
  readonly dark: Hex;
  /** Set by mix(): the SVG blends this token from the two it mixes, so restyling those restyles it too. */
  readonly mix?: { readonly a: Color; readonly b: Color; readonly share: number };
}

export type Color = Hex | Token;

export type Paint = Color | Gradient | Pattern | Noise | None;

export type Theme<K extends string = string> = { readonly [N in K]: Token };

export const tokens = <const K extends string>(values: {
  readonly light: Readonly<Record<K, Hex>>;
  readonly dark: Readonly<Record<K, Hex>>;
}): Theme<K> => {
  // SAFETY: Object.keys of a Record<K, Hex> lists exactly its K keys.
  const names = Object.keys(values.dark) as K[];

  for (const name of names) {
    if (!/^[A-Za-z_][\w-]*$/.test(name))
      throw new SceneError(
        `tokens() needs names made of letters, digits, _ and -, starting with a letter or _, got "${name}".`,
      );

    if (values.light[name] === undefined)
      throw new SceneError(`tokens() has a dark "${name}" and no light one.`);
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

const blend = (a: Hex, b: Hex, share: number): Hex => {
  const [x, y] = [hexBytes(a), hexBytes(b)];
  const alpha = x[3] * share + y[3] * (1 - share);
  const byte = (n: number) => Math.round(n).toString(16).padStart(2, "0");

  // Fully transparent keeps the color of the one side that has any, so a gradient to `alpha(c, 0)` fades c out
  // instead of greying through black.
  if (alpha === 0) {
    const kept = x[3] > 0 && y[3] === 0 ? x : y[3] > 0 && x[3] === 0 ? y : [0, 0, 0];

    return `#${[0, 1, 2].map((i) => byte(kept[i]!)).join("")}00`;
  }

  const rgb = [0, 1, 2].map((i) =>
    byte((x[i]! * x[3] * share + y[i]! * y[3] * (1 - share)) / alpha),
  );

  return `#${rgb.join("")}${alpha >= 255 ? "" : byte(alpha)}`;
};

const isToken = (color: Color): color is Token => typeof color !== "string";

/**
 * `share` of `a` blended into `b`, 0 to 1, as CSS `color-mix()` blends (alpha too: a mix with `#00000000` is a fainter
 * color). Two hex colors give a hex color; with a token in either, a token named
 * `<a>-<percent>-<b>` that the SVG blends live from the two, so restyling a scene's tokens restyles its mixes too.
 */
export function mix(a: Token, b: Color, share: number): Token;
export function mix(a: Color, b: Token, share: number): Token;
export function mix(a: Color, b: Color, share: number): Color;
export function mix(a: Color, b: Color, share: number): Color {
  if (!(share >= 0 && share <= 1))
    throw new SceneError(`mix() needs a share from 0 to 1, got ${share}.`);

  const [x, y] = [a, b].map((color) => (isToken(color) ? color : hexOf(color, "mix()", true)));

  if (!isToken(x!) && !isToken(y!)) return blend(x!, y!, share);
  const nameOf = (color: Color) => (isToken(color) ? color.name : `c${color.slice(1)}`);
  const scheme = (color: Color, side: "light" | "dark") => (isToken(color) ? color[side] : color);

  return {
    kind: "token",
    name: `${nameOf(x!)}-${Math.round(share * 100)}-${nameOf(y!)}`,
    light: blend(scheme(x!, "light"), scheme(y!, "light"), share),
    dark: blend(scheme(x!, "dark"), scheme(y!, "dark"), share),
    mix: { a: x!, b: y!, share },
  };
}

/**
 * `color` at `opacity` (0 to 1), working on both hex colors and light/dark tokens.
 * Built on `mix()`, so restyling a token restyles its translucent derivatives too.
 */
export function alpha(color: Token, opacity: number): Token;
export function alpha(color: Color, opacity: number): Color;
export function alpha(color: Color, opacity: number): Color {
  if (!(opacity >= 0 && opacity <= 1 && Number.isFinite(opacity)))
    throw new SceneError(`alpha() needs an opacity from 0 to 1, got ${opacity}.`);

  return mix(color, "#00000000", opacity);
}

export const rgbaOf = (hex: Hex, caller: string): Rgba => {
  const [r, g, b, a] = hexBytes(hexOf(hex, caller, true));

  return [r / 255, g / 255, b / 255, a / 255];
};
