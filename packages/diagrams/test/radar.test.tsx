import { describe, expect, test } from "bun:test";
import { Group, Shape, circle, font, scene, span } from "svjeez";
import { SceneError, check, svg, type Child } from "svjeez/tools";
import type { DiagramColors } from "../src/kit.tsx";
import { radar } from "../src/radar.tsx";
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
  scene({ size: [900, 600], duration: 6, title: "Radar", loop: false }, () => (
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

const axes = ["Speed", "Power", "Range", "Armor"];
const curves = { a: [1, 2, 3, 4], b: { label: "Bee", values: [4, 3, 2, 1] } };

describe("radar", () => {
  test("draws rings, axis labels, curves and a legend with no scene errors", () => {
    const chart = radar({ title: "Stats", axes, curves }, options);
    const out = svg.emit(draw(chart.node));

    expect(check(draw(chart.node)).problems.filter((p) => p.severity === "error")).toEqual([]);
    expect(out).toContain(">Speed<");
    expect(out).toContain(">Stats<");
    expect(out).toContain(">Bee<");
    expect(chart.span).toBeUndefined();
  });

  test("showLegend false drops the legend and narrows the chart", () => {
    const withLegend = radar({ axes, curves }, options);
    const without = radar({ axes, curves, showLegend: false }, options);

    expect(svg.emit(draw(without.node))).not.toContain(">Bee<");
    expect(without.size[0]).toBeLessThan(withLegend.size[0]);
  });

  test("graticule polygon and ticks change the drawing", () => {
    const round = svg.emit(draw(radar({ axes, curves }, options).node));

    const flat = svg.emit(
      draw(radar({ axes, curves, graticule: "polygon", ticks: 3 }, options).node),
    );

    expect(flat).not.toBe(round);
  });

  test("curves reveal one beat each in order", () => {
    const chart = radar({ axes, curves }, { ...options, reveal: span(1, 0.5) });

    expect(chart.when("a")?.start).toBe(1);
    expect(chart.when("b")?.start).toBe(1.5);
  });

  test("rejects too few axes, wrong value counts, bad options and unknown parts", () => {
    expect(thrown(() => radar({ axes: ["a", "b"], curves }, options)).problem).toContain(
      "at least 3",
    );
    expect(thrown(() => radar({ axes, curves: { a: [1, 2] } }, options)).problem).toBe(
      'radar() curve "a" has 2 values for 4 axes.',
    );
    expect(thrown(() => radar({ axes, curves, max: 0 }, options)).problem).toContain(
      "max above min",
    );
    expect(thrown(() => radar({ axes, curves, ticks: 0 }, options)).problem).toContain("ticks");
    expect(thrown(() => radar({ axes, curves: {} }, options)).problem).toContain(
      "at least one curve",
    );
    // SAFETY: a value the types forbid, on purpose, to read the runtime error
    expect(thrown(() => radar({ axes, curves }, options).part("x" as never)).problem).toBe(
      'radar() has no part "x".',
    );
  });
});
