import { describe, expect, test } from "bun:test";
import { graph, smilValues, square, svgOf } from "../helpers/calculus";

describe("area()", () => {
  test("measures the region and grows with its right bound", () => {
    const area = graph().area(square, 0, { from: 0, to: 2, at: 1, over: 2 });

    expect(area.value(0)).toBeCloseTo(0);
    expect(area.value(3)).toBeCloseTo(8 / 3, 3);
    expect(smilValues(svgOf(area.node)).at(-1)).toMatch(/Z$/);
  });
});
