import { describe, expect, test } from "bun:test";
import { spline } from "svjeez";
import { catmullRom, close, points, route } from "../helpers/spline";

describe("spline", () => {
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

  test("needs two points", () => {
    expect(() => spline([{ x: 0, y: 0 }])).toThrow("spline() needs at least two points, got 1.");
  });
});
