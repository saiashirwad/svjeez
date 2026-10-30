import { describe, expect, test } from "bun:test";
import { close, ends, points, route } from "../helpers/spline";

describe("spline", () => {
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
});
