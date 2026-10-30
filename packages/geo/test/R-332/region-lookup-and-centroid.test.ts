import { describe, expect, test } from "bun:test";
import { map } from "../helpers/geo-world.ts";

describe("project()", () => {
  test("finds a region by name or by id", () => {
    expect(map.region("France").id).toBe("250");
    expect(map.region(250).properties?.name).toBe("France");
  });

  test("names the regions it has when one is missing", () => {
    expect(() => map.region("Atlantis")).toThrow(/no region "Atlantis".*"242"/);
  });

  test("centers a region on its largest piece", () => {
    const france = map.region("France");
    const { x, y } = map.point([2.35, 46.6]);

    expect(Math.hypot(france.centroid.x - x, france.centroid.y - y)).toBeLessThan(6);
    expect(map.bounds(france.feature).w).toBeGreaterThan(france.bounds.w * 3);
  });
});
