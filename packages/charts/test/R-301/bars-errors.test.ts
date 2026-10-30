import { describe, expect, test } from "bun:test";
import { chart } from "../../src/index.ts";
import { band } from "../helpers/charts.ts";

describe("errors name the call, what it got and the fix", () => {
  const c = band();

  test("bars()", () => {
    expect(() => c.bars({})).toThrow("bars() needs at least one value, got none.");
    expect(() => c.bars({ Q5: 1 })).toThrow(
      `bars() got "Q5", which is not in the x domain (Q1, Q2, Q3, Q4). Add it to x.domain.`,
    );
    expect(() => c.bars({ Q1: Number.NaN })).toThrow(
      `bars() needs finite values, got NaN for "Q1".`,
    );
    expect(() => c.bars({ Q1: 1 }, { group: { index: 2, count: 2 } })).toThrow(
      "bars() needs group.index below group.count, got 2 of 2.",
    );
  });

  test("bars() on a linear scale", () => {
    const linear = chart({
      width: 10,
      height: 10,
      x: { kind: "linear", domain: [0, 1] },
      y: { domain: [0, 1] },
    });

    // @ts-expect-error bars() exists only on a band scale
    expect(() => linear.bars({ a: 1 })).toThrow("bars() needs a band x scale, got a linear one.");
  });
});
