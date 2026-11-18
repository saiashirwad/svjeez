import { describe, expect, test } from "bun:test";
import {
  Arrow,
  Group,
  Shape,
  Stack,
  Text,
  circle,
  font,
  rect,
  ref,
  scene,
  span,
  track,
  type SceneElement,
  type Vec,
} from "svjeez";
import { jsxDEV } from "svjeez/jsx-dev-runtime";
import { SceneError, type Model } from "svjeez/tools";

const mono = await font.load(new URL("./fixtures/SpaceMono-Regular.ttf", import.meta.url));

const made = (build: () => SceneElement, duration = 4): Model.Scene =>
  scene({ size: [200, 100], duration, title: "Errors" }, build);

const at = (line: number, column = 5) => ({
  fileName: "scene.tsx",
  lineNumber: line,
  columnNumber: column,
});

const thrown = (build: () => Model.Scene): SceneError => {
  try {
    build();
  } catch (error) {
    if (error instanceof SceneError) return error;
    throw error;
  }

  throw new Error("nothing was thrown");
};

describe("SceneError", () => {
  test("names the node, where it was written, what is wrong and what to change", () => {
    const error = thrown(() =>
      made(() => jsxDEV(Shape, { key: "dot", geometry: circle(4) }, undefined, false, at(7, 3))),
    );

    expect(error.problem).toBe('<Shape> "dot" paints nothing: it has no fill and no stroke.');
    expect(error.fix).toBe(
      "Give it a fill, as in fill={theme.text}, or a stroke, as in stroke={{ color: theme.text }}.",
    );
    expect(error.node).toBe('<Shape> "dot"');
    expect(error.source).toEqual({ file: "scene.tsx", line: 7, column: 3 });
    expect(error.message).toStartWith('scene.tsx:7:3: <Shape> "dot" paints nothing');
  });

  test("names a node with no key by its component and its words, never by its path", () => {
    const error = thrown(() =>
      made(() => (
        <Group>
          <Group>
            <Text font={mono} size={10}>
              Hello there
            </Text>
          </Group>
        </Group>
      )),
    );

    expect(error.problem).toBe(
      '<Text> "Hello there" draws "Hello there" with no fill, so it paints nothing.',
    );
    expect(error.message).not.toMatch(/\d\/\d/);
  });

  test("a layout error after lowering points at the child the container places", () => {
    const error = thrown(() =>
      made(() =>
        jsxDEV(
          Stack,
          {
            children: [
              jsxDEV(
                Shape,
                { key: "a", geometry: rect(4, 4), fill: "#000000", at: [5, 5] },
                undefined,
                false,
                at(9),
              ),
            ],
          },
          undefined,
          false,
          at(8),
        ),
      ),
    );

    expect(error.problem).toBe('<Shape> "a" has its own at, but the <Stack> it sits in places it.');
    expect(error.source?.line).toBe(9);
  });

  test("an arrow's parts are named after the arrow and point at it", () => {
    const model = made(() => {
      const a = ref("a");
      const b = ref("b");

      return (
        <Group>
          <Shape ref={a} geometry={rect(10, 10)} at={[10, 10]} fill="#000000" />
          <Shape ref={b} geometry={rect(10, 10)} at={[100, 10]} fill="#000000" />
          {jsxDEV(
            Arrow,
            { key: "link", from: a.right, to: b.left, stroke: { color: "#000000" } },
            undefined,
            false,
            at(12),
          )}
        </Group>
      );
    });

    const link = model.root.children.find((node) => node.key === "link");
    const parts = link?.kind === "group" ? link.children : [];

    expect(link?.name).toBe('<Arrow> "link"');
    expect(parts.map((part) => [part.name, part.source?.line])).toEqual([
      ['the shaft of <Arrow> "link"', 12],
      ['the head of <Arrow> "link"', 12],
    ]);
  });

  test("a component that refuses its props is named, at its call", () => {
    const error = thrown(() =>
      made(() =>
        jsxDEV(
          Arrow,
          // SAFETY: what a scene written without types hands over.
          { from: [0, 0], to: [10, 0], stroke: undefined as never },
          undefined,
          false,
          at(4),
        ),
      ),
    );

    expect(error.node).toBe("<Arrow>");
    expect(error.source?.line).toBe(4);
  });

  test("a plain error thrown while the scene builds becomes a SceneError that keeps its cause", () => {
    const cause = new Error("width is not known yet");

    const error = thrown(() =>
      made(() => {
        throw cause;
      }),
    );

    expect(error.problem).toBe("width is not known yet");
    expect(error.cause).toBe(cause);
  });
});

describe("two steps on one track", () => {
  test("a set() inside a step names the time of both and how to fix it", () => {
    const error = thrown(() =>
      made(() => {
        const dot = track<Vec>([10, 30]);

        dot.to([60, 30], span(0, 1));
        dot.set([10, 10], span(0.5));

        return <Shape geometry={circle(4)} at={dot} fill="#FF0000" />;
      }),
    );

    expect(error.problem).toBe(
      "Two steps move this track at once: one from 0s to 1s, and another at 0.5s, before the first ends.",
    );
    expect(error.fix).toBe(
      "Start the later step at 1s or later: the first step's span.next(over) starts where it ends.",
    );
  });

  test("two steps that overlap say when the second may start", () => {
    const error = thrown(() =>
      made(() => {
        const dot = track<Vec>([10, 30]);

        dot.to([60, 30], span(0, 2));
        dot.to([70, 30], span(1, 2));

        return <Shape geometry={circle(4)} at={dot} fill="#FF0000" />;
      }),
    );

    expect(error.problem).toBe(
      "Two steps move this track at once: one from 0s to 2s, and another from 1s to 3s, before the first ends.",
    );
    expect(error.fix).toStartWith("Start the later step at 2s or later");
  });
});
