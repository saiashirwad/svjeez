import { describe, expect, test } from "bun:test";
import { project } from "../../src/index.ts";
import { frame, map, world } from "../helpers/geo-world.ts";

describe("project()", () => {
  test("fits the regions inside the frame", () => {
    const all = map.bounds(map.regions);

    expect(all.x).toBeGreaterThanOrEqual(frame.x - 0.5);
    expect(all.y).toBeGreaterThanOrEqual(frame.y - 0.5);
    expect(all.x + all.w).toBeLessThanOrEqual(frame.x + frame.w + 0.5);
    expect(all.y + all.h).toBeLessThanOrEqual(frame.y + frame.h + 0.5);
  });

  test("filters before fitting, and builds land and lines from what it kept", () => {
    const france = project(world, { frame, filter: (f) => f.properties?.name === "France" });

    expect(france.regions.map((r) => r.id)).toEqual(["250"]);
    const all = france.bounds(france.region("France").feature);

    expect(Math.max(all.w / frame.w, all.h / frame.h)).toBeCloseTo(1, 2);
    expect(france.lines.length).toBeLessThan(map.lines.length / 20);
  });
});
