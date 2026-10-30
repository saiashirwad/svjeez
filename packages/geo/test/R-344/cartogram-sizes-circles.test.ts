import { describe, expect, test } from "bun:test";
import { cartogram } from "../../src/index.ts";
import { map } from "../helpers/geo-world.ts";

describe("cartogram()", () => {
  const people = { France: 67, Germany: 83, Spain: 47, Italy: 60, Poland: 38, Portugal: 10 };
  const result = cartogram(map, people, { at: 2, over: 1 });

  test("sizes circles by area and keeps them apart", () => {
    const [de, pt] = ["Germany", "Portugal"].map((n) =>
      result.bubbles.find((b) => b.region.properties?.name === n)!,
    );

    expect((de!.r / pt!.r) ** 2).toBeCloseTo(83 / 10, 0);

    for (const [i, a] of result.bubbles.entries())
      for (const b of result.bubbles.slice(i + 1))
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(a.r + b.r - 0.5);
  });

  test("is the same every time", () => {
    expect(cartogram(map, people, { at: 2 }).bubbles).toEqual(result.bubbles);
  });
});
