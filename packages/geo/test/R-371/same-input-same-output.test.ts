import { describe, expect, test } from "bun:test";
import { cartogram, traffic } from "../../src/index.ts";
import { map, scene } from "../helpers/geo-world.ts";
import { lines } from "../helpers/traffic-lines.ts";

describe("cartogram()", () => {
  test("is the same every time", () => {
    const people = { France: 67, Germany: 83, Spain: 47, Italy: 60, Poland: 38, Portugal: 10 };
    const result = cartogram(map, people, { at: 2, over: 1 });

    expect(cartogram(map, people, { at: 2 }).bubbles).toEqual(result.bubbles);
  });
});

describe("traffic()", () => {
  test("is deterministic by seed", () => {
    const a = traffic(lines, { during: { at: 1, over: 4 }, rate: 5, seed: 7 });
    const b = traffic(lines, { during: { at: 1, over: 4 }, rate: 5, seed: 7 });
    const c = traffic(lines, { during: { at: 1, over: 4 }, rate: 5, seed: 8 });

    expect(scene(a.node)).toBe(scene(b.node));
    expect(scene(a.node)).not.toBe(scene(c.node));
  });
});
