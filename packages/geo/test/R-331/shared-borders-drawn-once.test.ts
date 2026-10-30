import { describe, expect, test } from "bun:test";
import { map } from "../helpers/geo-world.ts";

describe("project()", () => {
  test("draws each shared border once in lines", () => {
    const outlines = map.regions.reduce((n, r) => n + r.d.length, 0);

    expect(map.lines.length).toBeLessThan(outlines * 0.85);
    expect(map.land.length).toBeLessThan(map.lines.length);
  });
});
