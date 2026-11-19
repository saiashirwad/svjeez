import { describe, expect, test } from "bun:test";
import { Group, Shape, circle, font, scene, span } from "svjeez";
import { SceneError, check, svg, type Child } from "svjeez/tools";
import type { DiagramColors } from "../src/kit.tsx";
import { mindmap } from "../src/mindmap.tsx";

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
  scene({ size: [1200, 800], duration: 6, title: "Mindmap", loop: false }, () => (
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
  root: { label: "Plan", shape: "circle" },
  a: { label: "Research", parent: "root", shape: "hex" },
  a1: { label: "Read", parent: "a" },
  b: { label: "Build", parent: "root", shape: "rect" },
  b1: { label: "Ship it", parent: "b", shape: "cloud" },
  c: { label: "Rest", parent: "root", shape: "bang" },
  d: { label: "Review", parent: "root", shape: "round" },
} as const;

describe("mindmap", () => {
  test("draws every shape with a curved branch to each child, with no scene errors", () => {
    const map = mindmap({ nodes }, options);
    const out = svg.emit(draw(map.node));

    expect(check(draw(map.node)).problems.filter((p) => p.severity === "error")).toEqual([]);

    for (const text of ["Plan", "Research", "Read", "Build", "Ship it", "Rest", "Review"])
      expect(out).toContain(`>${text}<`);
    expect(map.when("root->a")).toBeUndefined();
  });

  test("puts branches on both sides of the centre", () => {
    const map = mindmap({ nodes }, options);
    const [w] = map.size;
    const out = svg.emit(draw(map.node));
    const xs = [...out.matchAll(/translate\((-?[\d.]+)/g)].map((m) => Number(m[1]));

    expect(Math.min(...xs)).toBeLessThan(w / 2 - 40);
    expect(Math.max(...xs)).toBeGreaterThan(w / 2 + 40);
  });

  test("reveals ideas outward a beat each, and draws each branch before its idea", () => {
    const map = mindmap({ nodes }, { ...options, reveal: span(0, 0.2) });

    expect(map.when("root")?.start).toBe(0);
    expect(map.when("a")?.start).toBeCloseTo(0.2);
    expect(map.when("a1")?.start).toBeCloseTo(1);
    expect(map.when("root->a")?.start).toBeCloseTo(0.2 - 0.2);
    expect(map.span?.start).toBe(0);
  });

  test("long ideas wrap onto lines", () => {
    const map = mindmap(
      {
        nodes: {
          r: "Centre",
          l: { label: "British popular psychology author Tony Buzan and friends", parent: "r" },
        },
      },
      options,
    );

    expect(svg.emit(draw(map.node))).toContain(">British popular psychology<");
  });

  test("rejects two centres, an unknown parent, a loop and an unknown shape", () => {
    expect(thrown(() => mindmap({ nodes: { a: "A", b: "B" } }, options)).problem).toContain(
      'exactly one node with no parent, got "a", "b"',
    );
    expect(
      thrown(() => mindmap({ nodes: { a: "A", b: { label: "B", parent: "z" } } }, options)).problem,
    ).toContain('"z"');
    expect(
      thrown(() =>
        mindmap(
          {
            nodes: {
              r: "R",
              a: { label: "A", parent: "b" },
              b: { label: "B", parent: "a" },
            },
          },
          options,
        ),
      ).problem,
    ).toContain("loop");
    // SAFETY: a value the types forbid, on purpose, to read the runtime error
    expect(
      thrown(() => mindmap({ nodes: { a: { label: "A", shape: "blob" as never } } }, options))
        .problem,
    ).toContain('"blob"');
  });

  test("a single idea is a map", () => {
    const map = mindmap({ nodes: { only: "Only" } }, options);

    expect(map.size[0]).toBeGreaterThan(0);
    expect(svg.emit(draw(map.node))).toContain(">Only<");
  });
});
