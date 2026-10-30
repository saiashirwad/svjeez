import { describe, expect, test } from "bun:test";
import { lineChart, points, scene } from "../helpers/charts.ts";

describe("line and area", () => {
  const c = lineChart();

  test("an area fills down to the baseline and wipes in", () => {
    const area = c.area(points);
    expect(area.fill).toMatch(/Z$/);
    expect(area.fill).toContain(`${c.y(0)}`);
    const svg = scene(area.node);
    expect(svg).toContain("<clipPath");
    expect(svg).toContain("<linearGradient");
  });

  test("line: false leaves just the fill", () => {
    const svg = scene(c.area(points, { line: false }).node);
    expect(svg).not.toContain("stroke-dasharray");
  });
});
