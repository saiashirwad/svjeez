import { describe, expect, test } from "bun:test";
import { band, scene } from "../helpers/charts.ts";

describe("bars", () => {
  test("grouped series sit side by side inside a band", () => {
    const c = band();
    const a = c.bars({ Q1: 10 }, { group: { index: 0, count: 2 } }).bars[0]!.bounds;
    const b = c.bars({ Q1: 20 }, { group: { index: 1, count: 2 } }).bars[0]!.bounds;
    expect(b.x).toBeGreaterThanOrEqual(a.x + a.w);
    expect(a.w).toBeLessThan(c.bandwidth / 2);
  });

  test("values writes each number at its bar", () => {
    const svg = scene(band().bars({ Q4: 87 }, { values: true }).node);
    expect(svg).toContain(">87</text>");
  });
});
