import { describe, expect, test } from "bun:test";
import { font, scene, span } from "svjeez";
import { SceneError, svg } from "svjeez/tools";
import type { Line } from "../src/errors.ts";
import { drawQuadrant, parseQuadrant, type QuadrantDoc } from "../src/quadrant.ts";
import { fontFixture } from "../../../fixtures/fonts.ts";

const mono = await font.load(fontFixture("JetBrainsMono"));

const parse = (text: string): QuadrantDoc => {
  const [header, ...body] = text
    .split("\n")
    .map((t, i): Line => ({ file: "q.mmd", line: i + 1, text: t.trim() }))
    .filter((l) => l.text !== "");

  return parseQuadrant(header!, body);
};

const message = (text: string): string => {
  try {
    parse(text);
  } catch (e) {
    if (e instanceof SceneError) return e.message;
    throw e;
  }

  throw new Error("parseQuadrant() did not throw");
};

describe("parse quadrant", () => {
  test("reads the title, axes, quadrant labels and points", () => {
    const doc = parse(`quadrantChart
      title Reach and engagement
      x-axis Low Reach --> High Reach
      y-axis "Low Engagement" --> High Engagement
      quadrant-1 We should expand
      quadrant-3 Re-evaluate
      Campaign A: [0.3, 0.6]
      "Campaign: B": [.45, 0.23] radius: 10, color: #f30
      C: [1, 0]`);

    expect(doc.title).toBe("Reach and engagement");
    expect(doc.xAxis).toEqual({ low: "Low Reach", high: "High Reach" });
    expect(doc.yAxis).toEqual({ low: "Low Engagement", high: "High Engagement" });
    expect(doc.quadrants).toEqual({ topRight: "We should expand", bottomLeft: "Re-evaluate" });
    expect(doc.points).toEqual([
      { label: "Campaign A", x: 0.3, y: 0.6 },
      { label: "Campaign: B", x: 0.45, y: 0.23, radius: 10, color: "#ff3300" },
      { label: "C", x: 1, y: 0 },
    ]);
  });

  test("an axis may have a single label", () => {
    expect(parse("quadrantChart\nx-axis Cost\nA: [0, 0]").xAxis).toEqual({ low: "Cost" });
  });
});

describe("quadrant errors", () => {
  test("name the line and what to write", () => {
    expect(message("quadrantChart\nA: [1.5, 0.2]")).toContain('the x position "1.5"');
    expect(message("quadrantChart\nA: [0.5, x]")).toContain('the y position "x"');
    expect(message("quadrantChart\nA: [0.5]")).toContain("cannot read this line");
    expect(message("quadrantChart\nA: [0.5, 0.5] radius: 0")).toContain("radius");
    expect(message("quadrantChart\nA: [0.5, 0.5] color: red")).toContain("hex color");
    expect(message("quadrantChart\nA: [0.5, 0.5] stroke-width: 2px")).toContain("not supported");
    expect(message("quadrantChart\nA: [0.5, 0.5]\nA: [0.1, 0.1]")).toContain("already there");
    expect(message("quadrantChart\nclassDef c color: #fff\nA: [0.5, 0.5]")).toContain(
      "point classes",
    );
    expect(message("quadrantChart\nA:::c: [0.5, 0.5]")).toContain("point classes");
    expect(message("quadrantChart\nx-axis A --> ")).toContain("x-axis is written");
    expect(message("quadrantChart\nquadrant-2")).toContain("a quadrant label needs text");
    expect(message("quadrantChart\ntitle")).toContain("a title needs text");
    expect(message("quadrantChart\ntitle T")).toContain("the chart has no points");
    expect(message("quadrantChart x\nA: [0.5, 0.5]")).toContain("takes no other words");
  });
});

describe("drawQuadrant", () => {
  test("draws the doc, and reveals points in order", () => {
    const doc = parse("quadrantChart\ntitle T\nquadrant-1 Q\nA: [0.3, 0.6]\nB: [0.9, 0.1]");
    const chart = drawQuadrant(doc, { font: mono, reveal: span(0, 0.5) });
    const markup = svg.emit(scene({ size: [700, 700], duration: 3, title: "q" }, () => chart.node));

    expect(markup).toContain("@keyframes");
    expect(chart.when("point-2")).toEqual(span(0.5, 0.5));
  });
});
