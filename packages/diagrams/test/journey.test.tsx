/** @jsxImportSource svjeez */
import { describe, expect, test } from "bun:test";
import { Group, font, scene, span } from "svjeez";
import type { DiagramColors } from "../src/kit.tsx";
import { SceneError, check, svg, type Child } from "svjeez/tools";
import { journey, type JourneySpec } from "../src/journey.tsx";
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
  scene({ size: [1200, 800], duration: 6, title: "Journey", loop: false }, () => (
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

const day: JourneySpec = {
  title: "My working day",
  sections: [
    {
      label: "Go to work",
      tasks: [
        { label: "Make tea", score: 5, actors: ["Me"] },
        { label: "Go upstairs", score: 3, actors: ["Me"] },
        { label: "Do work", score: 1, actors: ["Me", "Cat"] },
      ],
    },
    { label: "Go home", tasks: [{ label: "Sit down in the comfortable armchair", score: 5 }] },
  ],
};

describe("journey", () => {
  test("draws cards, faces and an actor legend without check errors", () => {
    const chart = journey(day, options);
    const markup = svg.emit(draw(chart.node));

    expect(markup).toContain("Make tea");
    expect(markup).toContain("Cat");
    expect(markup).toContain("Go to work");
    expect(errorsOf(chart.node)).toEqual([]);
    expect(chart.span).toBeUndefined();
  });

  test("reveals tasks in order as task-1, task-2 and so on", () => {
    const chart = journey(day, { ...options, reveal: span(1, 0.5) });

    expect(chart.when("task-1")).toEqual(span(1, 0.5));
    expect(chart.when("task-4")?.start).toBeCloseTo(2.5);
    expect(chart.span).toEqual(span(1, 2));
    expect(svg.emit(draw(chart.node))).toContain("@keyframes");
  });

  test("tasks with no actors and sections with no label draw", () => {
    const chart = journey(
      { sections: [{ label: "", tasks: [{ label: "Only", score: 2 }] }] },
      options,
    );

    expect(errorsOf(chart.node)).toEqual([]);
  });

  test("a higher score sits higher on the chart", () => {
    const high = svg.emit(
      draw(journey({ sections: [{ label: "", tasks: [{ label: "A", score: 5 }] }] }, options).node),
    );

    const low = svg.emit(
      draw(journey({ sections: [{ label: "", tasks: [{ label: "A", score: 1 }] }] }, options).node),
    );

    expect(high).not.toBe(low);
  });

  test("rejects bad input in plain sentences", () => {
    expect(thrown(() => journey({ sections: [] }, options)).message).toContain(
      "journey() needs at least one task, got none.",
    );
    expect(
      thrown(() =>
        journey({ sections: [{ label: "", tasks: [{ label: "X", score: 9 }] }] }, options),
      ).message,
    ).toContain('task 1 ("X") needs a score from 1 to 5, got 9');
    expect(
      thrown(() => journey(day, { ...options, reveal: { nope: span(0, 1) } })).message,
    ).toContain('reveal names "nope"');
  });
});
