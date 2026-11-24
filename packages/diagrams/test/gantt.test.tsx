/** @jsxImportSource svjeez */
import { describe, expect, test } from "bun:test";
import { Group, font, scene, span } from "svjeez";
import type { DiagramColors } from "../src/kit.tsx";
import { SceneError, check, svg, type Child } from "svjeez/tools";
import { formatTime, gantt, type GanttSpec } from "../src/gantt.tsx";
import { fontFixture } from "../../../fixtures/fonts.ts";

const mono = await font.load(fontFixture("JetBrainsMono"));

const colors: DiagramColors = {
  background: "#FFFFFF",
  text: "#1D1D1F",
  line: "#6E6E73",
  accent: "#0A6CFF",
};

const options = { font: mono, colors };
const day = (d: number): number => Date.UTC(2024, 0, d);

const draw = (child: Child) =>
  scene({ size: [1200, 800], duration: 6, title: "Gantt", loop: false }, () => (
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

const plan: GanttSpec = {
  title: "Launch",
  sections: [
    {
      label: "Build",
      tasks: [
        { id: "a", label: "Design", start: day(1), end: day(10), done: true },
        { id: "b", label: "Implement the thing", start: day(10), end: day(30), active: true },
        { id: "m", label: "Beta", start: day(30), end: day(30), milestone: true },
      ],
    },
    {
      label: "Ship",
      tasks: [{ id: "c", label: "Release", start: day(30), end: day(40), crit: true }],
    },
  ],
  excluded: [[day(6), day(8)]],
};

describe("gantt", () => {
  test("draws a time axis, bars and a milestone without check errors", () => {
    const chart = gantt(plan, options);
    const markup = svg.emit(draw(chart.node));

    expect(markup).toContain("<svg");
    expect(markup).toContain("2024-01-01");
    expect(markup).toContain("Implement the thing");
    expect(errorsOf(chart.node)).toEqual([]);
    expect(chart.span).toBeUndefined();
    expect(chart.size[0]).toBe(800);
  });

  test("x maps times linearly onto the axis, in UTC", () => {
    const chart = gantt(plan, options);

    expect(chart.x(day(1))).toBeLessThan(chart.x(day(11)));
    expect(chart.x(day(21)) - chart.x(day(11))).toBeCloseTo(chart.x(day(11)) - chart.x(day(1)), 6);
  });

  test("reveals tasks in order, one beat each", () => {
    const chart = gantt(plan, { ...options, reveal: span(0.5, 0.25) });

    expect(chart.when("a")).toEqual(span(0.5, 0.25));
    expect(chart.when("b")?.start).toBeCloseTo(0.75);
    expect(chart.when("c")?.start).toBeCloseTo(1.25);
    expect(chart.span).toEqual(span(0.5, 1));
    expect(svg.emit(draw(chart.node))).toContain("@keyframes");
  });

  test("reveal can name some tasks and leave the rest on screen", () => {
    const chart = gantt(plan, { ...options, reveal: { c: span(1, 1) } });

    expect(chart.when("a")).toBeUndefined();
    expect(chart.when("c")).toEqual(span(1, 1));
  });

  test("a section with no label and a one-day chart still draw", () => {
    const chart = gantt(
      {
        sections: [{ label: "", tasks: [{ id: "x", label: "Only", start: day(1), end: day(1) }] }],
      },
      options,
    );

    expect(errorsOf(chart.node)).toEqual([]);
  });

  test("axisFormat shapes the tick labels", () => {
    const markup = svg.emit(draw(gantt({ ...plan, axisFormat: "%b %e" }, options).node));

    expect(markup).toContain("Jan 1");
  });

  test("formats times in UTC", () => {
    expect(formatTime("%Y-%m-%d %H:%M %a %B %j %%", Date.UTC(2024, 0, 1, 13, 5))).toBe(
      "2024-01-01 13:05 Mon January 001 %",
    );
  });

  test("a time span of hours gets hourly labels", () => {
    const hour = (h: number): number => Date.UTC(2024, 0, 1, h);

    const chart = gantt(
      {
        sections: [
          { label: "", tasks: [{ id: "x", label: "Deploy", start: hour(9), end: hour(15) }] },
        ],
      },
      options,
    );

    expect(svg.emit(draw(chart.node))).toContain("09:00");
  });

  test("rejects bad input in plain sentences", () => {
    expect(thrown(() => gantt({ sections: [] }, options)).message).toContain(
      "gantt() needs at least one task, got none.",
    );
    expect(
      thrown(() =>
        gantt(
          { sections: [{ label: "", tasks: [{ id: "x", label: "X", start: 5, end: 1 }] }] },
          options,
        ),
      ).message,
    ).toContain('task "x" needs a start and an end that is not before it');
    expect(
      thrown(() =>
        gantt(
          {
            sections: [
              {
                label: "",
                tasks: [
                  { id: "x", label: "X", start: 1, end: 2 },
                  { id: "x", label: "Y", start: 1, end: 2 },
                ],
              },
            ],
          },
          options,
        ),
      ).message,
    ).toContain('two tasks named "x"');
    expect(thrown(() => gantt({ ...plan, axisFormat: "%Q" }, options)).message).toContain("%Q");
    expect(
      thrown(() => gantt(plan, { ...options, reveal: { zzz: span(0, 1) } })).message,
    ).toContain('reveal names "zzz"');
  });

  test("an unknown part names the ones it has", () => {
    expect(thrown(() => gantt(plan, options).part("nope")).message).toContain('has no part "nope"');
  });
});
