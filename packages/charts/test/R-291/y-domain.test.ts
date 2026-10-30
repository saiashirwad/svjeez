import { describe, expect, test } from "bun:test";
import { chart } from "../../src/index.ts";
import { band, quarters, scene } from "../helpers/charts.ts";

describe("chart frame", () => {
  test("a fitted y domain includes 0 and is niced, so the baseline is the bottom of the plot", () => {
    const c = band();
    expect(c.y(0)).toBe(220);
    expect(c.y(100)).toBe(20);
    expect(scene(c.node)).toContain(">100</text>");
  });

  test("zero: false fits the data alone", () => {
    const c = chart({
      width: 400,
      height: 200,
      x: { kind: "band", domain: quarters },
      y: { zero: false },
      data: [
        ["Q1", 52],
        ["Q4", 87],
      ],
    });

    expect(c.y(50)).toBe(200);
  });

  test("an explicit domain is niced and wins over data", () => {
    const c = chart({
      width: 400,
      height: 200,
      x: { kind: "linear", domain: [0, 9.7], ticks: 5 },
      y: { domain: [3, 97] },
    });

    expect(c.y(100)).toBe(0);
  });
});
