import { describe, expect, test } from "bun:test";
import { traffic } from "../../src/index.ts";
import { scene } from "../helpers/geo-world.ts";
import { lines } from "../helpers/traffic-lines.ts";

describe("traffic()", () => {
  test("sends rate times the span of particles", () => {
    const a = traffic(lines, { during: { at: 1, over: 4 }, rate: 5, seed: 7 });

    expect(a.count).toBe(20);
    expect(a.end).toBeGreaterThan(5);
  });

  test("favors heavier routes", () => {
    const { node } = traffic(lines, { during: { at: 0, over: 8 }, rate: 25, seed: 3 });
    const svg = scene(node);
    const ends = [...svg.matchAll(/translate:100px (0|80)px/g)].map((m) => m[1]);

    expect(ends.filter((y) => y === "80").length).toBeGreaterThan(
      ends.filter((y) => y === "0").length,
    );
  });

  test("rejects a rate it can't use", () => {
    expect(() => traffic(lines, { during: { at: 0, over: 1 }, rate: 0 })).toThrow("positive rate");
  });
});
