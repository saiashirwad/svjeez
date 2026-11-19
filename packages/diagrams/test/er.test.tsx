import { describe, expect, test } from "bun:test";
import { Group, Shape, circle, font, scene, span } from "svjeez";
import { SceneError, check, svg, type Child } from "svjeez/tools";
import { erDiagram } from "../src/er.tsx";
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
  scene({ size: [1200, 900], duration: 6, title: "ER", loop: false }, () => (
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

const shop = (extra = {}) =>
  erDiagram(
    {
      entities: {
        CUSTOMER: {
          attributes: [
            { type: "string", name: "name", keys: ["PK"], comment: "full name" },
            { type: "string", name: "email", keys: ["UK"] },
          ],
        },
        ORDER: { attributes: [{ type: "int", name: "id", keys: ["PK", "FK"] }] },
        PRODUCT: "Product",
      },
      relations: [
        { from: "CUSTOMER", to: "ORDER", toCard: "zero-many", label: "places" },
        { from: "PRODUCT", to: "ORDER", fromCard: "zero-one", toCard: "one-many", line: "dashed" },
      ],
    },
    { ...options, ...extra },
  );

describe("erDiagram", () => {
  test("draws entity names, attribute tables and relationship labels", () => {
    const markup = svg.emit(draw(shop().node));

    for (const text of ["CUSTOMER", "string", "email", "PK,FK", "full name", "places", "Product"])
      expect(markup).toContain(text);
    expect(errorsOf(shop().node)).toEqual([]);
  });

  test("an entity grows with its rows and columns", () => {
    const one = erDiagram(
      { entities: { A: { attributes: [{ type: "int", name: "id" }] } } },
      options,
    );

    const two = erDiagram(
      {
        entities: {
          A: {
            attributes: [
              { type: "int", name: "id" },
              { type: "varchar(255)", name: "description", comment: "a long comment goes here" },
            ],
          },
        },
      },
      options,
    );

    const bare = erDiagram({ entities: { A: {} } }, options);

    expect(two.size[1]).toBeGreaterThan(one.size[1]);
    expect(two.size[0]).toBeGreaterThan(one.size[0]);
    expect(bare.size[1]).toBeLessThan(one.size[1]);
    expect(bare.size[0]).toBeGreaterThanOrEqual(96);
  });

  test("every cardinality draws its marker at its own end", () => {
    const marks = (card: "one" | "zero-one" | "one-many" | "zero-many") =>
      svg.emit(
        draw(
          erDiagram(
            { entities: { A: {}, B: {} }, relations: [{ from: "A", to: "B", toCard: card }] },
            options,
          ).node,
        ),
      );

    const markups = (["one", "zero-one", "one-many", "zero-many"] as const).map(marks);

    expect(new Set(markups).size).toBe(4);
    const rings = markups.map((m) => m.split("<circle").length - 2);

    // The scene backdrop is one circle: zero-one and zero-many add a ring each.
    expect(rings).toEqual([0, 1, 0, 1]);
  });

  test("entities enter one beat each in rank order and relationships draw on with their later end", () => {
    const d = shop({ reveal: span(0.5, 0.4) });

    expect(d.when("CUSTOMER")?.start).toBe(0.5);
    expect(d.when("ORDER")!.start).toBeGreaterThan(d.when("CUSTOMER")!.start);
    expect(d.when("CUSTOMER->ORDER")).toBeDefined();
    expect(d.span?.start).toBe(0.5);
    expect(shop().span).toBeUndefined();
  });

  test("a self relationship loops without breaking the layout", () => {
    const d = erDiagram(
      {
        entities: { PERSON: {} },
        relations: [{ from: "PERSON", to: "PERSON", toCard: "zero-many", label: "parent of" }],
      },
      options,
    );

    expect(errorsOf(d.node)).toEqual([]);
  });

  test("edge() returns the relationship's route from its first entity to its second", () => {
    const route = shop().edge("CUSTOMER", "ORDER");

    expect(route.length).toBeGreaterThan(0);
    expect(thrown(() => shop().edge("ORDER", "CUSTOMER")).problem).toBe(
      'erDiagram() has no relation from "ORDER" to "CUSTOMER".',
    );
  });

  test("reports bad input in one sentence with a fix", () => {
    const bad = (relations: readonly object[], extra = {}) =>
      thrown(() =>
        erDiagram(
          // SAFETY: the test feeds deliberately wrong input.
          { entities: { A: {}, B: {} }, relations } as never,
          { ...options, ...extra },
        ),
      );

    expect(bad([{ from: "A", to: "Z" }]).problem).toBe(
      'erDiagram() relation 1 names "Z", which is not one of its entities.',
    );
    expect(bad([{ from: "A", to: "B", toCard: "many" }]).problem).toContain('cardinality "many"');
    expect(bad([], { direction: "RL" }).problem).toContain('direction "TB" or "LR"');
    // SAFETY: the test names a part or input the types would reject.
    expect(thrown(() => shop().part("Nope" as "ORDER")).problem).toContain('has no part "Nope"');
  });
});
