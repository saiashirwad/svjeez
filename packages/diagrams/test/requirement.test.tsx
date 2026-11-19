import { describe, expect, test } from "bun:test";
import { Group, Shape, circle, font, scene, span } from "svjeez";
import { SceneError, check, svg, type Child } from "svjeez/tools";
import type { DiagramColors } from "../src/kit.tsx";
import { requirementDiagram } from "../src/requirement.tsx";

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
  scene({ size: [1200, 900], duration: 6, title: "Requirements", loop: false }, () => (
    <Group>
      <Shape geometry={circle(1)} at={[0, 0]} fill="#FFFFFF" />
      <Group offset={[20, 20]}>{child}</Group>
    </Group>
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

const spec = {
  nodes: {
    top: {
      stereotype: "Requirement",
      fields: [
        ["ID", "1"],
        ["Text", "Orders must be payable online and the receipt must be emailed to the buyer."],
      ],
    },
    sub: { stereotype: "Functional Requirement", fields: [["ID", "1.1"]] },
    svc: { stereotype: "Element", kind: "element", fields: [["Type", "service"]] },
  },
  relations: [
    { from: "top", to: "sub", type: "contains" },
    { from: "svc", to: "sub", type: "satisfies" },
  ],
} as const;

const make = (extra = {}) => requirementDiagram(spec, { ...options, ...extra });

describe("requirementDiagram", () => {
  test("draws stereotypes, fields and relationship labels without layout problems", () => {
    const markup = svg.emit(draw(make().node));

    for (const text of ["«Requirement»", "«Element»", "Orders must be", "1.1", "«satisfies»"])
      expect(markup).toContain(text);
    expect(errorsOf(make().node)).toEqual([]);
  });

  test("a long value wraps and makes its box taller", () => {
    const short = requirementDiagram(
      { nodes: { a: { stereotype: "R", fields: [["Text", "short"]] } } },
      options,
    );

    const long = requirementDiagram(
      { nodes: { a: { stereotype: "R", fields: [["Text", "word ".repeat(40)]] } } },
      options,
    );

    expect(long.size[1]).toBeGreaterThan(short.size[1]);
  });

  test("contains is a solid line and the other relations are dashed", () => {
    const only = (type: "contains" | "traces") =>
      svg.emit(
        draw(
          requirementDiagram(
            {
              nodes: { a: { stereotype: "R" }, b: { stereotype: "R" } },
              relations: [{ from: "a", to: "b", type }],
            },
            options,
          ).node,
        ),
      );

    expect(only("contains")).not.toContain("stroke-dasharray");
    expect(only("traces")).toContain("stroke-dasharray");
  });

  test("nodes enter one beat each and relationships draw on with their later end", () => {
    const d = make({ reveal: span(0.5, 0.4) });

    expect(d.when("top")?.start).toBe(0.5);
    expect(d.when("sub")!.start).toBeGreaterThan(d.when("top")!.start);
    expect(d.when("top->sub")).toBeDefined();
    expect(make().span).toBeUndefined();
  });

  test("a self relation loops and a left-to-right layout still draws", () => {
    const d = requirementDiagram(
      {
        nodes: { a: { stereotype: "R" } },
        relations: [{ from: "a", to: "a", type: "refines" }],
      },
      { ...options, direction: "LR" },
    );

    expect(errorsOf(d.node)).toEqual([]);
  });

  test("edge() returns a route and reports a missing relation", () => {
    expect(make().edge("top", "sub").length).toBeGreaterThan(0);
    expect(thrown(() => make().edge("sub", "top")).problem).toBe(
      'requirementDiagram() has no relation from "sub" to "top".',
    );
  });

  test("reports bad input in one sentence with a fix", () => {
    const bad = (relations: readonly object[], extra = {}) =>
      thrown(() =>
        requirementDiagram(
          // SAFETY: the test feeds deliberately wrong input.
          { nodes: { a: { stereotype: "R" }, b: { stereotype: "R" } }, relations } as never,
          { ...options, ...extra },
        ),
      );

    expect(bad([{ from: "a", to: "z", type: "traces" }]).problem).toContain('relation 1 names "z"');
    expect(bad([{ from: "a", to: "b", type: "likes" }]).problem).toContain('"likes"');
    // SAFETY: the test passes a direction the types would reject.
    expect(bad([], { direction: "UP" as "TB" }).problem).toContain(
      'direction "TB", "LR", "BT" or "RL"',
    );
  });
});
