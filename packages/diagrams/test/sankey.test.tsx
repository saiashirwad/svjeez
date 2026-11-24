import { describe, expect, test } from "bun:test";
import { Group, Shape, circle, font, scene, span } from "svjeez";
import { SceneError, check, svg, type Child } from "svjeez/tools";
import type { DiagramColors } from "../src/kit.tsx";
import { sankey as place } from "../src/layout/sankey.ts";
import { sankey, type SankeyLink } from "../src/sankey.tsx";
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
  scene({ size: [900, 600], duration: 6, title: "Sankey", loop: false }, () => (
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

const links: SankeyLink[] = [
  ["Coal", "Power", 40],
  ["Gas", "Power", 20],
  ["Power", "Homes", 35],
  ["Power", "Industry", 25],
  ["Gas", "Industry", 10],
];

describe("sankey layout", () => {
  const input = {
    nodes: ["Coal", "Gas", "Power", "Homes", "Industry"],
    links: links.map(([from, to, value]) => ({ from, to, value })),
    span: 300,
    height: 200,
    nodeWidth: 10,
    gap: 12,
  };

  const out = place(input);

  test("puts a node a column after its deepest source and sinks in the last column", () => {
    expect(out.columns).toBe(3);
    expect(out.column.get("Coal")).toBe(0);
    expect(out.column.get("Power")).toBe(1);
    expect(out.column.get("Industry")).toBe(2);
  });

  test("sizes nodes by flow with one scale, and keeps a column inside the height", () => {
    const h = (id: string) => out.nodes.get(id)!.h;

    expect(h("Power") / h("Coal")).toBeCloseTo(60 / 40);
    expect(h("Homes") / h("Industry")).toBeCloseTo(35 / 35);

    for (const box of out.nodes.values()) {
      expect(box.y).toBeGreaterThanOrEqual(-1e-6);
      expect(box.y + box.h).toBeLessThanOrEqual(200 + 1e-6);
    }
  });

  test("never overlaps two nodes of a column", () => {
    const column = (c: number) =>
      [...out.nodes.entries()]
        .flatMap(([id, box]) => (out.column.get(id) === c ? [box] : []))
        .sort((a, b) => a.y - b.y);

    for (let c = 0; c < out.columns; c++) {
      const boxes = column(c);

      for (let i = 1; i < boxes.length; i++)
        expect(boxes[i]!.y).toBeGreaterThanOrEqual(boxes[i - 1]!.y + boxes[i - 1]!.h);
    }
  });

  test("keeps every band inside the node it leaves and the one it enters", () => {
    for (const link of out.links) {
      const [a, b] = [out.nodes.get(link.from)!, out.nodes.get(link.to)!];

      expect(link.y0 - link.thickness / 2).toBeGreaterThanOrEqual(a.y - 1e-6);
      expect(link.y0 + link.thickness / 2).toBeLessThanOrEqual(a.y + a.h + 1e-6);
      expect(link.y1 - link.thickness / 2).toBeGreaterThanOrEqual(b.y - 1e-6);
      expect(link.y1 + link.thickness / 2).toBeLessThanOrEqual(b.y + b.h + 1e-6);
      expect(link.x1).toBeGreaterThan(link.x0);
    }
  });

  test("is deterministic", () => {
    expect(place(input)).toEqual(out);
  });

  test("rejects a loop", () => {
    expect(() =>
      place({
        ...input,
        nodes: ["a", "b"],
        links: [
          { from: "a", to: "b", value: 1 },
          { from: "b", to: "a", value: 1 },
        ],
      }),
    ).toThrow("loop");
  });
});

describe("sankey", () => {
  test("draws a bar and a label for each node and a band for each link, with no scene errors", () => {
    const chart = sankey({ links }, options);
    const out = svg.emit(draw(chart.node));

    expect(check(draw(chart.node)).problems.filter((p) => p.severity === "error")).toEqual([]);
    expect(out).toContain(">Coal<");
    expect(out).toContain(">60<");
    expect(chart.size[0]).toBeGreaterThan(chart.size[1] / 2);
    expect(chart.span).toBeUndefined();
  });

  test("reveals column by column, nodes first and then the links leaving them", () => {
    const chart = sankey({ links }, { ...options, reveal: span(0, 0.5) });
    const start = (id: string) => chart.when(id)!.start;

    expect(start("Coal")).toBeLessThan(start("Gas"));
    expect(start("Gas")).toBeLessThan(start("Coal->Power"));
    expect(start("Gas->Industry")).toBeLessThan(start("Power"));
    expect(start("Power")).toBeLessThan(start("Power->Homes"));
    expect(chart.span).toBeDefined();
  });

  test("labels nodes by display name", () => {
    const chart = sankey({ nodes: { a: "Alpha" }, links: [["a", "b", 1]] }, options);

    expect(svg.emit(draw(chart.node))).toContain(">Alpha<");
  });

  test("names a repeated link a, b, #2", () => {
    const chart = sankey(
      {
        links: [
          ["a", "b", 1],
          ["a", "b", 2],
        ],
      },
      options,
    );

    expect(chart.when("a->b#2")).toBeUndefined();
    expect(() => chart.part("a->b#2")).not.toThrow();
  });

  test("errors say what is wrong", () => {
    expect(thrown(() => sankey({ links: [] }, options)).message).toContain("at least one link");
    expect(thrown(() => sankey({ links: [["a", "a", 1]] }, options)).message).toContain(
      "flows into itself",
    );
    expect(thrown(() => sankey({ links: [["a", "b", 0]] }, options)).message).toContain(
      "value above 0",
    );
    expect(thrown(() => sankey({ links: [["a/x", "b", 1]] }, options)).message).toContain('"/"');
    expect(
      thrown(() => sankey({ nodes: { z: "Z" }, links: [["a", "b", 1]] }, options)).message,
    ).toContain("no link touches");
    expect(
      thrown(() =>
        sankey(
          {
            links: [
              ["a", "b", 1],
              ["b", "a", 1],
            ],
          },
          options,
        ),
      ).message,
    ).toContain("loop");
    expect(
      thrown(() => sankey({ links }, { ...options, reveal: { Nope: span(0, 1) } })).message,
    ).toContain('reveal names "Nope"');
  });
});
