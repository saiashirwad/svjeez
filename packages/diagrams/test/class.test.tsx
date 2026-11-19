import { describe, expect, test } from "bun:test";
import { Group, Shape, circle, font, scene, span } from "svjeez";
import { SceneError, check, svg, type Child } from "svjeez/tools";
import { classDiagram } from "../src/class.tsx";
import type { DiagramColors } from "../src/kit.tsx";

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
  scene({ size: [1200, 900], duration: 6, title: "Class", loop: false }, () => (
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

const zoo = (extra = {}) =>
  classDiagram(
    {
      classes: {
        Animal: { attributes: ["+int age"], methods: ["+mate()"] },
        Duck: { attributes: ["+String beakColor"], methods: ["+swim()"] },
        Flyer: { annotation: "interface", methods: ["+fly()"] },
        Pond: "Pond",
      },
      relations: [
        { from: "Animal", to: "Duck", start: "triangle", end: "none" },
        { from: "Duck", to: "Flyer", end: "triangle", line: "dashed" },
        {
          from: "Pond",
          to: "Duck",
          start: "diamond-filled",
          end: "none",
          label: "has",
          toLabel: "*",
        },
      ],
    },
    { ...options, ...extra },
  );

describe("classDiagram", () => {
  test("draws class names, members, annotations and labels", () => {
    const markup = svg.emit(draw(zoo().node));

    for (const text of ["Animal", "+int age", "+mate()", "«interface»", "has", "*"])
      expect(markup).toContain(text);
    expect(errorsOf(zoo().node)).toEqual([]);
  });

  test("puts a class above its subclass whichever way the relation is written", () => {
    const upright = classDiagram(
      {
        classes: { Parent: {}, Child: {} },
        relations: [{ from: "Child", to: "Parent", end: "triangle" }],
      },
      options,
    );

    const [parent, child] = [upright.part("Parent"), upright.part("Child")];

    expect(parent).toBeDefined();
    expect(child).toBeDefined();
    // The marked end is the last point, and the layout ranks the parent first.
    const route = upright.edge("Child", "Parent");
    expect(route.points[0]![1]).toBeGreaterThan(route.points.at(-1)![1]);
  });

  test("a class grows to fit its widest member and keeps its compartments apart", () => {
    const narrow = classDiagram({ classes: { A: { attributes: ["+x"] } } }, options);

    const wide = classDiagram(
      { classes: { A: { attributes: ["+aVeryLongAttributeNameIndeed: String"] } } },
      options,
    );

    expect(wide.size[0]).toBeGreaterThan(narrow.size[0]);
    expect(classDiagram({ classes: { A: {} } }, options).size[1]).toBeLessThan(narrow.size[1]);
  });

  test("classes enter one beat each in rank order and relations draw on as their later end enters", () => {
    const d = zoo({ reveal: span(0.5, 0.4) });

    expect(d.when("Animal")?.start).toBe(0.5);
    // Flyer is written below Duck but is its parent, so Duck enters last.

    for (const above of ["Animal", "Flyer", "Pond"] as const)
      expect(d.when(above)!.start).toBeLessThan(d.when("Duck")!.start);
    expect(d.when("Duck")!.start).toBe(1.7);
    expect(d.when("Animal->Duck")).toBeDefined();
    expect(d.span?.start).toBe(0.5);
    expect(zoo().span).toBeUndefined();
  });

  test("namespaces frame their classes and enter when all of them have", () => {
    const d = classDiagram(
      {
        classes: { A: {}, B: {}, C: {} },
        relations: [{ from: "A", to: "B" }],
        namespaces: { Core: { label: "Core", classes: ["A", "B"] } },
      },
      { ...options, reveal: span(0, 0.3) },
    );

    expect(d.when("Core")?.start).toBe(0);
    expect(svg.emit(draw(d.node))).toContain("Core");
    expect(errorsOf(d.node)).toEqual([]);
  });

  test("repeated relations get their own parts", () => {
    const d = classDiagram(
      {
        classes: { A: {}, B: {} },
        relations: [
          { from: "A", to: "B" },
          { from: "A", to: "B", line: "dashed" },
        ],
      },
      options,
    );

    expect(d.part("A->B")).toBeDefined();
    // SAFETY: the test names a part or input the types would reject.
    expect(() => d.part("A->B#2" as "A->B")).not.toThrow();
  });

  test("a self relation loops without breaking the layout", () => {
    const d = classDiagram(
      { classes: { Node: {} }, relations: [{ from: "Node", to: "Node", label: "next" }] },
      options,
    );

    expect(errorsOf(d.node)).toEqual([]);
  });

  test("direction LR lays classes out across", () => {
    const [down, across] = [zoo(), zoo({ direction: "LR" })];

    expect(across.size[0]).toBeGreaterThan(down.size[0] * 0.8);
    expect(across.size).not.toEqual(down.size);
  });

  test("reports bad input in one sentence with a fix", () => {
    const bad = (relations: readonly object[], extra = {}) =>
      thrown(() =>
        classDiagram(
          // SAFETY: the test feeds deliberately wrong input.
          { classes: { A: {}, B: {} }, relations } as never,
          { ...options, ...extra },
        ),
      );

    expect(bad([{ from: "A", to: "Z" }]).problem).toBe(
      'classDiagram() relation 1 names "Z", which is not one of its classes.',
    );
    expect(bad([{ from: "A", to: "B", end: "cross" }]).problem).toContain('the end "cross"');
    expect(bad([], { direction: "BT" }).problem).toContain('direction "TB" or "LR"');
    // SAFETY: the test names a part or input the types would reject.
    expect(
      thrown(() =>
        classDiagram(
          { classes: { A: {} }, namespaces: { A: { classes: ["A"] } } } as never,
          options,
        ),
      ).problem,
    ).toContain("a namespace and a class both named");
    expect(zoo().part("Animal")).toBeDefined();
    // SAFETY: the test names a part or input the types would reject.
    expect(thrown(() => zoo().part("Nope" as "Animal")).problem).toContain('has no part "Nope"');
  });
});
