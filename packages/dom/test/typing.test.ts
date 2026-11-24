import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { scene, words } from "svjeez";
import { valueAt, type Model } from "svjeez/tools";
import {
  compile,
  fade,
  typing,
  type ElementNode,
  type State,
  type TextChange,
  type TextNode,
} from "../src/index.ts";
import { box, snapshot } from "./fixtures.ts";
import { fontFixture } from "../../../fixtures/fonts.ts";

const SPACE = `data:font/ttf;base64,${readFileSync(fontFixture("SpaceMono-Regular")).toString(
  "base64",
)}`;

const FONT = { family: "Space", weight: 400, italic: false, stretch: 100, size: 14 };

const line = (text: string, props: Partial<TextNode> = {}): TextNode => ({
  type: "text",
  runs: [
    {
      x: 10,
      y: 20,
      text,
      advances: [...text].map(() => 8),
      font: FONT,
      letterSpacing: 0,
      color: props.placeholder ? "rgb(150, 150, 150)" : "rgb(0, 0, 0)",
    },
  ],
  ...props,
});

const field = (text: TextNode | undefined, props: Partial<ElementNode> = {}): ElementNode =>
  box({
    tag: "input",
    part: "title",
    rect: { x: 0, y: 0, width: 200, height: 30 },
    children: text ? [text] : [],
    ...props,
  });

const state = (name: string, el: ElementNode, timing: Partial<State> = {}): State => ({
  name,
  snapshot: snapshot(
    box({ id: "app", rect: { x: 0, y: 0, width: 300, height: 100 }, children: [el] }),
    { fonts: [{ family: "Space", weight: 400, italic: false, src: SPACE }] },
  ),
  ...timing,
});

const lowered = (states: readonly State[], options: Parameters<typeof compile>[1] = {}) => {
  const compiled = compile(states, { over: 1, hold: 1, ...options });

  return scene(
    { size: compiled.size, duration: compiled.duration, title: "typing" },
    () => compiled.element,
  );
};

const nodes = (model: Model.Scene): Model.SceneNode[] =>
  [model.root].flatMap(function walk(node: Model.SceneNode): Model.SceneNode[] {
    return [node, ...(node.kind === "group" ? node.children.flatMap(walk) : [])];
  });

/** The texts the typed node shows, in order, or undefined when nothing is typed. */
const typedTexts = (model: Model.Scene) => {
  const found = nodes(model).find((node) => node.authored?.count);

  return found?.authored?.count?.ticks.map((tick) => tick.text);
};

const typedAt = (model: Model.Scene, t: number) =>
  nodes(model)
    .find((node) => node.authored?.count)
    ?.authored?.count?.ticks.findLast((tick) => tick.t <= t)?.text;

describe("typing between states", () => {
  const editing = [
    state("empty", field(line("Title", { placeholder: true }), { focused: true })),
    state("typed", field(line("Save it"), { focused: true })),
    state("edited", field(line("Save on"), { focused: true })),
    state("left", field(line("Save on"))),
  ];

  test("a focused field types its value, and backspaces to what two values share", () => {
    const model = lowered(editing);

    expect(typedTexts(model)).toEqual([
      "",
      "S",
      "Sa",
      "Sav",
      "Save",
      "Save ",
      "Save i",
      "Save it",
      "Save i",
      "Save ",
      "Save o",
      "Save on",
    ]);
    // Each move takes its second, after a second's hold.
    expect(typedAt(model, 0.5)).toBe("");
    expect(typedAt(model, 2.1)).toBe("Save it");
    expect(typedAt(model, 4.1)).toBe("Save on");
  });

  test("the placeholder goes at the first keystroke, and the caret goes with focus", () => {
    const model = lowered(editing);
    const hint = nodes(model).find((node) => node.kind === "text" && node.key.endsWith(".0"));

    // Its own opacity, under the fade the morph gives it as it leaves.
    const own = hint!.layers.at(-1)!.opacity;

    expect(valueAt(own, 0.5, (a) => a)).toBe(1);
    expect(valueAt(own, 1.15, (a) => a)).toBe(0);

    const caret = nodes(model).find((node) => node.key.endsWith("/caret"))!;
    const focus = caret.layers.at(-1)!.opacity;

    expect(valueAt(focus, 4.5, (a) => a)).toBe(1);
    expect(valueAt(focus, 6.5, (a) => a)).toBe(0);
  });

  test("text that is not in a focused field fades, as before", () => {
    const blurred = editing.map((one) => ({
      ...one,
      snapshot: {
        ...one.snapshot,
        root: {
          ...one.snapshot.root,
          children: one.snapshot.root.children.map((el) =>
            el.type === "element" ? { ...el, focused: undefined } : el,
          ),
        },
      },
    }));

    expect(typedTexts(lowered(blurred))).toBeUndefined();
  });

  test("a policy of your own picks what types and how, from what it knows of the change", () => {
    const seen: TextChange[] = [];

    const label = (text: string) =>
      box({
        tag: "h1",
        part: "heading",
        rect: { x: 0, y: 0, width: 200, height: 30 },
        children: [line(text)],
      });

    const model = lowered([state("a", label("one")), state("b", label("one two three"))], {
      text: (change) => {
        seen.push(change);

        return change.part === "heading" ? typing({ by: words }) : fade;
      },
    });

    expect(seen).toEqual([
      {
        from: "one",
        to: "one two three",
        state: "b",
        tag: "h1",
        part: "heading",
        field: false,
        focused: false,
      },
    ]);
    expect(typedTexts(model)).toEqual(["one", "one ", "one two ", "one two three"]);
  });

  test("a state's own policy wins over compile's", () => {
    const own = [editing[0]!, { ...editing[1]!, text: () => fade }];

    expect(typedTexts(lowered(own))).toBeUndefined();
    expect(typedTexts(lowered(editing.slice(0, 2), { text: () => fade }))).toBeUndefined();
  });

  test("text in a font svjeez can't measure fades", () => {
    const system = editing.map((one) => ({
      ...one,
      snapshot: { ...one.snapshot, fonts: [] },
    }));

    expect(typedTexts(lowered(system))).toBeUndefined();
  });
});
