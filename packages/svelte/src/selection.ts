import { selection } from "@svjeez/live";
import type { SceneEditor } from "./editor.js";

export const focusing = (editor: SceneEditor, key: () => string) => ({
  onfocusin: () => selection(editor, key()).focus(),
  onfocusout: (e: FocusEvent & { currentTarget: HTMLElement }) =>
    selection(editor, key()).blur(e.currentTarget, e.relatedTarget),
});
