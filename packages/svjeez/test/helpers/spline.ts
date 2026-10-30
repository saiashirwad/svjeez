import { expect } from "bun:test";
import { spline } from "svjeez";

export const points = [
  { x: -30, y: 215 },
  { x: 150, y: 80 },
  { x: 300, y: 175 },
  { x: 450, y: 70 },
];

export const route = spline(points);

/** Uniform Catmull-Rom written out, with the ends repeated, to check the Béziers against. */
export const catmullRom = (i: number, u: number) => {
  const pick = (k: number) => points[Math.max(0, Math.min(points.length - 1, k))]!;
  const [a, b, c, d] = [pick(i - 1), pick(i), pick(i + 1), pick(i + 2)];

  const axis = (p0: number, p1: number, p2: number, p3: number) =>
    (2 * p1 +
      (p2 - p0) * u +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u +
      (3 * p1 - p0 - 3 * p2 + p3) * u ** 3) /
    2;

  return { x: axis(a.x, b.x, c.x, d.x), y: axis(a.y, b.y, c.y, d.y) };
};

export const close = (a: { x: number; y: number }, b: { x: number; y: number }, digits = 6) => {
  expect(a.x).toBeCloseTo(b.x, digits);
  expect(a.y).toBeCloseTo(b.y, digits);
};

export const ends = (d: string) => {
  const numbers = d.match(/-?[\d.]+/g)!.map(Number);

  return {
    first: { x: numbers[0]!, y: numbers[1]! },
    last: { x: numbers.at(-2)!, y: numbers.at(-1)! },
    curves: d.match(/C/g)?.length ?? 0,
  };
};
