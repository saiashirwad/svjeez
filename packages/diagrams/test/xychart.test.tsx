/** @jsxImportSource svjeez */
import { describe, expect, test } from "bun:test";
import { Group, font, scene, span } from "svjeez";
import type { DiagramColors } from "../src/kit.tsx";
import { SceneError, check, svg, type Child } from "svjeez/tools";
import { xyChart, type XyChartSpec } from "../src/xychart.tsx";

const mono = await font.load(
  new URL("../../svjeez/tests/fixtures/JetBrainsMono.ttf", import.meta.url),
);

const colors: DiagramColors = {
  background: "#FFFFFF",
  text: "#1D1D1F",
  line: "#6E6E73",
  accent: "#0A6CFF",
};

const options = { font: mono, colors };

const draw = (child: Child) =>
  scene({ size: [1000, 800], duration: 6, title: "XY", loop: false }, () => (
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

const sales: XyChartSpec = {
  title: "Sales Revenue",
  x: { title: "Month", categories: ["jan", "feb", "mar", "apr"] },
  y: { title: "Revenue", min: 0, max: 100 },
  series: [
    { type: "bar", label: "Revenue", values: [40, 60, 55, 80] },
    { type: "line", label: "Trend", values: [30, 50, 60, 90] },
  ],
};

describe("xyChart", () => {
  test("draws bars, lines and axes without check errors", () => {
    const chart = xyChart(sales, options);
    const markup = svg.emit(draw(chart.node));

    expect(markup).toContain("Sales Revenue");
    expect(markup).toContain("Trend");
    expect(errorsOf(chart.node)).toEqual([]);
    expect(chart.span).toBeUndefined();
  });

  test("draws horizontally, with negative values and a numeric x range", () => {
    const chart = xyChart(
      {
        horizontal: true,
        x: { min: 0, max: 30 },
        series: [{ type: "bar", values: [-5, 10, 20] }],
      },
      options,
    );

    expect(errorsOf(chart.node)).toEqual([]);
    expect(svg.emit(draw(chart.node))).toContain(">15<");
  });

  test("numbers the points of a chart with no x axis, and fits a flat series", () => {
    const chart = xyChart({ series: [{ type: "line", values: [3, 3, 3] }] }, options);

    expect(errorsOf(chart.node)).toEqual([]);
  });

  test("reveals series in order as series-1, series-2 and so on", () => {
    const chart = xyChart(sales, { ...options, reveal: span(1, 0.5) });

    expect(chart.when("series-1")).toEqual(span(1, 0.5));
    expect(chart.when("series-2")).toEqual(span(1.5, 0.5));
    expect(svg.emit(draw(chart.node))).toContain("@keyframes");
  });

  test("rejects bad input in plain sentences", () => {
    expect(thrown(() => xyChart({ series: [] }, options)).message).toContain(
      "needs at least one series, got none.",
    );
    expect(
      thrown(() =>
        xyChart(
          {
            series: [
              { type: "bar", values: [1, 2] },
              { type: "line", values: [1] },
            ],
          },
          options,
        ),
      ).message,
    ).toContain("series 2 has 1 values, but series 1 has 2");
    expect(
      thrown(() =>
        xyChart({ x: { categories: ["a"] }, series: [{ type: "bar", values: [1, 2] }] }, options),
      ).message,
    ).toContain("1 categories but its series have 2");
    expect(
      thrown(() =>
        xyChart({ y: { min: 5, max: 5 }, series: [{ type: "bar", values: [1] }] }, options),
      ).message,
    ).toContain("y range needs min below max");
    expect(
      thrown(() => xyChart(sales, { ...options, reveal: { nope: span(0, 1) } })).message,
    ).toContain('reveal names "nope"');
  });
});
