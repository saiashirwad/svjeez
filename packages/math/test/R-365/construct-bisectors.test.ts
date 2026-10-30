import { describe, expect, test } from "bun:test";
import { construct } from "../../src/index";

describe("construct", () => {
  test("the perpendicular bisector is perpendicular and passes the midpoint", () => {
    const g = construct();
    const [a, b] = [g.point(0, 0), g.point(6, 2)];
    const line = g.perpendicularBisector(a, b);
    const dir = [line.b.x - line.a.x, line.b.y - line.a.y];

    expect(dir[0]! * 6 + dir[1]! * 2).toBeCloseTo(0, 9);
    expect((line.a.x + line.b.x) / 2).toBeCloseTo(3, 9);
    expect((line.a.y + line.b.y) / 2).toBeCloseTo(1, 9);
  });

  test("the angle bisector splits the angle in two equal halves", () => {
    const g = construct();
    const [a, b, c] = [g.point(8, 0), g.point(0, 0), g.point(0, 5)];
    const ray = g.angleBisector(a, b, c);

    expect(ray.b.x / ray.b.y).toBeCloseTo(1, 9);
  });
});
