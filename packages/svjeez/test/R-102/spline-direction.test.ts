import { describe, expect, test } from "bun:test";
import { spline } from "svjeez";
import { close, route } from "../helpers/spline";

describe("spline", () => {
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
});
