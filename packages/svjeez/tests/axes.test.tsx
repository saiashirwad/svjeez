import { describe, expect, test } from "bun:test";
import { draw, render, validateSvg, type Child } from "svjeez";
import { axes } from "svjeez/extras";

const base = { x: [-3, 3], y: [-1, 9], width: 400, height: 260, at: { x: 300, y: 60 } } as const;

const svgOf = (...nodes: Child[]): string =>
  render({ width: 800, height: 400, duration: 4, title: "Axes" }, nodes);

describe("axes()", () => {
  test("point() maps graph coordinates to scene px", () => {
    const ax = axes(base);

    expect(ax.point(-3, 9)).toEqual({ x: 300, y: 60 });
    expect(ax.point(3, -1)).toEqual({ x: 700, y: 320 });
    expect(ax.point(0, 0)).toEqual({ x: 500, y: 60 + 260 * 0.9 });
    expect(ax.bounds).toMatchObject({ x: 300, y: 60, w: 400, h: 260 });
  });

  const lines = (ax: ReturnType<typeof axes>): string[] =>
    [...svgOf(ax.node).matchAll(/<line [^>]*>/g)].map(([tag]) => tag);

  test("axes cross at zero when it is in range", () => {
    const ax = axes(base);
    const [x, y] = [ax.point(0, 0).x, ax.point(0, 0).y];
    const found = lines(ax).join("\n");

    expect(found).toContain(`y1="${y}"`);
    expect(found).toContain(`x1="${x}"`);
  });

  test("axes sit on the bottom and left edges when zero is out of range", () => {
    const ax = axes({ ...base, x: [1, 5], y: [2, 8] });
    const found = lines(ax).join("\n");

    expect(found).toContain(`y1="${ax.bounds.y + ax.bounds.h}"`);
    expect(found).toContain(`x1="${ax.bounds.x}"`);
  });

  test("tick labels have no float noise or negative zero", () => {
    const ax = axes({ ...base, x: [-0.3, 0.6], ticks: { x: 0.1 } });
    const svg = svgOf(ax.node);

    for (const wanted of ["-0.3", "0.3", "0.6", "0"]) expect(svg).toContain(`>${wanted}</text>`);
    expect(svg).not.toContain("-0<");
    expect(svg).not.toMatch(/0\.\d{6,}/);
  });

  test("no ticks, no labels", () => {
    expect(svgOf(axes(base).node)).not.toContain("<text");
    expect(svgOf(axes({ ...base, ticks: { x: 1 }, labels: false }).node)).not.toContain("<text");
  });

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
  test("rejects ranges where max is not above min", () => {
    expect(() => axes({ ...base, x: [3, -3] })).toThrow(/x range with max above min/);
    expect(() => axes({ ...base, y: [1, 1] })).toThrow(/y range with max above min/);
    expect(() => axes({ ...base, y: [0, Infinity] })).toThrow(/y range/);
  });

  test("rejects non-positive sizes and tick steps", () => {
    expect(() => axes({ ...base, width: 0 })).toThrow(/positive width and height/);
    expect(() => axes({ ...base, height: -5 })).toThrow(/positive width and height/);
    expect(() => axes({ ...base, ticks: { x: 0 } })).toThrow(/positive x tick step/);
    expect(() => axes({ ...base, ticks: { y: -1 } })).toThrow(/positive y tick step/);
    expect(() => axes({ ...base, ticks: { x: 1e-6 } })).toThrow(/at most 500/);
  });

  test("rejects bad sample counts and plot ranges", () => {
    const ax = axes(base);

    expect(() => ax.plot((x) => x, { samples: 1 })).toThrow(/samples/);
    expect(() => ax.plot((x) => x, { samples: 0 })).toThrow(/samples/);
    expect(() => ax.plot((x) => x, { from: 2, to: 2 })).toThrow(/from below to/);
  });
});
