import { describe, expect, test } from "bun:test";
import { construct } from "../../src/index";
import { svg } from "../helpers/construct";

describe("construct", () => {
  test("labels are formulas placed off the lines that meet at the point", () => {
    const g = construct({ at: { x: 100, y: 200 }, unit: 10 });
    const [a, b, c] = [g.point(0, 0, "A"), g.point(10, 0, "B"), g.point(5, 8, "C")];

    g.polygon([a, b, c]);
    const out = svg(g.node);

    expect(out).toContain("<path");
    expect(() => construct({ unit: 0 })).toThrow(/positive unit/);
  });

  test("a circle needs a positive radius", () => {
    const g = construct();
    const a = g.point(0, 0);

    expect(() => g.circle(a, a)).toThrow(/positive radius/);
  });
});
