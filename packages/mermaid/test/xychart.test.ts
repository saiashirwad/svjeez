import { describe, expect, test } from "bun:test";
import { font, scene, span } from "svjeez";
import { SceneError, svg } from "svjeez/tools";
import type { Line } from "../src/errors.ts";
import { drawXyChart, parseXyChart, type XyChartDoc } from "../src/xychart.ts";

const mono = await font.load(
  new URL("../../svjeez/tests/fixtures/JetBrainsMono.ttf", import.meta.url),
);

const parse = (text: string): XyChartDoc => {
  const [header, ...body] = text
    .split("\n")
    .map((t, i): Line => ({ file: "x.mmd", line: i + 1, text: t.trim() }))
    .filter((l) => l.text !== "");

  return parseXyChart(header!, body);
};

const message = (text: string): string => {
  try {
    parse(text);
  } catch (e) {
    if (e instanceof SceneError) return e.message;
    throw e;
  }

  throw new Error("parseXyChart() did not throw");
};

describe("parse xychart", () => {
  test("reads the title, categories, y range and series", () => {
    const doc = parse(`xychart-beta
      title "Sales Revenue"
      x-axis [jan, "feb mar", apr]
      y-axis "Revenue (in $)" 4000 --> 11000
      bar [5000, 6000.5, 7500]
      line "Trend" [-5, 6, 7]`);

    expect(doc.title).toBe("Sales Revenue");
    expect(doc.horizontal).toBe(false);
    expect(doc.xAxis).toEqual({ categories: ["jan", "feb mar", "apr"] });
    expect(doc.yAxis).toEqual({ title: "Revenue (in $)", min: 4000, max: 11000 });
    expect(doc.series).toEqual([
      { type: "bar", values: [5000, 6000.5, 7500] },
      { type: "line", label: "Trend", values: [-5, 6, 7] },
    ]);
  });

  test("reads orientation, titled axes, a numeric x range and the short header", () => {
    const doc = parse(`xychart horizontal
      x-axis Month 1 --> 3
      y-axis Revenue
      bar [1, 2, 3]`);

    expect(doc.horizontal).toBe(true);
    expect(doc.xAxis).toEqual({ title: "Month", min: 1, max: 3 });
    expect(doc.yAxis).toEqual({ title: "Revenue" });
  });

  test("a chart without an x axis numbers its points", () => {
    const doc = parse("xychart-beta\nline [1, 2]\nbar [3, 4]");

    expect(doc.xAxis).toBeUndefined();
    expect(doc.series).toHaveLength(2);
  });
});

describe("xychart errors", () => {
  test("name the line and what to write", () => {
    expect(message("xychart-beta wide\nbar [1]")).toContain("the header is");
    expect(message("xychart-beta\nbar [1, x]")).toContain('the value "x" is not a number');
    expect(message("xychart-beta\nbar [1,]")).toContain("empty item");
    expect(message("xychart-beta\nbar 1, 2")).toContain("cannot read this line");
    expect(message("xychart-beta\nx-axis [a, b]\nbar [1, 2, 3]")).toContain(
      "needs 2, one per x-axis category",
    );
    expect(message("xychart-beta\nbar [1, 2]\nline [1]")).toContain("x.mmd:3:");
    expect(message("xychart-beta\nx-axis Month\nbar [1]")).toContain("needs categories");
    expect(message("xychart-beta\nx-axis 5 --> 1\nbar [1]")).toContain("smaller to a larger");
    expect(message("xychart-beta\ny-axis [a, b]\nbar [1]")).toContain("y-axis is numeric");
    expect(message("xychart-beta\ntitle")).toContain("a title needs text");
    expect(message("xychart-beta\ntitle T")).toContain("the chart has no series");
    expect(message("xychart-beta\naccTitle: x\nbar [1]")).toContain("accessibility");
  });
});

describe("drawXyChart", () => {
  test("draws the doc, and reveals series in order", () => {
    const doc = parse("xychart-beta\ntitle T\nx-axis [a, b]\nbar [1, 2]\nline [2, 1]");
    const chart = drawXyChart(doc, { font: mono, reveal: span(0, 0.5) });
    const markup = svg.emit(scene({ size: [800, 600], duration: 3, title: "x" }, () => chart.node));

    expect(markup).toContain("@keyframes");
    expect(chart.when("series-2")).toEqual(span(0.5, 0.5));
  });
});
