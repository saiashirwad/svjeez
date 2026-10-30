import { describe, expect, test } from "bun:test";
import { choropleth, palettes, sequential } from "../../src/index.ts";
import { map, scene } from "../helpers/geo-world.ts";

describe("choropleth()", () => {
  const scale = sequential(palettes.blues, { domain: [0, 100], steps: 4 });

  test("shares one path among regions of the same color and reports keys it can't place", () => {
    const { node, unmatched, groups } = choropleth(
      map,
      { France: 10, Germany: 12, Spain: 90, 999999: 5, Atlantis: 1 },
      { scale },
    );

    expect(groups).toBe(2);
    expect(unmatched).toEqual(["999999", "Atlantis"]);
    const svg = scene(node);
    expect(svg).toContain(scale(10));
    expect(svg).toContain(scale(90));
    expect(svg).toContain(`fill="${scale.empty}"`);
  });

  test("plays a list of values through the times, and groups regions that follow the same course", () => {
    const { node, groups } = choropleth(
      map,
      { France: [10, 90], Germany: [10, 90], Spain: [90, 10] },
      { scale, at: [0, 3], over: 1 },
    );

    expect(groups).toBe(2);
    const svg = scene(node);
    expect(svg).toMatch(/@keyframes[^{]*\{[^}]*fill:/);
    expect(svg.match(/@keyframes/g)!.length).toBeGreaterThan(0);
  });

  test("names the fix when the times don't match the values", () => {
    expect(() => choropleth(map, { France: [1, 2, 3] }, { scale, at: [0, 1] })).toThrow(
      "choropleth() has 3 values per region but 2 times in at. Pass one time per value.",
    );
  });
});
