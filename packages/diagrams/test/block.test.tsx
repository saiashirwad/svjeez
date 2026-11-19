import { describe, expect, test } from "bun:test";
import { Group, Shape, circle, font, scene, span } from "svjeez";
import { SceneError, check, svg, type Child } from "svjeez/tools";
import { blockDiagram, type BlockSpec } from "../src/block.tsx";
import type { DiagramColors } from "../src/kit.tsx";
import type { Box } from "../src/layout/box.ts";
import { block as place, type BlockCell } from "../src/layout/block.ts";

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
  scene({ size: [900, 600], duration: 6, title: "Block", loop: false }, () => (
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

const leaf = (id: string, span?: number): BlockCell => ({ id, span, size: { w: 80, h: 30 } });

const overlap = (a: Box, b: Box): boolean =>
  a.x < b.x + b.w - 0.5 && b.x < a.x + a.w - 0.5 && a.y < b.y + b.h - 0.5 && b.y < a.y + a.h - 0.5;

describe("block layout", () => {
  test("fills rows left to right and wraps at the column count", () => {
    const out = place({
      columns: 2,
      cells: ["a", "b", "c"].map((id) => leaf(id)),
      edges: [],
      gap: 20,
    });

    const a = out.boxes.get("a")!;
    const b = out.boxes.get("b")!;
    const c = out.boxes.get("c")!;

    expect(b.x).toBeGreaterThan(a.x + a.w);
    expect(b.y).toBe(a.y);
    expect(c.x).toBe(a.x);
    expect(c.y).toBeGreaterThan(a.y + a.h);
  });

  test("by default cells share one row", () => {
    const out = place({ cells: ["a", "b", "c"].map((id) => leaf(id)), edges: [] });

    expect(new Set([...out.boxes.values()].map((b) => b.y)).size).toBe(1);
  });

  test("a block of width 2 is as wide as two columns and the gap between them, and a space fills columns", () => {
    const out = place({
      columns: 3,
      cells: [leaf("a"), leaf("b", 2), leaf("c"), { space: true, span: 2 }, leaf("d")],
      edges: [],
      gap: 20,
    });

    const a = out.boxes.get("a")!;
    const b = out.boxes.get("b")!;
    const c = out.boxes.get("c")!;
    const d = out.boxes.get("d")!;

    expect(b.w).toBeCloseTo(2 * a.w + 20);
    expect(c.x).toBe(a.x);
    expect(d.x).toBe(a.x);
    expect(d.y).toBeGreaterThan(c.y + c.h);
  });

  test("a group holds its cells inside its frame and takes its own columns", () => {
    const out = place({
      columns: 2,
      cells: [
        leaf("a"),
        { id: "g", columns: 1, cells: [leaf("x"), leaf("y")], size: { w: 0, h: 0 } },
      ],
      edges: [],
      gap: 20,
    });

    const g = out.boxes.get("g")!;
    const x = out.boxes.get("x")!;
    const y = out.boxes.get("y")!;

    for (const inner of [x, y]) {
      expect(inner.x).toBeGreaterThanOrEqual(g.x);
      expect(inner.x + inner.w).toBeLessThanOrEqual(g.x + g.w);
      expect(inner.y).toBeGreaterThanOrEqual(g.y);
      expect(inner.y + inner.h).toBeLessThanOrEqual(g.y + g.h);
    }

    expect(y.y).toBeGreaterThan(x.y + x.h);
  });

  test("routes an edge straight between neighbours and around a block in the way", () => {
    const out = place({
      cells: ["a", "b", "c"].map((id) => leaf(id)),
      edges: [
        { from: "a", to: "b" },
        { from: "a", to: "c" },
      ],
      gap: 20,
    });

    expect(out.edges[0]).toHaveLength(2);
    expect(out.edges[0]![0]!.y).toBe(out.edges[0]![1]!.y);
    const [others] = [[...out.boxes.values()].filter((b) => b !== out.boxes.get("a"))];

    for (const p of out.edges[1]!) {
      const dot = { x: p.x, y: p.y, w: 0, h: 0 };

      expect(others!.some((b) => overlap(dot, b))).toBe(false);
    }

    const [first, last] = [out.edges[1]![0]!, out.edges[1]!.at(-1)!];
    const [a, c] = [out.boxes.get("a")!, out.boxes.get("c")!];

    expect(
      first.y === a.y || first.y === a.y + a.h || first.x === a.x || first.x === a.x + a.w,
    ).toBe(true);
    expect(last.y === c.y || last.y === c.y + c.h || last.x === c.x || last.x === c.x + c.w).toBe(
      true,
    );
  });

  test("never lets a routed segment cross a block", () => {
    const out = place({
      columns: 3,
      cells: ["a", "b", "c", "d", "e", "f"].map((id) => leaf(id)),
      edges: [
        { from: "a", to: "f" },
        { from: "c", to: "d" },
        { from: "b", to: "e" },
      ],
      gap: 20,
    });

    out.edges.forEach((points) => {
      for (let i = 1; i < points.length; i++) {
        const [p, q] = [points[i - 1]!, points[i]!];

        const run = {
          x: Math.min(p.x, q.x),
          y: Math.min(p.y, q.y),
          w: Math.abs(p.x - q.x),
          h: Math.abs(p.y - q.y),
        };

        for (const box of out.boxes.values()) expect(overlap(run, box)).toBe(false);
      }
    });
  });

  test("is deterministic and rejects bad input", () => {
    const input = {
      columns: 2,
      cells: ["a", "b", "c"].map((id) => leaf(id)),
      edges: [{ from: "a", to: "c" }],
    };

    expect(place(input)).toEqual(place(input));
    expect(() => place({ ...input, cells: [leaf("a"), leaf("a")] })).toThrow("two cells");
    expect(() => place({ ...input, edges: [{ from: "a", to: "z" }] })).toThrow("unknown block");
    expect(() => place({ ...input, edges: [{ from: "a", to: "a" }] })).toThrow("itself");
  });
});

describe("block diagram", () => {
  const spec: BlockSpec = {
    columns: 3,
    cells: [
      { id: "a", label: "Alpha" },
      { space: 1 },
      { id: "b", shape: "stadium" },
      { id: "arrow", shape: "arrow-down", span: 1 },
      {
        id: "g",
        cells: [
          { id: "c", shape: "cylinder" },
          { id: "d", shape: "diamond" },
        ],
        span: 2,
      },
    ],
    edges: [
      ["a", "b", "go"],
      ["c", "d", undefined, { line: "dotted", head: "none" }],
    ],
  };

  test("draws every block, group and edge, with no scene errors", () => {
    const chart = blockDiagram(spec, options);
    const out = svg.emit(draw(chart.node));

    expect(check(draw(chart.node)).problems.filter((p) => p.severity === "error")).toEqual([]);
    expect(out).toContain(">Alpha<");
    expect(out).toContain(">go<");
    expect(chart.span).toBeUndefined();
  });

  test("draws every shape", () => {
    const shapes = [
      "rect",
      "round",
      "stadium",
      "diamond",
      "circle",
      "subroutine",
      "cylinder",
    ] as const;

    const arrows = ["right", "left", "up", "down", "x", "y"] as const;

    const chart = blockDiagram(
      {
        columns: 4,
        cells: [
          ...shapes.map((shape) => ({ id: shape, shape })),
          ...arrows.map((a) => ({ id: a, label: a, shape: `arrow-${a}` as const })),
        ],
      },
      options,
    );

    expect(check(draw(chart.node)).problems.filter((p) => p.severity === "error")).toEqual([]);
  });

  test("reveals blocks in reading order, groups first, and edges after both ends", () => {
    const chart = blockDiagram(spec, { ...options, reveal: span(0, 0.5) });
    const start = (id: string) => chart.when(id)!.start;

    expect(start("a")).toBeLessThan(start("b"));
    expect(start("g")).toBeLessThan(start("c"));
    expect(start("a->b")).toBeLessThanOrEqual(start("b"));
    expect(chart.span).toBeDefined();
    expect(chart.edge("a", "b").length).toBeGreaterThan(0);
  });

  test("errors say what is wrong", () => {
    expect(thrown(() => blockDiagram({ cells: [] }, options)).message).toContain(
      "at least one block",
    );
    expect(
      thrown(() => blockDiagram({ cells: [{ id: "a" }, { id: "a" }] }, options)).message,
    ).toContain("same id");
    expect(thrown(() => blockDiagram({ cells: [{ id: "a/b" }] }, options)).message).toContain(
      '"/"',
    );
    expect(
      thrown(() => blockDiagram({ cells: [{ id: "g", cells: [] }] }, options)).message,
    ).toContain("holds no cells");
    expect(
      thrown(() => blockDiagram({ cells: [{ id: "a" }], edges: [["a", "z"]] }, options)).message,
    ).toContain('names "z"');
    expect(
      thrown(() => blockDiagram({ cells: [{ space: 0 }, { id: "a" }] }, options)).message,
    ).toContain("whole number");
  });
});
