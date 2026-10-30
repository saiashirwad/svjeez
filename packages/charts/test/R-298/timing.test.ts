import { describe, expect, test } from "bun:test";
import { band, lineChart, points, scene } from "../helpers/charts.ts";

describe("bars", () => {
  test("bars grow with a stagger and report when the last one lands", () => {
    const c = band();
    const result = c.bars({ Q1: 12, Q2: 48, Q3: 31, Q4: 87 }, { at: 1, over: 0.5, stagger: 0.2 });
    expect(result.end).toBeCloseTo(2.1, 6);
    const svg = scene(result.node);
    expect(svg).toContain("@keyframes");
    expect(svg.match(/animation-name:/g)?.length).toBe(4);
  });
});

describe("line and area", () => {
  test("a line reports when its draw-on lands", () => {
    const line = lineChart().line(points, { at: 1, over: 2 });
    expect(line.end).toBe(3);
  });
});

describe("errors name the call, what it got and the fix", () => {
  test("bars()", () => {
    expect(() => band().bars({ Q1: 1 }, { over: 0 })).toThrow(
      "bars() needs a positive over, got 0.",
    );
  });
});
