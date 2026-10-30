import { describe, expect, test } from "bun:test";
import { chart } from "../../src/index.ts";
import { band } from "../helpers/charts.ts";

describe("bars", () => {
  test("each bar rests with its top at y(value) and its foot on the baseline", () => {
    const c = band();
    const { bars } = c.bars({ Q1: 12, Q4: 87 });
    expect(bars.map((b) => b.key)).toEqual(["Q1", "Q4"]);
    expect(bars[1]!.bounds.y).toBeCloseTo(c.y(87), 1);
    expect(bars[1]!.bounds.y + bars[1]!.bounds.h).toBeCloseTo(c.y(0), 1);
  });

  test("a negative bar hangs from the zero line", () => {
    const c = chart({
      width: 400,
      height: 200,
      x: { kind: "band", domain: ["a", "b"] },
      y: { domain: [-50, 50] },
    });

    const [up, down] = c.bars({ a: 25, b: -25 }).bars;
    expect(up!.bounds.y + up!.bounds.h).toBeCloseTo(c.y(0), 1);
    expect(down!.bounds.y).toBeCloseTo(c.y(0), 1);
    expect(down!.bounds.y + down!.bounds.h).toBeCloseTo(c.y(-25), 1);
  });
});
