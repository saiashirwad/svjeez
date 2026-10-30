import { describe, expect, test } from "bun:test";
import { axes } from "svjeez/extras";
import { base, svgOf } from "../helpers/axes";

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
});
