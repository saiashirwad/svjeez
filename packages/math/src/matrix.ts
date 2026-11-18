import { SceneError } from "svjeez/tools";

export type Matrix = readonly [a: number, b: number, c: number, d: number, e: number, f: number];

export const identity: Matrix = [1, 0, 0, 1, 0, 0];

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

export const apply = (m: Matrix, x: number, y: number): [number, number] => [
  m[0] * x + m[2] * y + m[4],
  m[1] * x + m[3] * y + m[5],
];

export function parseTransform(list: string | undefined, quoted: string): Matrix {
  let m = identity;

  for (const [, name, args] of (list ?? "").matchAll(/(\w+)\(([^)]*)\)/g)) {
    const n = args!
      .trim()
      .split(/[\s,]+/)
      .map(Number);

    if (n.some(Number.isNaN) || (name !== "translate" && name !== "scale"))
      throw new SceneError(
        `<Tex> can't place a symbol in ${quoted}.`,
        "Write it without that command.",
      );

    m = multiply(
      m,
      name === "translate" ? translate(n[0]!, n[1] ?? 0) : scale(n[0]!, n[1] ?? n[0]!),
    );
  }

  return m;
}
