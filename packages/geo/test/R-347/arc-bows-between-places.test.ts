import { describe, expect, test } from "bun:test";
import { arc } from "../../src/index.ts";
import { map } from "../helpers/geo-world.ts";

describe("arc()", () => {
  const a = { x: 100, y: 300 };
  const b = { x: 500, y: 300 };

  test("bows upward by the height and ends where it should", () => {
    const points = arc(map, a, b, { height: 80, steps: 40 });
    const top = Math.min(...points.map((p) => p.y));

    expect(points[0]).toEqual(a);
    expect(points.at(-1)).toEqual(b);
    expect(top).toBeCloseTo(220, 0);
  });

  test("bows the same way whichever end it starts from", () => {
    const back = arc(map, b, a, { height: 80 });

    expect(Math.min(...back.map((p) => p.y))).toBeCloseTo(220, 0);
  });

  test("takes places by longitude and latitude", () => {
    const points = arc(map, [-0.13, 51.5], [139.7, 35.7]);

    expect(points[0]).toEqual(map.point([-0.13, 51.5]));
  });
});
