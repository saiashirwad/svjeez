import { describe, expect, test } from "bun:test";
import { Group, Shape, circle, font, scene, span } from "svjeez";
import { SceneError, check, svg, type Child } from "svjeez/tools";
import { architecture, type ArchitectureSpec } from "../src/architecture.tsx";
import type { DiagramColors } from "../src/kit.tsx";
import { architecture as place, type ArchitectureInput } from "../src/layout/architecture.ts";

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
  scene({ size: [900, 600], duration: 6, title: "Architecture", loop: false }, () => (
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

const cell = (out: ReturnType<typeof place>, id: string) => out.nodes.get(id)!;

describe("architecture layout", () => {
  const nodes = ["a", "b", "c", "d"].map((id) => ({ id }));

  test("puts the end of an edge in the cell its side points to", () => {
    const out = place({
      nodes,
      groups: [],
      edges: [
        { from: "a", to: "b", fromSide: "R", toSide: "L" },
        { from: "b", to: "c", fromSide: "B", toSide: "T" },
        { from: "c", to: "d", fromSide: "L", toSide: "R" },
      ],
    });

    const [a, b, c, d] = ["a", "b", "c", "d"].map((id) => cell(out, id));

    expect([b!.col - a!.col, b!.row - a!.row]).toEqual([1, 0]);
    expect([c!.col - b!.col, c!.row - b!.row]).toEqual([0, 1]);
    expect([d!.col - c!.col, d!.row - c!.row]).toEqual([-1, 0]);
  });

  test("a bend steps once along the leaving side and once back from the entering side", () => {
    const out = place({
      nodes: [{ id: "a" }, { id: "b" }],
      groups: [],
      edges: [{ from: "a", to: "b", fromSide: "R", toSide: "T" }],
    });

    expect([
      cell(out, "b").col - cell(out, "a").col,
      cell(out, "b").row - cell(out, "a").row,
    ]).toEqual([1, 1]);
  });

  test("never puts two nodes in one cell", () => {
    const edges: ArchitectureInput["edges"] = [
      { from: "a", to: "b", fromSide: "R", toSide: "L" },
      { from: "a", to: "c", fromSide: "R", toSide: "L" },
      { from: "a", to: "d", fromSide: "R", toSide: "L" },
    ];

    const out = place({ nodes, groups: [], edges });
    const spots = [...out.nodes.values()].map((c) => `${c.col},${c.row}`);

    expect(new Set(spots).size).toBe(4);
  });

  test("keeps a group's members together and outsiders out", () => {
    const out = place({
      nodes: [{ id: "a", in: "g" }, { id: "b", in: "g" }, { id: "c" }, { id: "d", in: "h" }],
      groups: [{ id: "g" }, { id: "h" }],
      edges: [
        { from: "a", to: "b", fromSide: "R", toSide: "L" },
        { from: "b", to: "c", fromSide: "R", toSide: "L" },
        { from: "c", to: "d", fromSide: "R", toSide: "L" },
      ],
    });

    const inside = (id: string, g: string): boolean => {
      const [c, b] = [cell(out, id), out.groups.get(g)!];

      return c.col >= b.col && c.col < b.col + b.cols && c.row >= b.row && c.row < b.row + b.rows;
    };

    expect(inside("a", "g") && inside("b", "g")).toBe(true);
    expect(inside("c", "g") || inside("c", "h")).toBe(false);
    expect(inside("d", "h")).toBe(true);
    expect(out.groups.get("g")!.cols).toBe(2);
  });

  test("lays groups inside groups, and unconnected nodes side by side", () => {
    const out = place({
      nodes: [{ id: "a", in: "inner" }, { id: "b" }, { id: "c" }],
      groups: [{ id: "outer" }, { id: "inner", in: "outer" }],
      edges: [],
    });

    const [outer, inner] = [out.groups.get("outer")!, out.groups.get("inner")!];

    expect(inner.col).toBeGreaterThanOrEqual(outer.col);
    expect(cell(out, "a").col).toBeGreaterThanOrEqual(inner.col);
    expect(out.cols * out.rows).toBeGreaterThanOrEqual(3);
  });

  test("is deterministic and rejects bad input", () => {
    const input: ArchitectureInput = {
      nodes,
      groups: [],
      edges: [{ from: "a", to: "b", fromSide: "R", toSide: "L" }],
    };

    expect(place(input)).toEqual(place(input));
    expect(() => place({ ...input, nodes: [...nodes, { id: "a" }] })).toThrow("two cells");
    expect(() => place({ ...input, nodes: [{ id: "a", in: "zz" }, { id: "b" }] })).toThrow(
      "not a group",
    );
    expect(() => place({ ...input, edges: [{ ...input.edges[0]!, to: "zz" }] })).toThrow(
      "not a service",
    );
  });
});

describe("architecture", () => {
  const spec: ArchitectureSpec = {
    groups: { core: { label: "Core", icon: "cloud" } },
    services: {
      users: { icon: "internet", label: "Users" },
      api: { icon: "server", label: "API", in: "core" },
      db: { icon: "database", label: "Database", in: "core" },
      files: { icon: "disk", in: "core" },
    },
    junctions: { fork: { in: "core" } },
    edges: [
      ["users", "R", "api", "L", { head: "to" }],
      ["api", "R", "fork", "L"],
      ["fork", "R", "db", "L", { label: "sql", head: "both" }],
      ["fork", "B", "files", "T", { head: "from" }],
    ],
  };

  test("draws every service, group, junction and edge, with no scene errors", () => {
    const chart = architecture(spec, options);
    const out = svg.emit(draw(chart.node));

    expect(check(draw(chart.node)).problems.filter((p) => p.severity === "error")).toEqual([]);
    expect(out).toContain(">Database<");
    expect(out).toContain(">Core<");
    expect(out).toContain(">sql<");
    expect(chart.span).toBeUndefined();
  });

  test("routes an edge to the sides it names", () => {
    const chart = architecture(spec, options);
    const hop = chart.edge("users", "api");

    expect(hop.points.length).toBeGreaterThanOrEqual(2);
    expect(hop.at(1)[0]).toBeGreaterThan(hop.at(0)[0]);
    expect(() => chart.edge("api", "users")).toThrow("no edge");
  });

  test("bends an edge between perpendicular sides once", () => {
    const chart = architecture(
      {
        services: { a: {}, b: {} },
        edges: [["a", "R", "b", "T"]],
      },
      options,
    );

    expect(chart.edge("a", "b").points.length).toBeGreaterThan(2);
  });

  test("reveals services in reading order, a group with its first member, and edges after both ends", () => {
    const chart = architecture(spec, { ...options, reveal: span(0, 0.5) });
    const start = (id: string) => chart.when(id)!.start;

    expect(start("users")).toBeLessThan(start("api"));
    expect(start("core")).toBe(Math.min(start("api"), start("db"), start("files"), start("fork")));
    expect(start("users->api")).toBeLessThanOrEqual(start("api"));
    expect(chart.span).toBeDefined();
  });

  test("errors say what is wrong", () => {
    const a = { services: { a: {}, b: {} } };

    expect(thrown(() => architecture({ services: {} }, options)).message).toContain(
      "at least one service",
    );
    expect(
      thrown(() => architecture({ ...a, edges: [["a", "R", "z", "L"]] }, options)).message,
    ).toContain('names "z"');
    expect(
      thrown(() => architecture({ ...a, edges: [["a", "R", "a", "L"]] }, options)).message,
    ).toContain("back to itself");
    // SAFETY: a bad side, which the types forbid
    expect(
      thrown(() => architecture({ ...a, edges: [["a", "X" as "L", "b", "L"]] }, options)).message,
    ).toContain("L, R, T or B");
    expect(
      thrown(() => architecture({ services: { a: { in: "nope" } } }, options)).message,
    ).toContain("not a group");
    // SAFETY: an icon the types forbid
    expect(
      thrown(() => architecture({ services: { a: { icon: "bolt" as "cloud" } } }, options)).message,
    ).toContain("Its icons are");
    expect(thrown(() => architecture({ ...a, groups: { a: {} } }, options)).message).toContain(
      "same id",
    );
  });
});
