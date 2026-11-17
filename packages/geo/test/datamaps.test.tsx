import { describe, expect, test } from "bun:test";
import { createRequire } from "node:module";
import { render, type SvgNode } from "svjeez";
import { rect } from "svjeez/geometry";
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
    // SAFETY: the type already rejects "red"; the cast lets the test reach the runtime check for JavaScript callers.
    expect(() => sequential(["red", "#fff"] as never, { domain: [0, 1] })).toThrow(
      'A color scale needs hex colors such as "#1f77b4", got "red".',
    );
    expect(() => sequential(["#000", "#fff"], { domain: [1, 1] })).toThrow("domain that rises");
  });
});

describe("legend()", () => {
  test("draws a swatch per class and labels the edges", () => {
    const scale = sequential(palettes.viridis, { domain: [0, 80], steps: 4 });
    const key = legend(scale, { frame: rect(10, 28, 200, 10), every: 1, title: "Years" });
    const svg = scene(key.node);

    expect(svg.match(/<rect/g)).toHaveLength(4);

    for (const label of ["0", "20", "40", "60", "80", "Years"]) expect(svg).toContain(`>${label}<`);

    expect(key.bounds).toMatchObject({ x: 10, y: 11, w: 200 });
    expect(key.bounds.y + key.bounds.h).toBeGreaterThan(38 + 11);
  });
});

