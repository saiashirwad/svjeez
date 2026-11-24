/** @jsxImportSource svjeez */
import { describe, expect, test } from "bun:test";
import { Group, font, scene, span } from "svjeez";
import type { DiagramColors } from "../src/kit.tsx";
import { SceneError, check, svg, type Child } from "svjeez/tools";
import { quadrantChart, type QuadrantChartSpec } from "../src/quadrant.tsx";
import { fontFixture } from "../../../fixtures/fonts.ts";

const mono = await font.load(fontFixture("JetBrainsMono"));

const colors: DiagramColors = {
  background: "#FFFFFF",
  text: "#1D1D1F",
  line: "#6E6E73",
  accent: "#0A6CFF",
};

const options = { font: mono, colors };

const draw = (child: Child) =>
  scene({ size: [800, 800], duration: 6, title: "Quadrant", loop: false }, () => (
    <Group offset={[20, 20]}>{child}</Group>
  ));

const errorsOf = (child: Child) =>
  check(draw(child))
    .problems.filter((f) => f.severity === "error")
    .map((f) => f.message);

const thrown = (run: () => void): SceneError => {
  try {
    run();
  } catch (error) {
    if (error instanceof SceneError) return error;
    throw error;
  }

  throw new Error("it did not throw");
};

const campaigns: QuadrantChartSpec = {
  title: "Reach and engagement",
  xAxis: { low: "Low Reach", high: "High Reach" },
  yAxis: { low: "Low Engagement", high: "High Engagement" },
  quadrants: { topRight: "Expand", topLeft: "Promote", bottomLeft: "Re-evaluate" },
  points: [
    { label: "Campaign A", x: 0.3, y: 0.6 },
    { label: "Campaign B", x: 0.45, y: 0.23, radius: 10, color: "#FF3300" },
    { label: "Near B", x: 0.47, y: 0.25 },
    { label: "Edge", x: 1, y: 1 },
  ],
};

describe("quadrantChart", () => {
  test("draws points, labels and axes without check errors", () => {
    const chart = quadrantChart(campaigns, options);
    const markup = svg.emit(draw(chart.node));

    expect(markup).toContain("Campaign A");
    expect(markup).toContain("High Engagement");
    expect(markup).toContain("Re-evaluate");
    expect(errorsOf(chart.node)).toEqual([]);
    expect(chart.span).toBeUndefined();
  });

  test("a single axis label and no title or quadrant labels draw", () => {
    const chart = quadrantChart(
      { xAxis: { low: "Cost" }, yAxis: { low: "Value" }, points: [{ label: "A", x: 0, y: 0 }] },
      options,
    );

    expect(errorsOf(chart.node)).toEqual([]);
  });

  test("reveals points in order as point-1, point-2 and so on", () => {
    const chart = quadrantChart(campaigns, { ...options, reveal: span(1, 0.5) });

    expect(chart.when("point-1")).toEqual(span(1, 0.5));
    expect(chart.when("point-4")?.start).toBeCloseTo(2.5);
    expect(svg.emit(draw(chart.node))).toContain("@keyframes");
  });

  test("rejects bad input in plain sentences", () => {
    expect(
      thrown(() => quadrantChart({ points: [{ label: "A", x: 2, y: 0 }] }, options)).message,
    ).toContain('point 1 ("A") needs x and y from 0 to 1');
    expect(
      thrown(() => quadrantChart({ points: [{ label: "A", x: 0, y: 0, radius: 0 }] }, options))
        .message,
    ).toContain("needs a radius above 0");
    expect(
      thrown(() => quadrantChart(campaigns, { ...options, reveal: { nope: span(0, 1) } })).message,
    ).toContain('reveal names "nope"');
  });
});
