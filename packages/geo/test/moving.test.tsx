import { describe, expect, test } from "bun:test";
import { geoContains, geoEqualEarth, geoMercator, geoNaturalEarth1, geoOrthographic } from "d3-geo";
import { motion, rect, render } from "svjeez";
import { feature } from "topojson-client";
import { createRequire } from "node:module";
import {
  globe,
  nightfall,
  project,
  reproject,
  sun,
  trueSize,
  type LonLat,
  type Topology,
} from "../src/index.ts";

const world: Topology = createRequire(import.meta.url)("world-atlas/countries-110m.json");
const land = feature(world, world.objects.countries!);

const commands = (d: string) => d.replace(/-?\d*\.?\d+(e-?\d+)?/g, "#").replace(/[\s,]+/g, "");

const rings = (d: string) =>
  d
    .split("M")
    .filter(Boolean)
    .map((ring) => {
      const n = ring.replace(/Z/g, "").trim().split(/\s+/).map(Number);

      return Array.from({ length: n.length / 2 }, (_, i) => [n[2 * i]!, n[2 * i + 1]!] as const);
    });

/** Nonzero winding of a point against every ring of a path. */
const filled = (d: string, x: number, y: number) =>
  rings(d).reduce((w, ring) => {
    let sum = 0;

    for (let i = 0; i < ring.length; i++) {
      const [ax, ay] = ring[i]!;
      const [bx, by] = ring[(i + 1) % ring.length]!;
      const cross = (bx - ax) * (y - ay) - (x - ax) * (by - ay);

      if (ay <= y && by > y && cross > 0) sum++;
      else if (ay > y && by <= y && cross < 0) sum--;
    }

    return w + sum;
  }, 0) !== 0;

const area = (d: string) =>
  rings(d).reduce(
    (sum, ring) =>
      sum +
      Math.abs(
        ring.reduce((s, [x, y], i) => {
          const [nx, ny] = ring[(i + 1) % ring.length]!;

          return s + x * ny - nx * y;
        }, 0) / 2,
      ),
    0,
  );

const frame = rect(0, 0, 400, 400);

/** Share of a grid over the visible disk where `paths` agree with `truth` at the facing `middle`. */
const agreement = (
  paths: readonly string[],
  middle: LonLat,
  truth: (at: [number, number]) => boolean,
) => {
  const ortho = geoOrthographic().rotate([-middle[0], -middle[1]]).scale(200).translate([200, 200]);

  let total = 0;
  let same = 0;

  for (let x = 4; x < 400; x += 8)
    for (let y = 4; y < 400; y += 8) {
      if (Math.hypot(x - 200, y - 200) > 196) continue;
      const at = ortho.invert!([x, y])!;
      total++;

      if (paths.some((d) => filled(d, x, y)) === truth(at)) same++;
    }

  return same / total;
};

describe("globe()", () => {
  const spin = { from: 20, to: -340, over: 12 };

  test("draws the land a viewer would see, at every facing", () => {
    for (const tilt of [22, 0, -40]) {
      const earth = globe(world, { frame, tilt, spin, simplify: 0.3, step: 3 });
      const pieces = earth.land();

      expect(pieces.length).toBeGreaterThan(4);
      expect(
        agreement(
          pieces.map((p) => p.d),
          earth.facing(0),
          (at) => geoContains(land, at),
        ),
      ).toBeGreaterThan(0.98);
    }
  });

  test("animates every piece of land through d, with the same commands throughout", () => {
    const earth = globe(world, { frame, tilt: 22, spin });

    const svg = render(
      { width: 400, height: 400, duration: 12, title: "Globe" },
      <>
        {earth.land().map((p) => (
          <path {...p} />
        ))}
      </>,
    );

    for (const values of svg.matchAll(/values="([^"]*)"/g)) {
      const keys = values[1]!.split(";");

      expect(new Set(keys.map(commands)).size).toBe(1);
    }

    expect(svg).toContain('attributeName="d"');
  });

  test("covers the night side and leaves the day side", () => {
    const date = new Date(Date.UTC(2026, 2, 20, 12));
    const earth = globe(world, { frame, tilt: 10, spin });
    const night = earth.night(date).d;
    const [lon, lat] = sun(date);
    expect(
      agreement([night], earth.facing(0), ([x, y]) => {
        const r = Math.PI / 180;

        return (
          Math.sin(y * r) * Math.sin(lat * r) +
            Math.cos(y * r) * Math.cos(lat * r) * Math.cos((x - lon) * r) <
          0
        );
      }),
    ).toBeGreaterThan(0.98);
  });

  test("starts a route at its first place while both ends face the viewer", () => {
    const earth = globe(world, { frame, tilt: 22, spin: { from: -40, to: -40, over: 1 } });
    const london: LonLat = [-0.13, 51.5];
    const first = rings(earth.route(london, [-74, 40.7]).d)[0]![0]!;
    const { point } = earth.locate(london, 0);

    expect(Math.hypot(first[0] - point.x, first[1] - point.y)).toBeLessThan(0.2);
  });

  test("fades a place out behind the globe", () => {
    const earth = globe(world, { frame, tilt: 0, spin: { from: 0, to: -180, over: 4 } });

    const svg = render(
      { width: 400, height: 400, duration: 4, title: "Place" },
      <g {...earth.place([0, 0])} />,
    );

    expect(svg).toMatch(/opacity:1/);
    expect(svg).toMatch(/opacity:0/);
  });

  test("needs a duration with a spin function", () => {
    expect(() => globe(world, { frame, spin: (t) => [t, 0] })).toThrow(
      "globe() with a spin function needs a duration",
    );
  });
});

