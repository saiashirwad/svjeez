import { describe, expect, test } from "bun:test";
import { Group, Shape, circle, font, scene, span } from "svjeez";
import { SceneError, check, svg, type Child } from "svjeez/tools";
import type { DiagramColors } from "../src/kit.tsx";
import { pie } from "../src/pie.tsx";
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
  scene({ size: [900, 600], duration: 6, title: "Pie", loop: false }, () => (
    <Group>
      <Shape geometry={circle(1)} at={[0, 0]} fill="#FFFFFF" />
      <Group offset={[20, 20]}>{child}</Group>
    </Group>
  ));

const thrown = (run: () => void): SceneError => {
  try {
    run();
  } catch (error) {
    if (error instanceof SceneError) return error;
    throw error;
  }

  throw new Error("it did not throw");
};

const pets = { Dogs: 386, Cats: 85, Rats: 15 };

describe("pie", () => {
  test("draws a slice, a share and a legend row for each value, with no scene errors", () => {
    const chart = pie({ title: "Pets", slices: pets }, options);
    const out = svg.emit(draw(chart.node));

    expect(check(draw(chart.node)).problems.filter((p) => p.severity === "error")).toEqual([]);
    expect(out).toContain(">79%<");
    expect(out).toContain(">Rats<");
    expect(out).toContain(">Pets<");
    expect(chart.size[0]).toBeGreaterThan(chart.size[1]);
    expect(chart.span).toBeUndefined();
  });

  test("showData adds each value to its legend row", () => {
    const out = svg.emit(draw(pie({ showData: true, slices: pets }, options).node));

    expect(out).toContain("Dogs [386]");
  });

  test("a slice under 1% keeps its legend row but is not drawn", () => {
    const out = svg.emit(draw(pie({ slices: { Big: 995, Tiny: 4 } }, options).node));

    expect(out).toContain(">Tiny<");
    expect(out).not.toContain(">0%<");
    expect(out).toContain(">100%<");
  });

  test("slices take a label that names no part, and reveal one beat each in order", () => {
    const chart = pie(
      { slices: { dogs: { label: "Dogs/cats", value: 3 }, rats: 1 } },
      { ...options, reveal: span(1, 0.5) },
    );

    expect(chart.when("dogs")?.start).toBe(1);
    expect(chart.when("rats")?.start).toBe(1.5);
    expect(chart.span?.start).toBe(1);
    expect(svg.emit(draw(chart.node))).toContain("Dogs/cats");
  });

  test("rejects bad values, unknown reveals and a slice named with a slash", () => {
    expect(thrown(() => pie({ slices: { a: -1, b: 2 } }, options)).problem).toBe(
      'pie() slice "a" needs a value of 0 or more, got -1.',
    );
    expect(thrown(() => pie({ slices: { a: 0 } }, options)).problem).toContain("add up to 0");
    expect(thrown(() => pie({ slices: { "a/b": 1 } }, options)).problem).toContain('"a/b"');
    // SAFETY: a value the types forbid, on purpose, to read the runtime error
    expect(
      thrown(() => pie({ slices: { a: 1 } }, { ...options, reveal: { nope: span(0, 1) } } as never))
        .problem,
    ).toContain('"nope"');
    // SAFETY: a value the types forbid, on purpose, to read the runtime error
    expect(thrown(() => pie({ slices: { a: 1 } }, options).part("x" as never)).problem).toBe(
      'pie() has no part "x".',
    );
  });
});
