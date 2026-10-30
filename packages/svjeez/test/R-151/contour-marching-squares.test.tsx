import { describe, expect, test } from "bun:test";
import { contours } from "svjeez/extras";

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

  test("leave NaN cells empty", () => {
    const [level] = contours((x) => (x < 0 ? NaN : x - 10), {
      bounds: { x: -50, y: 0, w: 100, h: 20 },
      levels: [0],
    });

    expect(level!.lines).toHaveLength(1);
    expect(level!.lines[0]!.points.every((p) => Math.abs(p.x - 10) < 0.01)).toBe(true);
  });
});
