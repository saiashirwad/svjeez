import { describe, expect, test } from "bun:test";
import { createRequire } from "node:module";
import { rect, render, type SvgNode } from "svjeez";
import {
  arc,
  cartogram,
  choropleth,
  diverging,
  legend,
  palettes,
  project,
  sequential,
  toBars,
  traffic,
  type Topology,
} from "../src/index.ts";

const world: Topology = createRequire(import.meta.url)("world-atlas/countries-110m.json");
const map = project(world, { frame: rect(20, 10, 960, 500) });
const scene = (node: SvgNode) =>
  render({ width: 1000, height: 520, duration: 10, title: "Test" }, node);

describe("scales", () => {
  const scale = sequential(["#000000", "#ffffff"], { domain: [0, 100], steps: 5 });

  test("cut the domain into classes and color each", () => {
    expect(scale.edges).toEqual([0, 20, 40, 60, 80, 100]);
    expect(scale.index(-5)).toBe(0);
    expect(scale.index(39)).toBe(1);
    expect(scale.index(100)).toBe(4);
    expect(scale.index(500)).toBe(4);
    expect(scale(10)).toBe(scale.colors[0]!);
    expect(scale(Number.NaN)).toBe(scale.empty);
  });

  test("blend lighter toward the high end", () => {
    const light = (hex: string) => parseInt(hex.slice(1, 3), 16);

    expect(light(scale.colors[0]!)).toBeLessThan(light(scale.colors[4]!));
  });

  test("diverging puts the middle color on the middle value", () => {
    const rb = diverging(palettes.redBlue, { domain: [-10, 0, 30], steps: 7 });

    expect(rb.index(0)).toBe(3);
    expect(rb.index(-10)).toBe(0);
    expect(rb.index(30)).toBe(6);
    expect(rb.colors[3]).toBe("#f7f7f7");
    expect(rb.edges[3]).toBeLessThan(0);
  });

  test("reject colors that can't be blended", () => {
    expect(() => sequential(["red", "#fff"] as never, { domain: [0, 1] })).toThrow(
      'A color scale needs hex colors such as "#1f77b4", got "red".',
    );
    expect(() => sequential(["#000", "#fff"], { domain: [1, 1] })).toThrow("domain that rises");
  });
});

describe("legend()", () => {
  test("draws a swatch per class and labels the edges", () => {
    const scale = sequential(palettes.viridis, { domain: [0, 80], steps: 4 });
    const svg = scene(legend(scale, { x: 10, y: 10, width: 200, every: 1, title: "Years" }));

    expect(svg.match(/<rect/g)).toHaveLength(4);
    for (const label of ["0", "20", "40", "60", "80", "Years"]) expect(svg).toContain(`>${label}<`);
  });
});

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

  test("morphs each outline into a circle through the d channel, and returns the rest of the map", () => {
    const svg = scene(result.node);

    expect(svg.match(/attributeName="d"/g)).toHaveLength(6);
    expect(result.rest).toContain(map.region("Canada").d);
    expect(result.rest).not.toContain(map.region("France").d);
  });

  test("asks for one number per region", () => {
    expect(() => cartogram(map, { France: [1, 2] }, { at: 0 })).toThrow(
      'cartogram() takes one number per region, but "250" has a list.',
    );
  });
});

describe("toBars()", () => {
  const people = { France: 67, Germany: 83, Spain: 47, Italy: 60 };
  const frame = rect(600, 100, 300, 200);
  const { bars } = toBars(map, people, { at: 1, frame });

  test("sorts the biggest first and scales width to value", () => {
    expect(bars.map((b) => b.region.properties?.name)).toEqual([
      "Germany",
      "France",
      "Italy",
      "Spain",
    ]);
    expect(bars[0]!.rect.w).toBe(300);
    expect(bars[1]!.rect.w).toBeCloseTo((300 * 67) / 83, 0);
    expect(bars[0]!.rect.y).toBeLessThan(bars[1]!.rect.y);
    expect(bars.at(-1)!.rect.y + bars.at(-1)!.rect.h).toBeLessThanOrEqual(300);
  });

  test("keeps only the top few and can run smallest first", () => {
    const two = toBars(map, people, { at: 1, frame, top: 2, order: "asc" });

    expect(two.bars.map((b) => b.region.properties?.name)).toEqual(["France", "Germany"]);
    expect(two.rest).toContain(map.region("Spain").d);
  });

  test("morphs through the d channel", () => {
    expect(
      scene(toBars(map, people, { at: 1, frame }).node).match(/attributeName="d"/g),
    ).toHaveLength(4);
  });
});

describe("traffic()", () => {
  const lines = [
    [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ],
    {
      points: [
        { x: 0, y: 50 },
        { x: 100, y: 80 },
      ],
      weight: 3,
    },
  ];

  test("sends rate times the span of particles and is deterministic by seed", () => {
    const a = traffic(lines, { during: { at: 1, over: 4 }, rate: 5, seed: 7 });
    const b = traffic(lines, { during: { at: 1, over: 4 }, rate: 5, seed: 7 });
    const c = traffic(lines, { during: { at: 1, over: 4 }, rate: 5, seed: 8 });

    expect(a.count).toBe(20);
    expect(scene(a.node)).toBe(scene(b.node));
    expect(scene(a.node)).not.toBe(scene(c.node));
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
