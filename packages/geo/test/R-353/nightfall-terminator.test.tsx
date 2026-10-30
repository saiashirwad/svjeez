import { describe, expect, test } from "bun:test";
import { geoNaturalEarth1 } from "d3-geo";
import { render } from "svjeez";
import { nightfall, project } from "../../src/index.ts";
import { world } from "../helpers/geo-world.ts";
import { filled, frame } from "../helpers/moving.ts";

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
