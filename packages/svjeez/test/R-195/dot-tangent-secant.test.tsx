import { describe, expect, test } from "bun:test";
import { ease, validateSvg } from "svjeez";
import { commands, graph, smilValues, square, svgOf } from "../helpers/calculus";

describe("dot()", () => {
  test("sits on the curve and rides it as x sweeps", () => {
    const ax = graph();
    const dot = ax.dot(square, { from: -2, to: 2, at: 1, over: 2, ease: ease.linear });
    const svg = svgOf(dot.node);

    expect(validateSvg(svg).errors).toEqual([]);
    expect(dot.point(2).x).toBeCloseTo(ax.point(0, 0).x);
    expect(svg).toContain("@keyframes");
  });
});

describe("tangent() and secant()", () => {
  test("the tangent's slope is the derivative", () => {
    const line = graph().tangent(square, 1.5);

    expect(line.slope(0)).toBeCloseTo(3, 6);
  });

  test("a secant whose h shrinks to 0 ends on the tangent", () => {
    const ax = graph();
    const secant = ax.secant(square, 1, { from: 1.5, to: 0, at: 0, over: 3 });
    const tangent = ax.tangent(square, 1);

    expect(secant.slope(0)).toBeCloseTo(3.5, 9);
    expect(secant.slope(3)).toBeCloseTo(2, 6);

    const moving = smilValues(svgOf(secant.node));
    const still = svgOf(tangent.node).match(/<path [^>]*\bd="([^"]*)"/)![1]!;

    expect(moving.length).toBeGreaterThan(2);
    expect(moving.at(-1)).toBe(still);
  });

  test("a tangent sliding along x moves its d through SMIL", () => {
    const values = smilValues(
      svgOf(graph().tangent(square, { from: -2, to: 2, at: 0, over: 4 }).node),
    );

    expect(new Set(values.map(commands)).size).toBe(1);
    expect(values.length).toBeGreaterThan(3);
  });
});
