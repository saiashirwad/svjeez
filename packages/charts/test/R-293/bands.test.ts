import { describe, expect, test } from "bun:test";
import { band, quarters } from "../helpers/charts.ts";

describe("chart frame", () => {
  test("bands sit in domain order, evenly, and x() returns each band's center", () => {
    const c = band();
    const centers = quarters.map((q) => c.x(q));
    expect(centers).toEqual([...centers].sort((a, b) => a - b));
    expect(centers[1]! - centers[0]!).toBeCloseTo(centers[2]! - centers[1]!, 6);
    expect(c.bandwidth).toBeGreaterThan(0);
    expect(c.bandwidth).toBeLessThan(100);
  });
});
