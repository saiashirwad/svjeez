import type { FocusEvent } from "react";
import type { SceneEditor } from "./editor.ts";

/**
 * Focus handlers that select the value with `key` while focus is on the element or inside it, or on another control of
 * the same value: a number and its grip on the picture hand focus to each other without deselecting, because
 * deselecting drops the grip that was just measured.
 */
export const selection = (editor: SceneEditor, key: string) => ({
  onFocus: () => editor.send({ type: "select", key }),
  onBlur: (e: FocusEvent<HTMLElement>) => {
    const next = e.relatedTarget;

    if (next instanceof Element) {
      if (e.currentTarget.contains(next)) return;

      if (next.closest("[data-sj-key]")?.getAttribute("data-sj-key") === key) return;
    }

    if (editor.state.selected === key) editor.send({ type: "select", key: null });
  },
});

/** The arrow keys a slider answers to, and which way each carries its value. */
export const ARROWS: ReadonlyMap<string, 1 | -1> = new Map([
  ["ArrowRight", 1],
  ["ArrowUp", 1],
  ["ArrowLeft", -1],
  ["ArrowDown", -1],
]);
