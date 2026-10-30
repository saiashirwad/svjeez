import { describe, expect, test } from "bun:test";
import { ease } from "svjeez";
import { arrowEase, arrowNumber, bending, following, scrubbing, stroke } from "../../src/gestures";
import { easeAt, editing, number } from "../helpers/live-gestures";

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

  test("a drag whose first move changes nothing is still an undo step of its own", () => {
    const editor = editing();
    stroke<"color">(editor, "fill")("#445566");
    const drag = stroke<"number">(editor, "x");
    drag(10);
    drag(15);
    editor.send({ type: "undo" });

    expect(number(editor, "x").literal.value).toBe(10);
    expect(editor.getState().text).toContain('"#445566"');
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
