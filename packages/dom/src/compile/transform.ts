import type { Matrix } from "../schema.ts";
import type { Vec } from "./geometry.ts";

export interface Placement {
  readonly translate: Vec;
  /** Degrees, clockwise on screen. */
  readonly rotate: number;
  readonly scale: Vec;
  /** Degrees of shear along x, applied before scale and rotate; 0 for a matrix that only turns and scales. */
  readonly skew: number;
}

const DEGREES = 180 / Math.PI;

/** A 2D matrix as the translate · rotate · scale · skew that make it, the order core applies them in. */
export const decompose = ([a, b, c, d, e, f]: Matrix): Placement => {
  const sx = Math.hypot(a, b);
  const det = a * d - b * c;

  if (sx === 0) return { translate: [e, f], rotate: 0, scale: [0, Math.hypot(c, d)], skew: 0 };

  return {
    translate: [e, f],
    rotate: Math.atan2(b, a) * DEGREES,
    scale: [sx, det / sx],
    skew: Math.atan((a * c + b * d) / (sx * sx)) * DEGREES,
  };
};

export const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

export const multiply = (m: Matrix, n: Matrix): Matrix => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];

const radians = (degrees: number) => degrees / DEGREES;

const turn = (angle: number): Matrix => [
  Math.cos(angle),
  Math.sin(angle),
  -Math.sin(angle),
  Math.cos(angle),
  0,
  0,
];

const listOf = (args: string): number[] =>
  args
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(Number);

/** One SVG transform function as a matrix. */
const matrixOf = (name: string, args: string): Matrix | undefined => {
  const [p = 0, q, r] = listOf(args);

  switch (name) {
    case "matrix": {
      const [a, b, c, d, e, f, ...more] = listOf(args);

      return a === undefined ||
        b === undefined ||
        c === undefined ||
        d === undefined ||
        e === undefined ||
        f === undefined ||
        more.length > 0
        ? undefined
        : [a, b, c, d, e, f];
    }

    case "translate":
      return [1, 0, 0, 1, p, q ?? 0];
    case "scale":
      return [p, 0, 0, q ?? p, 0, 0];
    case "rotate":
      return q === undefined || r === undefined
        ? turn(radians(p))
        : multiply(multiply([1, 0, 0, 1, q, r], turn(radians(p))), [1, 0, 0, 1, -q, -r]);
    case "skewX":
      return [1, 0, Math.tan(radians(p)), 1, 0, 0];
    case "skewY":
      return [1, Math.tan(radians(p)), 0, 1, 0, 0];
    default:
      return undefined;
  }
};

/** An SVG `transform` attribute as one matrix, or undefined when it holds something else. */
export const parseTransform = (text: string | undefined): Matrix | undefined => {
  if (text === undefined) return IDENTITY;

  let out = IDENTITY;
  let rest = text;

  for (const [whole, name = "", args = ""] of text.matchAll(/(\w+)\s*\(([^)]*)\)/g)) {
    const next = matrixOf(name, args);

    if (!next) return undefined;

    out = multiply(out, next);
    rest = rest.replace(whole, "");
  }

  return rest.trim() === "" ? out : undefined;
};
