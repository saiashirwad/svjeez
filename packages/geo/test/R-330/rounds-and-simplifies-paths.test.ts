import { describe, expect, test } from "bun:test";
import { project } from "../../src/index.ts";
import { frame, map, world } from "../helpers/geo-world.ts";

const numbers = (d: string) => d.match(/-?\d*\.?\d+/g)!.map(Number);

describe("project()", () => {
  test("rounds every coordinate to a tenth of a pixel", () => {
    for (const r of map.regions)
      for (const n of numbers(r.d)) expect(Math.round(n * 10)).toBe(n * 10);
  });

  test("a larger tolerance writes less path data", () => {
    const size = (tolerance: number) =>
      project(world, { frame, tolerance }).regions.reduce((n, r) => n + r.d.length, 0);

    expect(size(2)).toBeLessThan(size(0.5));
    expect(size(0.5)).toBeLessThan(size(0));
  });
});
