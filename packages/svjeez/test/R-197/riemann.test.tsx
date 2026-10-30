import { describe, expect, test } from "bun:test";
import { commands, graph, smilValues, square, svgOf } from "../helpers/calculus";

describe("riemann()", () => {
  test("every stage is one path with the same commands, and the sums converge", () => {
    const sums = (n: number) =>
      graph().riemann(square, { from: 0, to: 2, n, rule: "left" }).sums[0]!;

    const r = graph().riemann(square, { from: 0, to: 2, n: [2, 4, 8], at: [1, 3] });
    const values = smilValues(svgOf(r.node));

    expect(sums(2)).toBeCloseTo(1);
    expect(r.sums[2]!).toBeCloseTo(8 / 3, 1);
    expect(new Set(values.map(commands)).size).toBe(1);
    expect(values[0]!.match(/M/g)).toHaveLength(8);
  });

  test("needs one start time per later stage", () => {
    expect(() => graph().riemann(square, { n: [4, 8, 16], at: [1] })).toThrow(
      "riemann() has 3 stages, so it needs 2 start times in at, got 1.",
    );
  });
});
