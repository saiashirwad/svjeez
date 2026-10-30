import { describe, expect, test } from "bun:test";
import { band } from "../helpers/charts.ts";

describe("errors name the call, what it got and the fix", () => {
  const c = band();

  test("bars()", () => {
    expect(() => c.bars({ Q1: 500 })).toThrow(
      `bars() got 500 for "Q1", outside the y domain [0, 100].`,
    );
  });

  test("line() and area()", () => {
    expect(() => c.line([["Q1", 1]])).toThrow("line() needs at least 2 points, got 1.");
    expect(() =>
      c.line([
        ["Q1", 1],
        ["Q9", 2],
      ]),
    ).toThrow(`line() got "Q9" at index 1, which is not in the x domain`);
    expect(() =>
      c.line([
        ["Q1", 1],
        ["Q2", Number.POSITIVE_INFINITY],
      ]),
    ).toThrow("line() needs finite values, got [Q2, Infinity] at index 1.");
    expect(() =>
      c.area([
        ["Q1", 1],
        ["Q2", 900],
      ]),
    ).toThrow("area() got [Q2, 900] at index 1, outside the chart");
  });
});
