import { describe, expect, test } from "bun:test";
import { band, lineChart, points, scene } from "../helpers/charts.ts";

describe("line and area", () => {
  const c = lineChart();

  test("a line has one scene point per datum and draws on over its span", () => {
    const line = c.line(points, { at: 1, over: 2 });
    expect(line.points).toHaveLength(3);
    expect(line.points[1]).toEqual({ x: c.x(5), y: c.y(60) });
    expect(line.d).toMatch(/^M/);
    expect(scene(line.node)).toContain("stroke-dasharray");
  });

  test("curves change the path", () => {
    const [linear, smooth, step] = (["linear", "monotone", "step"] as const).map(
      (curve) => c.line(points, { curve }).d,
    );

    expect(new Set([linear, smooth, step]).size).toBe(3);
    expect(linear).not.toContain("C");
    expect(smooth).toContain("C");
  });

  test("dots add one circle per point", () => {
    const svg = scene(c.line(points, { dots: true }).node);
    expect(svg.match(/<circle/g)?.length).toBe(3);
  });

  test("a label is written past the last point", () => {
    expect(scene(c.line(points, { label: "median" }).node)).toContain(">median</text>");
  });

  test("a band chart draws lines through its category centers", () => {
    const b = band();

    const line = b.line([
      ["Q1", 10],
      ["Q2", 40],
      ["Q4", 70],
    ]);

    expect(line.points.map((p) => p.x)).toEqual([b.x("Q1"), b.x("Q2"), b.x("Q4")]);
  });
});

describe("errors name the call, what it got and the fix", () => {
  test("line() and area()", () => {
    expect(() =>
      band().line(
        [
          ["Q1", 1],
          ["Q2", 2],
        ],
        // SAFETY: a deliberately invalid curve, to reach the runtime check that plain JS callers hit.
        { curve: "wavy" as "step" },
      ),
    ).toThrow(`line() needs curve "linear", "monotone" or "step", got "wavy".`);
  });
});