describe("choropleth()", () => {
  const scale = sequential(palettes.blues, { domain: [0, 100], steps: 4 });

  test("shares one path among regions of the same color and reports keys it can't place", () => {
    const { node, unmatched, groups } = choropleth(
      { at: 0, over: 0 },
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
      [
        { at: 0, over: 0 },
        { at: 3, over: 1 },
      ],
      map,
      { France: [10, 90], Germany: [10, 90], Spain: [90, 10] },
      { scale },
    );

    expect(groups).toBe(2);
    const svg = scene(node);
    expect(svg).toMatch(/@keyframes[^{]*\{[^}]*fill:/);
    expect(svg.match(/@keyframes/g)!.length).toBeGreaterThan(0);
  });

  test("its parts are the regions values names, each with when it fills", () => {
    const result = choropleth(
      [
        { at: 1, over: 1 },
        { at: 3, over: 1 },
        { at: 5, over: 1 },
      ],
      map,
      { France: [10, 10, 90], Germany: 10, Spain: [10, 90, 90] },
      { scale },
    );

    expect(result.parts.map((r) => r.properties?.name)).toEqual(["France", "Germany", "Spain"]);
    expect(result.part("France").span).toMatchObject({ at: 1, over: 5 });
    expect(result.part("Germany").span).toMatchObject({ at: 1, over: 1 });
    expect(result.part("724").span).toMatchObject({ at: 1, over: 3 });
    expect(result.span).toMatchObject({ at: 1, over: 5 });
    expect(result.part("France").box).toEqual(map.part("France").box);
    expect(() => result.part("Canada")).toThrow('choropleth() has no value for "Canada".');
  });

  test("a region cut to its color from the start fills at the instant 0", () => {
    const result = choropleth({ at: 0, over: 0 }, map, { France: 10 }, { scale });

    expect(result.part("France").span).toMatchObject({ at: 0, over: 0 });
  });

  test("names the fix when the spans don't match the values", () => {
    expect(() =>
      choropleth(
        [
          { at: 0, over: 0 },
          { at: 1, over: 1 },
        ],
        map,
        { France: [1, 2, 3] },
        { scale },
      ),
    ).toThrow("choropleth() has 3 values per region but 2 spans. Pass one span per value.");
  });
});

describe("cartogram()", () => {
  const people = { France: 67, Germany: 83, Spain: 47, Italy: 60, Poland: 38, Portugal: 10 };
  const result = cartogram({ at: 2, over: 1 }, map, people);

  test("sizes circles by area and keeps them apart", () => {
    const [de, pt] = ["Germany", "Portugal"].map((n) =>
      result.parts.find((b) => b.region.properties?.name === n)!,
    );

    expect((de!.r / pt!.r) ** 2).toBeCloseTo(83 / 10, 0);

    for (const [i, a] of result.parts.entries())
      for (const b of result.parts.slice(i + 1))
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(a.r + b.r - 0.5);
  });

  test("each circle is a part, with its box and the span its region morphs in", () => {
    const de = result.part("Germany");
    const staggered = cartogram({ at: 2, over: 2 }, map, people, { stagger: 0.3 });

    expect(de.box).toMatchObject({ x: de.x - de.r, w: de.r * 2 });
    expect(de.span).toMatchObject({ at: 2, over: 1 });
    expect(staggered.parts.map((p) => p.span.at)).toEqual(
      [2, 2.3, 2.6, 2.9, 3.2, 3.5].map((t) => expect.closeTo(t, 6)),
    );
    expect(staggered.part("Portugal").span.end).toBeCloseTo(4, 6);
  });

  test("is the same every time", () => {
    const circles = (c: typeof result) => c.parts.map(({ id, x, y, r }) => ({ id, x, y, r }));

    expect(circles(cartogram({ at: 2, over: 1 }, map, people))).toEqual(circles(result));
  });

  test("morphs each outline into a circle through the d channel, and returns the rest of the map", () => {
    const svg = scene(result.node);

    expect(svg.match(/<animate\b[^>]*attributeName="d"/g)).toHaveLength(6);
    expect(result.rest).toContain(map.part("Canada").d);
    expect(result.rest).not.toContain(map.part("France").d);
  });

  test("a stagger spreads the starts inside the span, so the last shape lands with it", () => {
    const svg = scene(cartogram({ at: 2, over: 2 }, map, people, { stagger: 0.3 }).node);

    const durations = [
      ...svg.matchAll(/<animate\b[^>]*attributeName="d"[^>]*dur="([\d.]+)s"/g),
    ].map((m) => +m[1]!);

    expect(durations).toHaveLength(6);

    for (const dur of durations) expect(dur).toBeCloseTo(2 - 5 * 0.3, 6);

    expect(() => cartogram({ at: 2, over: 1 }, map, people, { stagger: 0.3 })).toThrow(
      "A morph needs a start of 0 or later and a span longer than its 5 staggers of 0.3s",
    );
  });

  test("asks for one number per region", () => {
    expect(() => cartogram({ at: 0, over: 1 }, map, { France: [1, 2] })).toThrow(
      'cartogram() takes one number per region, but "250" has a list.',
    );
  });
});

describe("toBars()", () => {
  test("top must be a whole number of at least 1", () => {
    const frame = rect(0, 0, 100, 100);

    for (const top of [0, -1, 1.5])
      expect(() => toBars({ at: 0, over: 1 }, map, { France: 1 }, { frame, top })).toThrow(
        `toBars() needs top to be a whole number of at least 1, got ${top}.`,
      );
  });

  const people = { France: 67, Germany: 83, Spain: 47, Italy: 60 };
  const frame = rect(600, 100, 300, 200);
  const { parts: bars } = toBars({ at: 1, over: 1 }, map, people, { frame });

  test("sorts the biggest first and scales width to value", () => {
    expect(bars.map((b) => b.region.properties?.name)).toEqual([
      "Germany",
      "France",
      "Italy",
      "Spain",
    ]);
    expect(bars[0]!.box.w).toBe(300);
    expect(bars[1]!.box.w).toBeCloseTo((300 * 67) / 83, 0);
    expect(bars[0]!.box.y).toBeLessThan(bars[1]!.box.y);
    expect(bars.at(-1)!.box.y + bars.at(-1)!.box.h).toBeLessThanOrEqual(300);
  });

  test("keeps only the top few and can run smallest first", () => {
    const two = toBars({ at: 1, over: 1 }, map, people, { frame, top: 2, order: "asc" });

    expect(two.parts.map((b) => b.region.properties?.name)).toEqual(["France", "Germany"]);
    expect(two.rest).toContain(map.part("Spain").d);
  });

  test("morphs through the d channel", () => {
    expect(
      scene(toBars({ at: 1, over: 1 }, map, people, { frame }).node).match(
        /<animate\b[^>]*attributeName="d"/g,
      ),
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
    const a = traffic({ at: 1, over: 4 }, lines, { rate: 5, seed: 7 });
    const b = traffic({ at: 1, over: 4 }, lines, { rate: 5, seed: 7 });
    const c = traffic({ at: 1, over: 4 }, lines, { rate: 5, seed: 8 });

    expect(a.count).toBe(20);
    expect(scene(a.node)).toBe(scene(b.node));
    expect(scene(a.node)).not.toBe(scene(c.node));
    expect(a.span.end).toBeGreaterThan(5);
  });

  test("favors heavier routes", () => {
    const { node } = traffic({ at: 0, over: 8 }, lines, { rate: 25, seed: 3 });
    const svg = scene(node);
    const ends = [...svg.matchAll(/translate:100px (0|80)px/g)].map((m) => m[1]);

    expect(ends.filter((y) => y === "80").length).toBeGreaterThan(
      ends.filter((y) => y === "0").length,
    );
  });

  test("rejects a rate it can't use", () => {
    expect(() => traffic({ at: 0, over: 1 }, lines, { rate: 0 })).toThrow("positive rate");
  });

  test("its parts are the routes, each spanning its first departure to its last arrival", () => {
    const idle = { id: "idle", points: [{ x: 0, y: 0 }], weight: 0 };
    const run = traffic({ at: 1, over: 4 }, [...lines, idle], { rate: 5, seed: 7 });

    expect(run.parts.map((p) => p.id)).toEqual(["0", "1", "idle"]);
    expect(run.parts.reduce((sum, p) => sum + p.count, 0)).toBe(run.count);
    expect(Math.min(...run.parts.slice(0, 2).map((p) => p.span.at))).toBeGreaterThanOrEqual(1);
    expect(Math.max(...run.parts.map((p) => p.span.end))).toBeCloseTo(run.span.end, 9);
    expect(run.part("1").box).toMatchObject({ x: 0, y: 50, w: 100, h: 30 });
    expect(run.part("idle")).toMatchObject({ count: 0, span: { at: 0, over: 0 } });
    expect(run.bounds).toMatchObject({ x: 0, y: 0, w: 100, h: 80 });
    expect(() => run.part("2")).toThrow(
      'traffic() has no route "2". Its routes are "0", "1", "idle".',
    );
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
