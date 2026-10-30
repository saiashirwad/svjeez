import { describe, expect, test } from "bun:test";
import { spline } from "svjeez";

const points = [
  { x: -30, y: 215 },
  { x: 150, y: 80 },
  { x: 300, y: 175 },
  { x: 450, y: 70 },
];

/** Uniform Catmull-Rom written out, with the ends repeated, to check the Béziers against. */
const catmullRom = (i: number, u: number) => {
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

const close = (a: { x: number; y: number }, b: { x: number; y: number }, digits = 6) => {
  expect(a.x).toBeCloseTo(b.x, digits);
  expect(a.y).toBeCloseTo(b.y, digits);
};

const ends = (d: string) => {
  const numbers = d.match(/-?[\d.]+/g)!.map(Number);

  return {
    first: { x: numbers[0]!, y: numbers[1]! },
    last: { x: numbers.at(-2)!, y: numbers.at(-1)! },
    curves: d.match(/C/g)?.length ?? 0,
  };
};

describe("spline", () => {
  const route = spline(points);

  test("passes through every point, and leg i + u is Catmull-Rom's u along leg i", () => {
    expect(route.legs).toBe(3);
    points.forEach((p, i) => close(route.point(i), p));

    for (const position of [0.1, 0.5, 1.25, 2.9])
      close(route.point(position), catmullRom(Math.floor(position), position % 1));
  });

  test("positions past either end hold the end points", () => {
    close(route.point(-1), points[0]!);
    close(route.point(9), points[3]!);
  });

  test("d is one cubic per leg from the first point to the last", () => {
    const { first, last, curves } = ends(route.d);
    expect(curves).toBe(3);
    close(first, points[0]!, 1);
    close(last, points[3]!, 1);
  });

  test("path cuts the route exactly, inside a leg or across legs", () => {
    const one = ends(route.path(1, 2));
    expect(one.curves).toBe(1);
    close(one.first, points[1]!, 1);
    close(one.last, points[2]!, 1);

    const across = ends(route.path(0.5, 2.25));
    expect(across.curves).toBe(3);
    close(across.first, route.point(0.5), 1);
    close(across.last, route.point(2.25), 1);
  });

  test("tangent is the rate of change of the point", () => {
    const e = 1e-5;
    const [ahead, behind] = [route.point(1.6 + e), route.point(1.6 - e)];
    close(
      route.tangent(1.6),
      { x: (ahead.x - behind.x) / (2 * e), y: (ahead.y - behind.y) / (2 * e) },
      2,
    );
  });

  test("angle follows the direction of travel", () => {
    const flat = spline([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 0 },
    ]);

    expect(flat.angle(0.5)).toBeCloseTo(0, 6);
    expect(
      spline([
        { x: 0, y: 0 },
        { x: 0, y: 10 },
      ]).angle(0.3),
    ).toBeCloseTo(90, 6);

    const ahead = route.point(1.3 + 1e-4);
    const here = route.point(1.3);
    const expected = (Math.atan2(ahead.y - here.y, ahead.x - here.x) * 180) / Math.PI;
    expect(route.angle(1.3)).toBeCloseTo(expected, 1);
  });

  test("nearest finds the position a point lies on, within the range asked", () => {
    expect(route.nearest(route.point(1.37))).toBeCloseTo(1.37, 4);
    const onLegTwo = route.nearest(route.point(0.5), 2, 3);
    expect(onLegTwo).toBeGreaterThanOrEqual(2);
    expect(onLegTwo).toBeLessThanOrEqual(3);
  });

  test("needs two points", () => {
    expect(() => spline([{ x: 0, y: 0 }])).toThrow("spline() needs at least two points, got 1.");
  });
});
