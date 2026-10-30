import { describe, expect, test } from "bun:test";
import { draw, validateSvg } from "svjeez";
import { axes } from "svjeez/extras";
import { base, svgOf } from "../helpers/axes";

describe("axes()", () => {
  test("plot() draws a parabola inside the plot area, as valid SVG with a draw-on", () => {
    const ax = axes({ ...base, ticks: { x: 1, y: 2 } });
    const parabola = ax.plot((x) => x * x, { samples: 120, animation: draw({ at: 1, over: 1.5 }) });
    const svg = svgOf(ax.node, parabola.node);

    expect(validateSvg(svg).errors).toEqual([]);
    expect(svg).toContain("@keyframes");
    expect(parabola.d.match(/M/g)).toHaveLength(1);
    expect(parabola.points).toHaveLength(120);
    expect(parabola.points[0]).toEqual({ x: 300, y: ax.point(-3, 9).y });
  });

  test("plot() breaks at a discontinuity instead of drawing a spike", () => {
    const ax = axes({ ...base, y: [-4, 4] });
    const hyperbola = ax.plot((x) => 1 / x, { samples: 120 });

    expect(hyperbola.d.match(/M/g)).toHaveLength(2);
  });

  test("plot() breaks where tan() jumps across an asymptote", () => {
    const ax = axes({ x: [-4, 4], y: [-3, 3], width: 400, height: 200 });
    const tangent = ax.plot(Math.tan, { samples: 300 });

    expect(tangent.d.match(/M/g)!.length).toBeGreaterThanOrEqual(3);
  });

  test("plot() breaks on non-finite values", () => {
    const ax = axes(base);
    const root = ax.plot(Math.sqrt, { from: -3, to: 3, samples: 61 });

    expect(root.d.match(/M/g)).toHaveLength(1);
    expect(root.points[0]!.x).toBeGreaterThanOrEqual(ax.point(0, 0).x);
  });

  test("plot() rounds coordinates to 0.1px", () => {
    const sine = axes(base).plot(Math.sin, { samples: 50 });

    for (const [n] of sine.d.matchAll(/-?\d+(\.\d+)?/g)) expect(n).toMatch(/^-?\d+(\.\d)?$/);
  });

  test("plot() with nothing to draw names the range", () => {
    expect(() => axes(base).plot(() => NaN)).toThrow(/no finite values/);
  });
});

describe("axes() validation", () => {
  test("rejects bad sample counts and plot ranges", () => {
    const ax = axes(base);

    expect(() => ax.plot((x) => x, { samples: 1 })).toThrow(/samples/);
    expect(() => ax.plot((x) => x, { samples: 0 })).toThrow(/samples/);
    expect(() => ax.plot((x) => x, { from: 2, to: 2 })).toThrow(/from below to/);
  });
});
