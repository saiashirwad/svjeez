import { describe, expect, test } from "bun:test";
import { chart } from "../../src/index.ts";

describe("chart frame", () => {
  test("an explicit domain is niced and wins over data", () => {
    const c = chart({
      width: 400,
      height: 200,
      x: { kind: "linear", domain: [0, 9.7], ticks: 5 },
      y: { domain: [3, 97] },
    });

    expect(c.x(10)).toBe(400);
  });

  test("a linear x scale fits the data when it has no domain", () => {
    const c = chart({
      width: 300,
      height: 100,
      x: { kind: "linear" },
      data: [
        [2, 1],
        [8, 5],
      ],
    });

    expect(c.x(2)).toBeGreaterThanOrEqual(0);
    expect(c.x(8)).toBeLessThanOrEqual(300);
  });
});
