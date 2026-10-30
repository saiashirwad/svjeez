import { describe, expect, test } from "bun:test";
import { flatten } from "../../src/ink/path";

describe("flatten", () => {
  test("reads absolute and relative lines, curves and arcs", () => {
    const [line] = flatten("M0 0L10 0l0 10H0v-10Z");
    expect(line!.closed).toBe(true);
    expect(line!.points.map((p) => [p.x, p.y])).toEqual([
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
      [0, 0],
    ]);
    const curve = flatten("M0 0C0 10 10 10 10 0")[0]!.points;
    expect(curve.at(-1)).toEqual({ x: 10, y: 0 });
    expect(Math.max(...curve.map((p) => p.y))).toBeCloseTo(7.5, 1);
    const arc = flatten("M0 0A10 10 0 0 1 20 0")[0]!.points;
    expect(arc.at(-1)!.x).toBeCloseTo(20, 6);
    expect(Math.min(...arc.map((p) => p.y))).toBeCloseTo(-10, 0);
  });

  test("splits subpaths and mirrors smooth control points", () => {
    expect(flatten("M0 0L5 0M10 0L15 0")).toHaveLength(2);
    const smooth = flatten("M0 0C0 10 10 10 10 0S20 -10 20 0")[0]!.points;
    expect(Math.min(...smooth.map((p) => p.y))).toBeCloseTo(-7.5, 1);
  });

  test("a smooth curve after the other curve type starts its control point at the current point", () => {
    for (const d of ["M0 0Q10 10 20 0S30 0 40 0", "M0 0C0 10 20 10 20 0T40 0"]) {
      expect(Math.min(...flatten(d)[0]!.points.map((p) => p.y))).toBeCloseTo(0, 6);
    }
  });

  test("an arc that ends where it starts is skipped", () => {
    expect(flatten("M0 0A10 10 0 0 1 0 0L10 0")[0]!.points).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ]);
  });

  test("rejects malformed data", () => {
    expect(() => flatten("10 10")).toThrow("must start with a command");
    expect(() => flatten("M0")).toThrow("needs 2 numbers");
  });
});
