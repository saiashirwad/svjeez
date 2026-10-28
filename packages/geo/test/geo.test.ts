import { describe, expect, test } from "bun:test";
import { geoContains, geoOrthographic } from "d3-geo";
import { rect } from "svjeez";
import { createRequire } from "node:module";
import { night, project, sun, type LonLat, type Topology } from "../src/index.ts";

const world: Topology = createRequire(import.meta.url)("world-atlas/countries-110m.json");
const frame = rect(20, 10, 960, 500);
const map = project(world, { frame });

const NEW_YORK: LonLat = [-74, 40.7];
const LONDON: LonLat = [-0.13, 51.5];
const TOKYO: LonLat = [139.7, 35.7];
const SAN_FRANCISCO: LonLat = [-122.4, 37.8];

const numbers = (d: string) => d.match(/-?\d*\.?\d+/g)!.map(Number);

describe("project()", () => {
  test("reads every country from the topology's first object", () => {
    expect(map.regions).toHaveLength(177);
    expect(map.region("France").id).toBe("250");
    expect(map.region(250).properties?.name).toBe("France");
  });

  test("names the regions it has when one is missing", () => {
    expect(() => map.region("Atlantis")).toThrow(/no region "Atlantis".*"242"/);
  });

  test("rounds every coordinate to a tenth of a pixel", () => {
    for (const r of map.regions)
      for (const n of numbers(r.d)) expect(Math.round(n * 10)).toBe(n * 10);
  });

  test("fits the regions inside the frame", () => {
    const all = map.bounds(map.regions);

    expect(all.x).toBeGreaterThanOrEqual(frame.x - 0.5);
    expect(all.y).toBeGreaterThanOrEqual(frame.y - 0.5);
    expect(all.x + all.w).toBeLessThanOrEqual(frame.x + frame.w + 0.5);
    expect(all.y + all.h).toBeLessThanOrEqual(frame.y + frame.h + 0.5);
  });

  test("a larger tolerance writes less path data", () => {
    const size = (tolerance: number) =>
      project(world, { frame, tolerance }).regions.reduce((n, r) => n + r.d.length, 0);

    expect(size(2)).toBeLessThan(size(0.5));
    expect(size(0.5)).toBeLessThan(size(0));
  });

  test("draws each shared border once in lines", () => {
    const outlines = map.regions.reduce((n, r) => n + r.d.length, 0);

    expect(map.lines.length).toBeLessThan(outlines * 0.85);
    expect(map.land.length).toBeLessThan(map.lines.length);
  });

  test("filters before fitting, and builds land and lines from what it kept", () => {
    const france = project(world, { frame, filter: (f) => f.properties?.name === "France" });

    expect(france.regions.map((r) => r.id)).toEqual(["250"]);
    const all = france.bounds(france.region("France").feature);

    expect(Math.max(all.w / frame.w, all.h / frame.h)).toBeCloseTo(1, 2);
    expect(france.lines.length).toBeLessThan(map.lines.length / 20);
  });

  test("centers a region on its largest piece", () => {
    const france = map.region("France");
    const { x, y } = map.point([2.35, 46.6]);

    expect(Math.hypot(france.centroid.x - x, france.centroid.y - y)).toBeLessThan(6);
    expect(map.bounds(france.feature).w).toBeGreaterThan(france.bounds.w * 3);
  });

  test("takes GeoJSON as well as TopoJSON", () => {
    const square = project(
      {
        type: "Feature",
        id: "square",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [0, 0],
              [0, 10],
              [10, 10],
              [10, 0],
              [0, 0],
            ],
          ],
        },
      },
      { frame },
    );

    expect(square.region("square").d).toMatch(/^M[\d.]+ [\d.]+l.*z$/);
  });
});

describe("point()", () => {
  test("places a longitude and latitude in the frame", () => {
    const london = map.point(LONDON);
    const ny = map.point(NEW_YORK);

    expect(london.x).toBeGreaterThan(ny.x);
    expect(london.y).toBeLessThan(ny.y);
  });

  test("throws for a place on the far side of a globe", () => {
    const globe = project(world, {
      frame,
      projection: geoOrthographic().rotate([0, 0]),
      fit: "sphere",
    });

    expect(() => globe.point([180, 0])).toThrow(/far side of the globe/);
    expect(globe.point([0, 0]).x).toBeCloseTo(frame.x + frame.w / 2, 0);
  });
});

describe("route()", () => {
  test("arcs north along the great circle from end to end", () => {
    const route = map.route(NEW_YORK, LONDON);
    const [from, to] = [map.point(NEW_YORK), map.point(LONDON)];

    expect(route[0]).toEqual(from);
    expect(route.at(-1)).toEqual(to);
    expect(Math.min(...route.map((p) => p.y))).toBeLessThan(Math.min(from.y, to.y) - 5);
  });

  test("throws when the route crosses the edge of the map, and works once the projection is rotated", async () => {
    expect(() => map.route(TOKYO, SAN_FRANCISCO)).toThrow(/crosses the edge of the map/);

    const { geoNaturalEarth1 } = await import("d3-geo");
    const pacific = project(world, { frame, projection: geoNaturalEarth1().rotate([-150, 0]) });

    expect(pacific.route(TOKYO, SAN_FRANCISCO).length).toBeGreaterThan(70);
  });
});

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

describe("sun()", () => {
  test("stands over the Tropic of Cancer near Greenwich at noon on the June solstice", () => {
    const [lon, lat] = sun(new Date(Date.UTC(2026, 5, 21, 12)));

    expect(lat).toBeCloseTo(23.44, 1);
    expect(Math.abs(lon)).toBeLessThan(1);
  });

  test("moves 15 degrees west an hour", () => {
    const [noon] = sun(new Date(Date.UTC(2026, 2, 20, 12)));
    const [later] = sun(new Date(Date.UTC(2026, 2, 20, 13)));

    expect(noon - later).toBeCloseTo(15, 0);
  });

  test("night() is the hemisphere facing away from the sun", () => {
    const date = new Date(Date.UTC(2026, 5, 21, 12));
    const dark = { type: "Feature", properties: {}, geometry: night(date) } as const;

    expect(geoContains(dark, [180, 0])).toBe(true);
    expect(geoContains(dark, [0, 20])).toBe(false);
  });
});
