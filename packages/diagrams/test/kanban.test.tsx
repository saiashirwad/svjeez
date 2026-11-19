import { describe, expect, test } from "bun:test";
import { Group, Shape, circle, font, scene, span } from "svjeez";
import { SceneError, check, svg, type Child } from "svjeez/tools";
import type { DiagramColors } from "../src/kit.tsx";
import { kanban } from "../src/kanban.tsx";

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
  scene({ size: [1000, 600], duration: 6, title: "Board", loop: false }, () => (
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

interface Loose {
  readonly id: string;
  readonly label: string;
  readonly cards?: readonly {
    readonly id: string;
    readonly label: string;
    readonly priority?: string;
  }[];
}

const spec = {
  columns: [
    {
      id: "todo",
      label: "Todo",
      cards: [
        { id: "a", label: "Write the documentation for the new API", ticket: "DOC-1" },
        { id: "b", label: "Fix", assigned: "mia", priority: "very high" },
      ],
    },
    { id: "done", label: "Done", cards: [{ id: "c", label: "Ship", priority: "low" }] },
    { id: "empty", label: "Empty" },
  ],
} as const;

const make = (extra = {}) => kanban(spec, { ...options, ...extra });

describe("kanban", () => {
  test("draws column titles, counts, cards and their details without problems", () => {
    const markup = svg.emit(draw(make().node));

    for (const text of ["Todo", "documentation for the", "DOC-1", "mia", "Ship"])
      expect(markup).toContain(text);
    expect(errorsOf(make().node)).toEqual([]);
  });

  test("columns are as tall as the tallest and sit side by side", () => {
    const d = make();

    expect(d.size[0]).toBe(3 * 220 + 2 * 12);
    expect(d.size[1]).toBeGreaterThan(100);
    expect(make({ columnWidth: 300 }).size[0]).toBe(3 * 300 + 2 * 12);
  });

  test("a long card wraps and grows taller", () => {
    const one = kanban(
      { columns: [{ id: "c", label: "C", cards: [{ id: "a", label: "short" }] }] },
      options,
    );

    const long = kanban(
      { columns: [{ id: "c", label: "C", cards: [{ id: "a", label: "word ".repeat(30) }] }] },
      options,
    );

    expect(long.size[1]).toBeGreaterThan(one.size[1]);
  });

  test("a priority adds a mark, a medium card gets none", () => {
    const marked = (priority: "medium" | "high") =>
      svg.emit(
        draw(
          kanban(
            { columns: [{ id: "c", label: "C", cards: [{ id: "a", label: "x", priority }] }] },
            options,
          ).node,
        ),
      );

    expect(marked("high").length).toBeGreaterThan(marked("medium").length);
  });

  test("columns and cards enter in reading order", () => {
    const d = make({ reveal: span(0.5, 0.2) });

    expect(d.when("todo")?.start).toBe(0.5);
    expect(d.when("a")!.start).toBeGreaterThan(d.when("todo")!.start);
    expect(d.when("done")!.start).toBeGreaterThan(d.when("b")!.start);
    expect(d.when("empty")!.start).toBeGreaterThan(d.when("c")!.start);
    expect(make().span).toBeUndefined();
  });

  test("reports bad input in one sentence with a fix", () => {
    const bad = (columns: readonly Loose[], extra = {}) =>
      // SAFETY: the test feeds deliberately wrong input.
      thrown(() => kanban({ columns } as never, { ...options, ...extra }));

    expect(bad([{ id: "a", label: "A", cards: [{ id: "a", label: "B" }] }]).problem).toContain(
      'more than one column or card named "a"',
    );

    expect(
      bad([{ id: "a", label: "A", cards: [{ id: "b", label: "B", priority: "urgent" }] }]).problem,
    ).toContain('priority "urgent"');
    expect(bad([]).problem).toContain("at least one");
    expect(bad([{ id: "a", label: "A" }], { columnWidth: 50 }).problem).toContain("columnWidth");
    // SAFETY: the test names a part the types would reject.
    expect(thrown(() => make().part("nope" as "a")).problem).toContain('has no part "nope"');
  });
});
