import { describe, expect, test } from "bun:test";
import { axes, contours } from "svjeez/extras";
import { bounds } from "../helpers/field";

describe("contours", () => {
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
});
