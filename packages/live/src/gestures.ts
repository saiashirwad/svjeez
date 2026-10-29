// What a control does with a pointer, a key or focus, with the DOM events already read: each gesture sends the editor
// `set` messages that make it one undo step, and focus selects a value. Every framework's controls wire events to these.
import type { Point } from "svjeez";
import { fit, follow } from "svjeez/params";
import { bend, bezierOf, nudge, scrub, type Settable, type ValueOf } from "./controls.ts";
import { handleAt, type Editor, type Grip } from "./editor.ts";

/** Where each arrow key points, up and right being positive. */
const ARROWS: ReadonlyMap<string, Point> = new Map([
  ["ArrowRight", { x: 1, y: 0 }],
  ["ArrowLeft", { x: -1, y: 0 }],
  ["ArrowUp", { x: 0, y: 1 }],
  ["ArrowDown", { x: 0, y: -1 }],
]);

/** One gesture's writes to the value at `key`: the first is an undo step, and every later one continues it. */
export const stroke = <K extends keyof Settable>(editor: Editor, key: string) => {
  let going = false;

  return (value: Settable[K]) => {
    const was = editor.getState().text;
    // SAFETY: `K` is the kind of the value at `key`, so `value` is what a set of that key carries.
    editor.send({ type: "set", key, value, continues: going } as never);
    // A write that changed nothing is in no undo step, so the next one must start the step.
    going ||= editor.getState().text !== was;
  };
};

/** A sideways drag on a number's text from page x `x`. It keeps the range it began with, which the value would widen. */
export const scrubbing = (editor: Editor, value: ValueOf<"number">, x: number) => {
  const set = stroke<"number">(editor, value.key);
  const { param } = value;
  const from = value.literal.value;

  /** The pointer at page x `to`; `fine` goes a fifth as far. */
  return (to: number, fine = false) => set(scrub(param, from, to - x, fine));
};

/**
 * A drag on a number's grip from page point `at`, where `scale` is scene units per page pixel. The value goes as far as
 * the handle does along the way it travels.
 */
export const following = (
  editor: Editor,
  value: ValueOf<"number">,
  grip: Grip,
  at: Point,
  scale: number,
) => {
  const set = stroke<"number">(editor, value.key);
  const { param } = value;
  let raw = value.literal.value;
  let last = at;

  return (to: Point) => {
    const by = { x: (to.x - last.x) * scale, y: (to.y - last.y) * scale };
    last = to;
    raw = follow(param, (v) => handleAt(grip, v), raw, by);
    set(fit(param, raw));
  };
};

/** A drag on one of an ease's control points, to points in the curve's unit square. */
export const bending = (editor: Editor, value: ValueOf<"ease">, which: 0 | 1) => {
  const set = stroke<"ease">(editor, value.key);
  const from = value.literal.value;

  return (to: Point) => set(bend(from, which, to.x, to.y));
};

/** Steps a number for an arrow key, ten steps with `big`, as an undo step of its own. Whether `key` was an arrow. */
export const arrowNumber = (
  editor: Editor,
  value: ValueOf<"number">,
  key: string,
  big: boolean,
) => {
  const way = ARROWS.get(key);

  if (way)
    stroke<"number">(
      editor,
      value.key,
    )(nudge(value.param, value.literal.value, way.x + way.y > 0 ? 1 : -1, big));

  return !!way;
};

/** Moves an ease's control point for an arrow key, further with `big`, as an undo step of its own. Whether it was one. */
export const arrowEase = (
  editor: Editor,
  value: ValueOf<"ease">,
  which: 0 | 1,
  key: string,
  big: boolean,
) => {
  const way = ARROWS.get(key);

  if (way) {
    const p = bezierOf(value.literal.value);
    const by = big ? 0.25 : 0.05;
    const to = { x: p[which * 2]! + way.x * by, y: p[which * 2 + 1]! + way.y * by };
    bending(editor, value, which)(to);
  }

  return !!way;
};

/**
 * Focus on a value's control selects it, and focus leaving deselects it unless it moves inside the control or to
 * another control of the same value: a number and its grip on the picture hand focus to each other without
 * deselecting, which would drop the grip that was just measured. Controls carry their value's key as `data-sj-key`.
 */
export const selection = (editor: Editor, key: string) => ({
  focus: () => editor.send({ type: "select", key }),
  blur: (from: Element, to: EventTarget | null) => {
    if (to instanceof Element) {
      if (from.contains(to)) return;

      if (to.closest("[data-sj-key]")?.getAttribute("data-sj-key") === key) return;
    }

    if (editor.getState().selected === key) editor.send({ type: "select", key: null });
  },
});
