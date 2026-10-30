import { describe, expect, test } from "bun:test";
import { sampled } from "svjeez";

describe("sampled", () => {
  test("a fractional precision is an error", () => {
    const wave = (t: number) => ({ x: 10.123456 * Math.sin(t), y: 3.98765 * t });

    expect(() =>
      sampled(wave, { duration: 1, precision: 0.5, tolerance: { translate: 1 } }),
    ).toThrow(/whole, non-negative precision, got 0.5/);
  });
});
