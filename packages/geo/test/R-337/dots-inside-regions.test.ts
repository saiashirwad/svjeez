import { describe, expect, test } from "bun:test";
import { geoContains, geoOrthographic } from "d3-geo";
import { project } from "../../src/index.ts";
import { frame, map, world } from "../helpers/geo-world.ts";

describe("dots()", () => {
  const dots = map.dots(3);

  test("puts every dot inside the region it names", () => {
    expect(dots.length).toBeGreaterThan(1000);

    for (const dot of dots.slice(0, 200))
      expect(geoContains(map.region(dot.id).feature, [...dot.at])).toBe(true);
  });

  test("spaces dots by arc, so rows near the poles hold fewer", () => {
    const row = (lat: number) => dots.filter((d) => Math.abs(d.at[1] - lat) < 1.5).length;

    expect(row(64.5)).toBeLessThan(row(4.5) + row(1.5));
    expect(new Set(dots.map((d) => d.at[1])).size).toBeLessThanOrEqual(60);
  });

  test("keeps the far side of a globe, with no point", () => {
    const globe = project(world, { frame, projection: geoOrthographic(), fit: "sphere" });
    const all = globe.dots(3);

    expect(all).toHaveLength(dots.length);
    expect(all.some((d) => d.point === undefined)).toBe(true);
    expect(all.find((d) => d.at[0] > 120 && d.at[0] < 150)?.point).toBeUndefined();
  });
});