describe("reproject()", () => {
  const filter = (f: { properties: { name?: string } | null }) =>
    f.properties?.name !== "Antarctica";

  const maps = reproject(world, [geoMercator(), geoEqualEarth(), geoNaturalEarth1()], {
    frame,
    filter,
  });

  test("writes each region with the same commands under every projection", () => {
    for (const region of maps.regions) expect(new Set(region.d.map(commands)).size).toBe(1);

    expect(new Set(maps.land.map(commands)).size).toBe(1);
  });

  test("morphs through the d channel", () => {
    const [a, b] = maps.region("Greenland").d;

    const svg = render(
      { width: 400, height: 400, duration: 2, title: "Morph" },
      <path d={a!} animation={motion({ d: a! }).to({ d: b! }, 1)} />,
    );

    expect(svg).toContain('attributeName="d"');
  });

  test("shrinks Greenland from Mercator to equal area", () => {
    const [mercator, equal] = maps.region("Greenland").d;

    expect(area(equal!)).toBeLessThan(area(mercator!) / 3);
  });

  test("names the region Mercator can't fit", () => {
    expect(() => reproject(world, [geoMercator(), geoEqualEarth()], { frame })).toThrow(
      "reproject() puts Antarctica far outside the frame under projection 0.",
    );
  });
});

describe("trueSize()", () => {
  test("shrinks Greenland as it slides to the equator on Mercator", () => {
    const map = project(world, {
      frame,
      projection: geoMercator(),
      filter: (f) => f.properties?.name !== "Antarctica",
    });

    const slide = trueSize(map, map.region("Greenland"), [-20, 0], { over: 2 });

    const svg = render(
      { width: 400, height: 400, duration: 2, title: "Slide" },
      <path {...slide} />,
    );

    const keys = svg.match(/values="([^"]*)"/)![1]!.split(";");

    expect(area(keys.at(-1)!)).toBeLessThan(area(keys[0]!) / 5);
  });
});

describe("nightfall()", () => {
  const map = project(world, {
    frame,
    projection: geoNaturalEarth1(),
    fit: "sphere",
  });

  test("keeps one shape through an equinox", () => {
    const start = Date.UTC(2026, 2, 10, 12);
    const night = nightfall(map, (t) => new Date(start + t * 86_400_000), { duration: 20 });

    expect(() =>
      render({ width: 400, height: 400, duration: 20, title: "Year" }, <path {...night} />),
    ).not.toThrow();
  });

  test("lights the north pole in June", () => {
    const june = nightfall(map, () => new Date(Date.UTC(2026, 5, 21, 12)), { duration: 1 });
    const north = map.point([0, 85]);
    const south = map.point([0, -85]);

    expect(filled(june.d, north.x, north.y)).toBe(false);
    expect(filled(june.d, south.x, south.y)).toBe(true);
  });
});
