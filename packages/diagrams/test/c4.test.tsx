import { describe, expect, test } from "bun:test";
import { Group, Shape, circle, font, scene, span } from "svjeez";
import { SceneError, check, svg, type Child } from "svjeez/tools";
import { c4 } from "../src/c4.tsx";
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
  scene({ size: [1200, 900], duration: 6, title: "C4", loop: false }, () => (
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

interface Wrong {
  readonly elements?: unknown;
  readonly boundaries?: unknown;
  readonly relations?: unknown;
}

const spec = {
  elements: {
    user: { label: "User", kind: "person", descr: "Someone who buys things" },
    web: { label: "Web", kind: "container", techn: "React", boundary: "inner" },
    db: { label: "Store", kind: "container", shape: "db", techn: "SQL", boundary: "inner" },
    mail: { label: "Mail", external: true },
  },
  boundaries: {
    outer: { label: "Shop", type: "Enterprise" },
    inner: { label: "Backend", type: "System", boundary: "outer" },
  },
  relations: [
    { from: "user", to: "web", label: "Uses", techn: "HTTPS" },
    { from: "web", to: "db", label: "Reads", both: true },
    { from: "web", to: "mail", label: "Sends" },
  ],
} as const;

const make = (extra = {}) => c4(spec, { ...options, ...extra });

describe("c4", () => {
  test("draws kinds, technologies, descriptions, boundaries and labels without problems", () => {
    const markup = svg.emit(draw(make().node));

    for (const text of [
      "[Person]",
      "[Container: React]",
      "[External Software System]",
      "Someone who buys things",
      "Shop",
      "[Enterprise]",
      "[System]",
      "Uses",
      "[HTTPS]",
    ])
      expect(markup).toContain(text);
    expect(errorsOf(make().node)).toEqual([]);
  });

  test("an outer boundary frames the inner one, and a title adds room above", () => {
    const d = make();
    const titled = make({ title: "Shop" });

    expect(titled.size[1]).toBeGreaterThan(d.size[1]);
    expect(svg.emit(draw(titled.node))).toContain("Shop");
    expect(d.size[0]).toBeGreaterThan(0);
  });

  test("a boundary enters with its last element, relations draw on with their later end", () => {
    const d = make({ reveal: span(0.5, 0.4) });

    expect(d.when("user")?.start).toBe(0.5);
    expect(d.when("inner")!.start).toBeGreaterThanOrEqual(d.when("user")!.start);
    expect(d.when("web->db")).toBeDefined();
    expect(make().span).toBeUndefined();
  });

  test("a left-to-right layout and a self relation still draw", () => {
    const d = c4(
      {
        elements: { a: { label: "A" } },
        relations: [{ from: "a", to: "a", label: "calls itself" }],
      },
      { ...options, direction: "LR" },
    );

    expect(errorsOf(d.node)).toEqual([]);
  });

  test("edge() returns a route and reports a missing relation", () => {
    expect(make().edge("user", "web").length).toBeGreaterThan(0);
    expect(thrown(() => make().edge("web", "user")).problem).toBe(
      'c4() has no relation from "web" to "user".',
    );
  });

  test("reports bad input in one sentence with a fix", () => {
    const bad = (input: Wrong, extra = {}) =>
      // SAFETY: the test feeds deliberately wrong input.
      thrown(() =>
        c4({ elements: { a: { label: "A" } }, ...input } as never, { ...options, ...extra }),
      );

    expect(bad({ relations: [{ from: "a", to: "z" }] }).problem).toContain('relation 1 names "z"');
    expect(bad({ elements: { a: { label: "A", kind: "wizard" } } }).problem).toContain('"wizard"');
    expect(bad({ elements: { a: { label: "A", shape: "blob" } } }).problem).toContain('"blob"');
    expect(bad({ elements: { a: { label: "A", boundary: "nope" } } }).problem).toContain('"nope"');
    expect(bad({ boundaries: { b: { label: "B" } } }).problem).toContain('boundary "b" holds no');
    expect(bad({ boundaries: { a: { label: "B" } } }).problem).toContain("same name");
    expect(
      bad({
        elements: { a: { label: "A", boundary: "x" } },
        boundaries: { x: { label: "X", boundary: "y" }, y: { label: "Y", boundary: "x" } },
      }).problem,
    ).toContain("inside itself");
    expect(bad({}, { direction: "RL" }).problem).toContain('direction "TB" or "LR"');
  });
});
