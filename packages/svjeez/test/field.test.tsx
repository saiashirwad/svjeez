import { describe, expect, test } from "bun:test";
import { render } from "svjeez";
import {
  axes,
  contours,
  contourSweep,
  fieldFlow,
  fieldLines,
  flow,
  slopeField,
  slopeSolution,
  streamlines,
  vectorField,
} from "svjeez/extras";

const bounds = { x: 0, y: 0, w: 400, h: 300 };

describe("streamlines", () => {
  test("keep their spacing in a uniform field", () => {
    const { lines } = streamlines(() => [1, 0], { bounds, spacing: 30 });
    const ys = lines.map((line) => line[0]!.y).sort((a, b) => a - b);

    expect(lines.length).toBeGreaterThanOrEqual(8);

    for (const line of lines) {
      expect(line.every((p) => Math.abs(p.y - line[0]!.y) < 0.2)).toBe(true);
      expect(line.at(-1)!.x).toBeGreaterThan(line[0]!.x);
    }

    for (let i = 1; i < ys.length; i++) expect(ys[i]! - ys[i - 1]!).toBeGreaterThan(14);
  });

  test("circle a vortex at a constant radius", () => {
    const [cx, cy] = [200, 150];
    const { lines } = streamlines((x, y) => [-(y - cy), x - cx], { bounds, spacing: 30 });

    expect(lines.length).toBeGreaterThan(3);

    for (const line of lines) {
      const radii = line.map((p) => Math.hypot(p.x - cx, p.y - cy));
      expect(Math.max(...radii) - Math.min(...radii)).toBeLessThan(2);
    }
  });

  test("start where the seeds say and nowhere else", () => {
    const { lines } = streamlines(() => [0, 1], { bounds, seeds: [{ x: 50, y: 20 }] });

    expect(lines).toHaveLength(1);
    expect(lines[0]![0]!.x).toBe(50);
    expect(lines[0]!.at(-1)!.y).toBeGreaterThan(290);
  });

  test("write one subpath per line", () => {
    const { lines, d } = streamlines(() => [1, 1], { bounds, spacing: 40 });

    expect(d.match(/M/g)).toHaveLength(lines.length);
  });

  test("name the fix for bad options", () => {
    expect(() => streamlines(() => [1, 0], { bounds, spacing: 0 })).toThrow(
      "streamlines() needs a positive spacing, got 0.",
    );
  });
});

describe("vectorField", () => {
  test("draws one arrow per lattice point that has a field", () => {
    const { arrows, d } = vectorField((x) => [x < 200 ? 0 : 1, 0], { bounds, spacing: 50 });

    expect(arrows.length).toBe(4 * 6);
    expect(d.match(/M/g)).toHaveLength(arrows.length * 2);
    expect(arrows.every((a) => a.to.x > a.from.x && a.to.y === a.from.y)).toBe(true);
  });
});

describe("slope fields", () => {
  const plot = axes({ x: [-2, 2], y: [-2, 2], width: 200, height: 200 });

  test("draw flat marks for a zero slope", () => {
    const { d } = slopeField(() => 0, plot, { step: 1 });
    const marks = d.split("M").slice(1);

    expect(marks).toHaveLength(25);

    for (const mark of marks) {
      const [x1, y1, x2, y2] = mark.split(/[ L]/).map(Number);
      expect(y1).toBe(y2);
      expect(x2! - x1!).toBeGreaterThan(0);
    }
  });

  test("solution follows the slope", () => {
    const { points } = slopeSolution((x) => x, plot, { x: -2, y: 0 });
    const low = plot.point(0, -2);
    const mid = points.find((p) => Math.abs(p.x - low.x) < 1)!;

    // y = x²/2 - 2, so the curve from (-2, 0) bottoms out at (0, -2)
    expect(mid.y).toBeCloseTo(low.y, 0);
    expect(points[0]!.y).toBeCloseTo(plot.point(-2, 0).y, 0);
    expect(points.at(-1)!.y).toBeCloseTo(plot.point(2, 0).y, 0);
  });
});

