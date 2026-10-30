import { describe, expect, test } from "bun:test";
import { geoOrthographic } from "d3-geo";
import { project } from "../../src/index.ts";
import { frame, LONDON, map, NEW_YORK, world } from "../helpers/geo-world.ts";

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
