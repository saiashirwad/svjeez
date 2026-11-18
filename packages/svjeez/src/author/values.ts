import { SceneError } from "../model/scene-error";
import { hexBytes, hexOf, type Hex } from "../model/color";
import { lineCubic, quadraticCubic } from "../model/curve";
import { ringsOf } from "../model/paths";
import type { Contour, Cubic, Geometry as Outline, Rgba, Vec } from "../model/ir";
import type { Gradient, Pattern } from "./paint";

export type { Hex };

const positive = (value: number, what: string): number => {
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
  readonly radius?: number | readonly [number, number, number, number];
}

const isEach = (
  radius: number | readonly [number, number, number, number],
): radius is readonly [number, number, number, number] => Array.isArray(radius);

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

export const circle = (radius: number): Geometry => ({
  kind: "ellipse",
  radius: [positive(radius, "circle()"), radius],
});

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

export const line = (from: Vec, to: Vec): Geometry => ({ kind: "line", from, to });

export const polygon = (points: readonly Vec[]): Geometry => ({
  kind: "polygon",
  points,
  closed: true,
});

export const polyline = (points: readonly Vec[]): Geometry => ({
  kind: "polygon",
  points,
  closed: false,
});

export const path = (): PathBuilder => new PathBuilder();

export const pathData = (d: string): Geometry => ({
  kind: "path",
  contours: ringsOf(d),
  rule: "nonzero",
});

export interface Token {
  readonly kind: "token";
  readonly name: string;
  readonly light: Hex;
  readonly dark: Hex;
}

export type Color = Hex | Token;

export type Paint = Color | Gradient | Pattern;

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

export const rgbaOf = (hex: Hex, caller: string): Rgba => {
  const [r, g, b, a] = hexBytes(hexOf(hex, caller, true));

  return [r / 255, g / 255, b / 255, a / 255];
};
