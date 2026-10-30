import { describe, expect, test } from "bun:test";
import { geoNaturalEarth1 } from "d3-geo";
import { project } from "../../src/index.ts";
import { frame, LONDON, map, NEW_YORK, SAN_FRANCISCO, TOKYO, world } from "../helpers/geo-world.ts";

describe("route()", () => {
  test("arcs north along the great circle from end to end", () => {
    const route = map.route(NEW_YORK, LONDON);
    const [from, to] = [map.point(NEW_YORK), map.point(LONDON)];

    expect(route[0]).toEqual(from);
    expect(route.at(-1)).toEqual(to);
    expect(Math.min(...route.map((p) => p.y))).toBeLessThan(Math.min(from.y, to.y) - 5);
  });

  test("throws when the route crosses the edge of the map, and works once the projection is rotated", () => {
    expect(() => map.route(TOKYO, SAN_FRANCISCO)).toThrow(/crosses the edge of the map/);

    const pacific = project(world, { frame, projection: geoNaturalEarth1().rotate([-150, 0]) });

    expect(pacific.route(TOKYO, SAN_FRANCISCO).length).toBeGreaterThan(70);
  });

  test("tells the caller to use line() when the route crosses the edge", () => {
    expect(() => map.route(TOKYO, SAN_FRANCISCO)).toThrow(/use line\(\)/);
  });
});
