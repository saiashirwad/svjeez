import { describe, expect, test } from "bun:test";
import { Group, Shape, circle, font, scene, span } from "svjeez";
import { SceneError, check, svg, type Child } from "svjeez/tools";
import type { DiagramColors } from "../src/kit.tsx";
import { gitGraph, type GitCommit } from "../src/git.tsx";

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
  scene({ size: [1200, 600], duration: 6, title: "Git", loop: false }, () => (
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

const branches = { main: "main", dev: "develop" };

const commits: readonly GitCommit<"main" | "dev">[] = [
  { id: "A", branch: "main", label: "A" },
  { id: "B", branch: "dev", parents: ["A"], label: "B", kind: "reverse" },
  { id: "C", branch: "main", parents: ["A"], label: "C", tags: ["v1", "rc"] },
  { id: "M", branch: "main", parents: ["C", "B"], kind: "merge" },
  { id: "H", branch: "main", parents: ["M"], kind: "highlight" },
  { id: "P", branch: "dev", parents: ["B", "H"], kind: "cherry-pick" },
];

describe("gitGraph", () => {
  test("TB and BT draw a column per branch, with a title above", () => {
    const [down, up] = (["TB", "BT"] as const).map((direction) =>
      gitGraph({ branches, commits }, { ...options, direction, title: "Flow" }),
    );

    for (const graph of [down!, up!]) {
      expect(check(draw(graph.node)).problems.filter((p) => p.severity === "error")).toEqual([]);
      expect(svg.emit(draw(graph.node))).toContain(">Flow<");
      expect(graph.size[1]).toBeGreaterThan(graph.size[0]);
    }

    expect(down!.size).toEqual(up!.size);
    expect(svg.emit(draw(down!.node))).not.toBe(svg.emit(draw(up!.node)));
    expect(
      // SAFETY: the test passes a direction the types reject.
      thrown(() => gitGraph({ branches, commits }, { ...options, direction: "RL" as never }))
        .problem,
    ).toContain('"LR", "TB" or "BT"');
  });

  test("draws branches, every kind of commit, tags and merge lines, with no scene errors", () => {
    const graph = gitGraph({ branches, commits }, options);
    const out = svg.emit(draw(graph.node));

    expect(check(draw(graph.node)).problems.filter((p) => p.severity === "error")).toEqual([]);
    expect(out).toContain(">develop<");
    expect(out).toContain(">v1<");
    expect(out).toContain(">rc<");
    expect(graph.size[0]).toBeGreaterThan(graph.size[1]);
    expect(graph.span).toBeUndefined();
  });

  test("has a part for every branch, commit and line between them", () => {
    const graph = gitGraph({ branches, commits }, options);

    for (const id of ["main", "dev", "A", "P", "A->B", "B->M", "H->P"])
      expect(graph.when(id)).toBeUndefined();
    expect(() => graph.part("A->P")).toThrow('gitGraph() has no part "A->P"');
  });

  test("reveals a branch just before its first commit, and a line before the commit it ends at", () => {
    const graph = gitGraph({ branches, commits }, { ...options, reveal: span(0, 0.5) });

    expect(graph.when("main")?.start).toBe(0);
    expect(graph.when("A")?.start).toBe(0.5);
    expect(graph.when("dev")?.start).toBe(1);
    expect(graph.when("B")?.start).toBe(1.5);
    expect(graph.when("B")!.start).toBeGreaterThan(graph.when("A->B")!.start);
    expect(graph.span?.start).toBe(0);
  });

  test("a branch with no commits still gets a lane", () => {
    const graph = gitGraph(
      { branches: { main: "main", empty: "empty" }, commits: [{ id: "A", branch: "main" }] },
      options,
    );

    expect(svg.emit(draw(graph.node))).toContain(">empty<");
  });

  test("rejects unknown branches and parents, repeated names and unknown kinds", () => {
    const one = (c: GitCommit<"main">) => () =>
      gitGraph({ branches: { main: "main" }, commits: [c] }, options);

    // SAFETY: a value the types forbid, on purpose, to read the runtime error
    expect(thrown(one({ id: "A", branch: "x" as never })).problem).toContain('"x"');
    expect(thrown(one({ id: "A", branch: "main", parents: ["Z"] })).problem).toContain(
      'parent "Z"',
    );
    expect(thrown(one({ id: "main", branch: "main" })).problem).toContain("a branch and a commit");
    expect(thrown(one({ id: "a/b", branch: "main" })).problem).toContain('"a/b"');
    // SAFETY: a value the types forbid, on purpose, to read the runtime error
    expect(thrown(one({ id: "A", branch: "main", kind: "odd" as never })).problem).toContain(
      '"odd"',
    );
    expect(
      thrown(() =>
        gitGraph(
          {
            branches: { main: "main" },
            commits: [
              { id: "A", branch: "main" },
              { id: "A", branch: "main" },
            ],
          },
          options,
        ),
      ).problem,
    ).toContain("two commits");
  });
});
