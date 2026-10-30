import { describe, expect, test } from "bun:test";
import { geoEqualEarth, geoMercator, geoNaturalEarth1 } from "d3-geo";
import { motion, render } from "svjeez";
import { reproject } from "../../src/index.ts";
import { world } from "../helpers/geo-world.ts";
import { area, commands, frame } from "../helpers/moving.ts";

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
