import { describe, expect, test } from "bun:test";
import { ease } from "svjeez";
import { graph, square } from "../helpers/calculus";

describe("dot()", () => {
  test("holds the sweep's end values at its ends", () => {
    const ax = graph();
    const dot = ax.dot(square, { from: -2, to: 2, at: 1, over: 2, ease: ease.linear });

    expect(dot.point(0)).toEqual(ax.point(-2, 4));
    expect(dot.point(3)).toEqual(ax.point(2, 4));
  });

  test("chained sweeps hold between them", () => {
    const ax = graph();

    const dot = ax.dot(square, [
      { from: 0, to: 2, at: 0, over: 1 },
      { from: 2, to: -1, at: 3, over: 1 },
    ]);

    expect(dot.point(2)).toEqual(ax.point(2, 4));
    expect(dot.point(5)).toEqual(ax.point(-1, 1));
  });
});
