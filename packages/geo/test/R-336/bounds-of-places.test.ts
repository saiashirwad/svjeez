import { describe, expect, test } from "bun:test";
import { LONDON, map, NEW_YORK } from "../helpers/geo-world.ts";

describe("bounds()", () => {
  test("covers places, padded", () => {
    const box = map.bounds([NEW_YORK, LONDON], 20);

    for (const { x, y } of [map.point(NEW_YORK), map.point(LONDON)]) {
      expect(x).toBeGreaterThanOrEqual(box.x + 20);
      expect(x).toBeLessThanOrEqual(box.x + box.w - 20);
      expect(y).toBeGreaterThanOrEqual(box.y + 20);
      expect(y).toBeLessThanOrEqual(box.y + box.h - 20);
    }
  });

  test("of one region is its main piece", () => {
    expect(map.bounds(map.region("Italy"))).toEqual(map.region("Italy").bounds);
  });
});
