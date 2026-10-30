import { describe, expect, test } from "bun:test";
import { geoContains } from "d3-geo";
import { night, sun } from "../../src/index.ts";

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
