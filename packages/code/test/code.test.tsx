import { describe, expect, test } from "bun:test";
import {
  Group,
  Shape,
  font,
  morph,
  ref,
  scene,
  span,
  type Bounds,
  type SceneElement,
} from "svjeez";
import { jsxDEV } from "svjeez/jsx-dev-runtime";
import { SceneError, describe as describeScene, check, svg } from "svjeez/tools";
import { Code, ts, type CodeProps } from "../src/index.ts";
import { tomorrow } from "../src/palettes.ts";
import { fontFixture } from "../../../fixtures/fonts.ts";

const mono = await font.load(fontFixture("JetBrainsMono"));

const SOURCE = "const a = 1;\n\n  return a;";

const made = (build: (canvas: Bounds) => SceneElement, duration = 3, loop = true) =>
  scene({ size: [320, 120], duration, title: "Code", loop }, build);

const snippet = (extra: Partial<CodeProps> = {}) =>
  jsxDEV(
    Code,
    { lang: ts, font: mono, size: 16, palette: tomorrow, children: SOURCE, ...extra },
    undefined,
    false,
    { fileName: "scene.tsx", lineNumber: 9, columnNumber: 5 },
  );

const thrown = (build: () => SceneElement): SceneError => {
  try {
    made(build);
  } catch (error) {
    if (error instanceof SceneError) return error;
    throw error;
  }

  throw new Error("nothing was thrown");
};

describe("<Code>", () => {
  test("draws a text per line, keyed by line number, and skips an empty one", () => {
    const frame = describeScene(
      made(() => snippet({ key: "code", at: [10, 10] })),
      [0],
    ).frames[0]!;

    expect(frame.nodes.map(({ key, text }) => [key, text])).toEqual([
      ["code", undefined],
      ["code/line-1", "const a = 1;"],
      ["code/line-3", "return a;"],
    ]);
  });

  test("lines sit one line height apart", () => {
    const [, one, three] = describeScene(
      made(() => snippet({ key: "code", lineHeight: 2 })),
      [0],
    ).frames[0]!.nodes;

    expect(three!.box[1] - one!.box[1]).toBe(2 * 2 * 16);
  });

  test("colors come from the palette's tokens, so the scheme switches without baked hex", () => {
    const out = svg.emit(made(() => snippet()));

    expect(out).toContain("--tomorrow-keyword:#B294BB");
    expect(out).toContain("(prefers-color-scheme:light)");
    expect(out).toContain("--tomorrow-keyword:#8959A8");
    expect(out).not.toMatch(/fill="#[0-9A-Fa-f]{6}"/);
  });

  test("keys name lines, and the code takes the node's own props", () => {
    const code = ref();

    const frame = describeScene(
      made((canvas) => (
        <Group>
          {snippet({ key: "code", ref: code, keys: ["head", "gap", "tail"], at: [4, 4] })}
          <Shape
            key="marker"
            geometry={canvas.rect}
            fill="#000000"
            at={code.part("tail").topLeft}
          />
        </Group>
      )),
      [0],
    ).frames[0]!;

    expect(frame.nodes.map(({ key }) => key)).toContain("code/tail");
    expect(frame.nodes.find(({ key }) => key.endsWith("marker"))!.box.slice(0, 2)).toEqual([
      4,
      4 + 2 * 1.5 * 16,
    ]);
  });

  test("typing reveals the lines one after another over its span, one lane per line", () => {
    const scheme = made(() => snippet({ key: "code", typing: span(0.5, 1) }));
    const { timeline } = describeScene(scheme, [0]);

    expect(timeline.map(({ key, animates }) => [key, animates.map(({ value }) => value)])).toEqual([
      ["code/line-1", ["clip"]],
      ["code/line-3", ["clip"]],
    ]);

    const [first, last] = timeline.map(({ animates }) => animates[0]!.spans[0]!);

    expect(first![0]).toBeCloseTo(0.5);
    expect(first![1]).toBeCloseTo(last![0]);
    expect(last![1]).toBeCloseTo(1.5);

    const [early, late] = describeScene(scheme, [0.4, 1.6]).frames.map(({ nodes }) =>
      nodes.filter(({ kind }) => kind === "text").map(({ box }) => box[2]),
    );

    expect(early).toEqual([0, 0]);
    expect(late![0]).toBeGreaterThan(100);
  });

  test("typing steps by character, the same in the SVG as in the model", () => {
    const out = svg.emit(made(() => snippet({ typing: span(0, 1) })));

    expect(out).toContain("steps(12)");
    expect(out).toContain("steps(11)");
  });

  test("morph pairs lines by key: a kept line moves, a changed one crossfades", () => {
    const states = [
      snippet({ key: "code", keys: ["a", "b", "c"], at: [0, 0] }),
      snippet({
        key: "code",
        keys: ["c", "b", "a"],
        at: [0, 0],
        children: "return a;\n\nconst a = 1;",
      }),
    ];

    const out = made(() => morph.between(states, [span(1, 1)]), 3);

    expect(check(out).problems.filter(({ severity }) => severity === "error")).toEqual([]);

    const texts = (t: number) =>
      describeScene(out, [t]).frames[0]!.nodes.filter(({ kind }) => kind === "text");

    const moved = (t: number) => texts(t).find(({ text }) => text === "const a = 1;")!.box[1];

    expect(moved(0)).toBe(0);
    expect(moved(1.5)).toBeGreaterThan(0);
    expect(moved(1.5)).toBeLessThan(48);
    expect(moved(2.5)).toBe(48);
    expect(texts(1.5).filter(({ text }) => text === "return a;")).toHaveLength(2);
  });

  test("a scene of code checks clean", () => {
    const found = check(
      made(() => snippet({ at: [10, 10], typing: span(0, 1) }), 3, false),
    ).problems;

    expect(found.filter(({ severity }) => severity !== "info")).toEqual([]);
  });
});