describe("contours", () => {
  test("close a circle around the origin", () => {
    const [level] = contours((x, y) => x * x + y * y - 80 * 80, {
      bounds: { x: -100, y: -100, w: 200, h: 200 },
      levels: [0],
    });

    expect(level!.lines).toHaveLength(1);
    expect(level!.lines[0]!.closed).toBe(true);

    for (const p of level!.lines[0]!.points)
      expect(Math.abs(Math.hypot(p.x, p.y) - 80)).toBeLessThan(0.6);

    expect(level!.d.endsWith("Z")).toBe(true);
  });

  test("cross a saddle as two open lines", () => {
    const [level] = contours((x, y) => x * x - y * y, {
      bounds: { x: -50, y: -50, w: 100, h: 100 },
      levels: [0],
    });

    expect(level!.lines).toHaveLength(2);
    expect(level!.lines.every((l) => !l.closed)).toBe(true);
  });

  test("read a precomputed grid and place its row 0 at the top", () => {
    const values = [0, 0, 0, 1, 1, 1, 2, 2, 2];
    const [level] = contours({ cols: 3, rows: 3, values }, { bounds, levels: [0.5] });

    expect(level!.lines).toHaveLength(1);
    expect(level!.lines[0]!.points.every((p) => Math.abs(p.y - 75) < 0.01)).toBe(true);
  });

  test("sample in graph units through axes", () => {
    const plot = axes({ x: [-2, 2], y: [-2, 2], width: 200, height: 200, at: { x: 10, y: 10 } });
    const [level] = contours((x, y) => x * x + y * y - 1, { axes: plot, levels: [0] });
    const center = plot.point(0, 0);

    for (const p of level!.lines[0]!.points)
      expect(Math.abs(Math.hypot(p.x - center.x, p.y - center.y) - 50)).toBeLessThan(0.7);
  });

  test("leave NaN cells empty", () => {
    const [level] = contours((x) => (x < 0 ? NaN : x - 10), {
      bounds: { x: -50, y: 0, w: 100, h: 20 },
      levels: [0],
    });

    expect(level!.lines).toHaveLength(1);
    expect(level!.lines[0]!.points.every((p) => Math.abs(p.x - 10) < 0.01)).toBe(true);
  });
});

describe("contourSweep", () => {
  const plot = axes({ x: [-2, 2], y: [-2, 2], width: 200, height: 200 });

  test("morphs one path through every level", () => {
    const sweep = contourSweep((x, y) => x * x + y * y, {
      axes: plot,
      from: 0.25,
      to: 3,
      at: 1,
      over: 2,
      frames: 6,
    });

    const svg = render(
      { width: 220, height: 220, duration: 4, title: "Sweep" },
      <path d={sweep.d} animation={sweep.animation} />,
    );

    expect(svg).toContain('attributeName="d"');
  });

  test("names the level that has no line", () => {
    expect(() =>
      contourSweep((x, y) => x * x + y * y, { axes: plot, from: -1, to: 1, at: 0, over: 1 }),
    ).toThrow("contourSweep() found no line at level -1.");
  });
});

describe("fieldFlow", () => {
  const { lines } = streamlines(() => [1, 0], { bounds, spacing: 50 });

  test("loops one particle per line out of step with the others", () => {
    const svg = render(
      { width: 400, height: 300, duration: 8, title: "Flow", reducedMotion: false },
      <>
        {fieldLines(lines, { at: 0, over: 2 }).toString()}
        {fieldFlow(lines, { at: 1 })}
      </>,
    );

    expect(svg.match(/<circle/g)!.length).toBeGreaterThanOrEqual(lines.length);
    expect(new Set(svg.match(/translate:[\d.]+px [\d.]+px/g)).size).toBeGreaterThan(lines.length);
  });

  test("flow rejects a loop shorter than the trip", () => {
    expect(() => flow(lines[0]!, { at: 0, over: 3, style: "comet", loop: 2 })).toThrow(
      "flow() needs a loop period past",
    );
    expect(() => flow(lines[0]!, { at: 0, style: "trace", loop: 4 })).toThrow(
      "flow() loops a dot, comet or packet.",
    );
  });
});
