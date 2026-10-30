import { describe, expect, test } from "bun:test";
import { route } from "../helpers/spline";

describe("spline", () => {
  test("nearest finds the position a point lies on, within the range asked", () => {
    expect(route.nearest(route.point(1.37))).toBeCloseTo(1.37, 4);
    const onLegTwo = route.nearest(route.point(0.5), 2, 3);
    expect(onLegTwo).toBeGreaterThanOrEqual(2);
    expect(onLegTwo).toBeLessThanOrEqual(3);
  });
});