describe("<Code> misuse", () => {
  test("a lang with no grammar names the line and says what to give", () => {
    const error = thrown(() => snippet({ lang: [] }));

    expect(error.source).toEqual({ file: "scene.tsx", line: 9, column: 5 });
    expect(error.node).toBe("<Code>");
    expect(error.message).toStartWith("scene.tsx:9:5: lang is an empty list of grammars.");
    expect(error.fix).toBe(
      "Give a grammar, such as ts from @svjeez/code, or a list that ends in one.",
    );
  });

  test("source that is not one string says how to write it", () => {
    const error = thrown(() =>
      jsxDEV(
        Code,
        {
          lang: ts,
          font: mono,
          size: 16,
          palette: tomorrow,
          // @ts-expect-error source is one string, as the type says
          children: ["a", "b"],
        },
        undefined,
        false,
        { fileName: "scene.tsx", lineNumber: 9, columnNumber: 5 },
      ),
    );

    expect(error.problem).toBe("<Code> holds something that is not one string of source code.");
    expect(error.fix).toBe("Write the code as one string: <Code …>{`const x = 1;`}</Code>.");
  });

  test("a bad size, line height or tab size is refused", () => {
    expect(thrown(() => snippet({ size: 0 })).problem).toBe("<Code> needs a positive size, got 0.");
    expect(thrown(() => snippet({ lineHeight: -1 })).problem).toBe(
      "<Code> needs a positive lineHeight, got -1.",
    );
    expect(thrown(() => snippet({ tabSize: 0 })).problem).toBe("tabSize is 0.");
  });

  test("keys need one per line", () => {
    const error = thrown(() => snippet({ keys: ["a", "b"] }));

    expect(error.problem).toBe("keys names 2 lines, but the code has 3.");
    expect(error.fix).toBe("Give one key per line, empty lines included.");
  });
});
