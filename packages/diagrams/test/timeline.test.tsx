/** @jsxImportSource svjeez */
import { describe, expect, test } from "bun:test";
import { Group, font, scene, span } from "svjeez";
import type { DiagramColors } from "../src/kit.tsx";
import { SceneError, check, svg, type Child } from "svjeez/tools";
import { timeline, type TimelineSpec } from "../src/timeline.tsx";
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
  scene({ size: [1400, 800], duration: 6, title: "Timeline", loop: false }, () => (
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

const history: TimelineSpec = {
  title: "History of social media",
  sections: [
    {
      label: "Early",
      periods: [
        { label: "2002", events: ["LinkedIn"] },
        { label: "2004", events: ["Facebook", "A much longer event that has to wrap onto lines"] },
      ],
    },
    { label: "Later", periods: [{ label: "2010", events: ["Instagram"] }, { label: "Soon" }] },
  ],
};

describe("timeline", () => {
  test("draws periods, events and sections without check errors", () => {
    const chart = timeline(history, options);
    const markup = svg.emit(draw(chart.node));

    expect(markup).toContain("LinkedIn");
    expect(markup).toContain("Later");
    expect(errorsOf(chart.node)).toEqual([]);
    expect(chart.span).toBeUndefined();
  });

  test("reveals periods in order as period-1, period-2 and so on", () => {
    const chart = timeline(history, { ...options, reveal: span(1, 0.5) });

    expect(chart.when("period-1")).toEqual(span(1, 0.5));
    expect(chart.when("period-4")?.start).toBeCloseTo(2.5);
    expect(chart.span).toEqual(span(1, 2));
    expect(svg.emit(draw(chart.node))).toContain("@keyframes");
  });

  test("unnamed sections and periods without events draw", () => {
    const chart = timeline({ sections: [{ label: "", periods: [{ label: "Only" }] }] }, options);

    expect(errorsOf(chart.node)).toEqual([]);
  });

  test("rejects bad input in plain sentences", () => {
    expect(thrown(() => timeline({ sections: [] }, options)).message).toContain(
      "timeline() needs at least one period, got none.",
    );
    expect(
      thrown(() => timeline(history, { ...options, reveal: { nope: span(0, 1) } })).message,
    ).toContain('reveal names "nope"');
  });
});
