import type { Point } from "svjeez";
import { fit, follow } from "./fit.ts";
import { bend, bezierOf, nudge, scrub, type Settable, type ValueOf } from "./controls.ts";
import { handleAt, type Editor, type GripState } from "./editor.ts";

const ARROWS: ReadonlyMap<string, Point> = new Map([
  ["ArrowRight", { x: 1, y: 0 }],
  ["ArrowLeft", { x: -1, y: 0 }],
  ["ArrowUp", { x: 0, y: 1 }],
  ["ArrowDown", { x: 0, y: -1 }],
]);

export const stroke = <K extends keyof Settable>(editor: Editor, key: string) => {
  let going = false;

  return (value: Settable[K]) => {
    const was = editor.getState().text;
    // SAFETY: `K` is the kind of the value at `key`, so `value` is what a set of that key carries.
    editor.send({ type: "set", key, value, continues: going } as never);
    going ||= editor.getState().text !== was;
  };
};

export const scrubbing = (editor: Editor, value: ValueOf<"number">, x: number) => {
  const set = stroke<"number">(editor, value.key);
  const { param } = value;
  const from = value.literal.value;

  return (to: number, fine = false) => set(scrub(param, from, to - x, fine));
};

/**
 * A drag on a number's grip from page point `at`, where `scale` is scene units per page pixel. The value goes as far as
 * the handle does along the way it travels.
 */
export const following = (
  editor: Editor,
  value: ValueOf<"number">,
  grip: GripState,
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

export const bending = (editor: Editor, value: ValueOf<"ease">, which: 0 | 1) => {
  const set = stroke<"ease">(editor, value.key);
  const from = value.literal.value;

  return (to: Point) => set(bend(from, which, to.x, to.y));
};

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
 * Focus on a control selects its value; leaving deselects unless focus moves to another control of the same value.
 * Controls carry the value's key as `data-sj-key`.
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
