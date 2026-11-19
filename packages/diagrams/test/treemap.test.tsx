import { describe, expect, test } from "bun:test";
import { Group, Shape, circle, font, scene, span } from "svjeez";
import { SceneError, check, svg, type Child } from "svjeez/tools";
import type { DiagramColors } from "../src/kit.tsx";
import { layoutTreemap } from "../src/layout/treemap.ts";
import { treemap } from "../src/treemap.tsx";

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
  scene({ size: [900, 600], duration: 6, title: "Treemap", loop: false }, () => (
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

const nodes = {
  food: { label: "Food" },
  fruit: { label: "Fruit", value: 3000, parent: "food" },
  veg: { label: "Veg", value: 1000, parent: "food" },
  rent: { label: "Rent", value: 6000 },
};

describe("treemap layout", () => {
  test("leaves fill the rectangle in proportion to their value without overlapping", () => {
    const leaf = (id: string, value: number) => ({ id, value, children: [] });

    const boxes = layoutTreemap([leaf("a", 6), leaf("b", 3), leaf("c", 1)], 200, 100, {
      gap: 0,
      header: 28,
      short: 18,
      side: 4,
    });

    const area = (id: string) => {
      const b = boxes.find((x) => x.id === id)!;

      return b.w * b.h;
    };

    expect(area("a") + area("b") + area("c")).toBe(200 * 100);
    expect(area("a")).toBeCloseTo(12000, -2);
    expect(area("c")).toBeCloseTo(2000, -2);
  });

  test("a section keeps its children inside, below its header", () => {
    const boxes = layoutTreemap(
      [
        {
          id: "s",
          value: 0,
          children: [
            { id: "x", value: 1, children: [] },
            { id: "y", value: 1, children: [] },
          ],
        },
      ],
      300,
      200,
      { gap: 2, header: 28, short: 18, side: 4 },
    );

    const [s, x, y] = ["s", "x", "y"].map((id) => boxes.find((b) => b.id === id)!);

    expect(s!.headed).toBe(true);

    for (const c of [x!, y!]) {
      expect(c.y).toBeGreaterThanOrEqual(s!.y + s!.header);
      expect(c.x).toBeGreaterThanOrEqual(s!.x);
      expect(c.x + c.w).toBeLessThanOrEqual(s!.x + s!.w);
      expect(c.y + c.h).toBeLessThanOrEqual(s!.y + s!.h);
    }
  });
});

describe("treemap", () => {
  test("draws sections, leaves, values and a title with no scene errors", () => {
    const chart = treemap({ title: "Budget", nodes }, options);
    const out = svg.emit(draw(chart.node));

    expect(check(draw(chart.node)).problems.filter((p) => p.severity === "error")).toEqual([]);
    expect(out).toContain(">Food<");
    expect(out).toContain(">Rent<");
    expect(out).toContain(">6,000<");
    expect(out).toContain(">Budget<");
    expect(chart.span).toBeUndefined();
  });

  test("width and height size the chart", () => {
    const [w, h] = treemap({ nodes, width: 300, height: 200 }, options).size;

    expect(w).toBe(316);
    expect(h).toBe(216);
  });

  test("nodes reveal one beat each in order", () => {
    const chart = treemap({ nodes }, { ...options, reveal: span(1, 0.5) });

    expect(chart.when("food")?.start).toBe(1);
    expect(chart.when("rent")?.start).toBe(2.5);
  });

  test("rejects values on sections, empty leaves, unknown or looping parents", () => {
    expect(
      thrown(() =>
        treemap(
          { nodes: { a: { label: "A", value: 1 }, b: { label: "B", value: 1, parent: "a" } } },
          options,
        ),
      ).problem,
    ).toContain("has a value and also holds");
    expect(thrown(() => treemap({ nodes: { a: { label: "A" } } }, options)).problem).toContain(
      "needs a value above 0",
    );
    expect(
      thrown(() => treemap({ nodes: { a: { label: "A", value: 1, parent: "zz" } } }, options))
        .problem,
    ).toContain('"zz"');
    expect(
      thrown(() =>
        treemap(
          {
            nodes: {
              r: { label: "R", value: 1 },
              a: { label: "A", parent: "b" },
              b: { label: "B", parent: "a" },
            },
          },
          options,
        ),
      ).problem,
    ).toContain("loop");
    expect(thrown(() => treemap({ nodes: {} }, options)).problem).toContain("at least one node");
    // SAFETY: a value the types forbid, on purpose, to read the runtime error
    expect(thrown(() => treemap({ nodes }, options).part("x" as never)).problem).toBe(
      'treemap() has no part "x".',
    );
  });
});
