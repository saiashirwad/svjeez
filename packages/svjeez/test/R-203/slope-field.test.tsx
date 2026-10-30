import { describe, expect, test } from "bun:test";
import { axes, slopeField, slopeSolution } from "svjeez/extras";

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
