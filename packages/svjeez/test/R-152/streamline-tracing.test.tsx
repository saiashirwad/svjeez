import { describe, expect, test } from "bun:test";
import { streamlines } from "svjeez/extras";
import { bounds } from "../helpers/field";

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
});
