/** An SVG `matrix(a b c d e f)`: x' = a·x + c·y + e, y' = b·x + d·y + f. */
export type Matrix = readonly [a: number, b: number, c: number, d: number, e: number, f: number];

export const identity: Matrix = [1, 0, 0, 1, 0, 0];

/** `m` applied after `n`. */
export const multiply = (m: Matrix, n: Matrix): Matrix => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];

export const translate = (x: number, y: number): Matrix => [1, 0, 0, 1, x, y];

export const scale = (x: number, y = x): Matrix => [x, 0, 0, y, 0, 0];

export const roundMatrix = (m: Matrix): Matrix => [
  round(m[0]),
  round(m[1]),
  round(m[2]),
  round(m[3]),
  round(m[4]),
  round(m[5]),
];

export const apply = (m: Matrix, x: number, y: number): [number, number] => [
  m[0] * x + m[2] * y + m[4],
  m[1] * x + m[3] * y + m[5],
];

/** Rounds to three decimals, which is a thousandth of a pixel at the sizes scenes use. */
export const round = (n: number): number => Math.round(n * 1000) / 1000 + 0;

/**
 * The matrix of an SVG `transform` list made of `translate()` and `scale()`, the only two MathJax writes.
 * MathJax separates arguments with a comma, a space or both.
 */
export function parseTransform(list: string | null | undefined): Matrix {
  let m = identity;

  for (const [, name, args] of (list ?? "").matchAll(/(\w+)\(([^)]*)\)/g)) {
    const n = args!
      .trim()
      .split(/[\s,]+/)
      .map(Number);

    if (n.some(Number.isNaN)) throw new Error(`tex() met a transform it cannot read: ${list}`);

    if (name === "translate") m = multiply(m, translate(n[0]!, n[1] ?? 0));
    else if (name === "scale") m = multiply(m, scale(n[0]!, n[1] ?? n[0]!));
    else throw new Error(`tex() met a ${name}() transform it cannot place: ${list}`);
  }

  return m;
}
