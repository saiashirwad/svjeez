import type { SceneEditor } from "./editor.js";

/**
 * Focus handlers that select the value with `key` while focus is on the element or inside it, or on another control of
 * the same value: a number and its grip on the picture hand focus to each other without deselecting, because
 * deselecting drops the grip that was just measured.
 */
export const selection = (editor: SceneEditor, key: () => string) => ({
  onfocusin: () => editor.send({ type: "select", key: key() }),
  onfocusout: (e: FocusEvent & { currentTarget: HTMLElement }) => {
    const next = e.relatedTarget;

    if (next instanceof Element) {
      if (e.currentTarget.contains(next)) return;

      if (next.closest("[data-sj-key]")?.getAttribute("data-sj-key") === key()) return;
    }

    if (editor.state.selected === key()) editor.send({ type: "select", key: null });
  },
});
