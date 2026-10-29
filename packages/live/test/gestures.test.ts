import { describe, expect, test } from "bun:test";
import { ease } from "svjeez";
import type { Compiled } from "../src/compile";
import { createEditor, valueOf, type Editor } from "../src/editor";
import { arrowEase, arrowNumber, bending, following, scrubbing, stroke } from "../src/gestures";

const scene = `const x = 10;
const fill = "#112233";
const curve = ease.linear;
export default () => x;
`;

/** An editor that compiles nothing, so only the messages its gestures send change it. */
const editing = (text = scene) =>
  createEditor({ text }, { compile: () => new Promise<Compiled>(() => {}) });

const number = (editor: Editor, key: string) => {
  const v = valueOf(editor.getState(), key);

  if (v?.kind !== "number") throw new Error(`${key} is a number`);

  return v;
};

const easeAt = (editor: Editor, key: string) => {
  const v = valueOf(editor.getState(), key);

  if (v?.kind !== "ease") throw new Error(`${key} is an ease`);

  return v;
};

describe("gestures", () => {
  test("a drag on a number keeps the range it began with, so the value follows the pointer and comes back", () => {
    const editor = editing();
    const { max } = number(editor, "x").param;
    const drag = scrubbing(editor, number(editor, "x"), 0);

    for (let dx = 10; dx <= 300; dx += 10) drag(dx);
    expect(number(editor, "x").literal.value).toBe(max);

    drag(0);
    expect(number(editor, "x").literal.value).toBe(10);
  });

  test("a whole drag is one undo step, and each arrow key is a step of its own", () => {
    const editor = editing();
    const drag = scrubbing(editor, number(editor, "x"), 0);
    [5, 10, 15].forEach((dx) => drag(dx));
    arrowNumber(editor, number(editor, "x"), "ArrowUp", false);
    arrowNumber(editor, number(editor, "x"), "ArrowUp", false);

    expect(editor.getState().history.past).toHaveLength(3);
    editor.send({ type: "undo" });
    editor.send({ type: "undo" });
    const afterDrag = number(editor, "x").literal.value;
    editor.send({ type: "undo" });

    expect(afterDrag).not.toBe(10);
    expect(number(editor, "x").literal.value).toBe(10);
  });

  test("an arrow steps a number up or down, ten steps with shift, and other keys do nothing", () => {
    const editor = editing();

    expect(arrowNumber(editor, number(editor, "x"), "ArrowRight", false)).toBe(true);
    expect(number(editor, "x").literal.value).toBe(11);
    arrowNumber(editor, number(editor, "x"), "ArrowDown", true);
    expect(number(editor, "x").literal.value).toBe(1);
    expect(arrowNumber(editor, number(editor, "x"), "Enter", false)).toBe(false);
    expect(editor.getState().history.past).toHaveLength(2);
  });

  test("a grip drag carries the value as far as the handle goes along its way", () => {
    const editor = editing();
    const grip = { at: { x: 100, y: 50 }, way: { x: 2, y: 0 }, from: 10, declared: false };
    const drag = following(editor, number(editor, "x"), grip, { x: 0, y: 0 }, 1);
    drag({ x: 20, y: 0 });
    drag({ x: 40, y: 30 });

    expect(number(editor, "x").literal.value).toBe(30);
    expect(editor.getState().history.past).toHaveLength(1);
  });

  test("bending an ease writes a bezier, and an arrow moves one control point", () => {
    const editor = editing();
    bending(editor, easeAt(editor, "curve"), 1)({ x: 0.4, y: 5 });
    expect(easeAt(editor, "curve").literal.value).toEqual(ease.bezier(0, 0, 0.4, 2.2));

    expect(arrowEase(editor, easeAt(editor, "curve"), 0, "ArrowRight", false)).toBe(true);
    expect(easeAt(editor, "curve").literal.value).toEqual(ease.bezier(0.05, 0, 0.4, 2.2));
  });

  test("a stroke's first write is an undo step and the rest continue it", () => {
    const editor = editing();
    const pick = stroke<"color">(editor, "fill");
    pick("#445566");
    pick("#778899");

    expect(editor.getState().text).toContain('"#778899"');
    expect(editor.getState().history.past).toHaveLength(1);
  });
});
