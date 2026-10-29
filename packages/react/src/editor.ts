import { createEditor, type Editor, type Effects, type First, type State } from "@svjeez/live";
import { useState, useSyncExternalStore } from "react";

export interface Options {
  /** Shown until the first compile finishes: a `?svjeez` import, with a `duration` if the page knows it. */
  readonly first?: First;
  /** Swaps how the editor compiles and shows pictures, such as a test running without a worker. */
  readonly effects?: Partial<Effects>;
}

/**
 * An `@svjeez/live` editor for the scene source `text`, made once per component; later `text` and `options` are
 * ignored, so send a `replace` message to change the file. Components read it through `useEditorState`. The editor
 * pauses, its worker stopped, whenever no component reads it, as under a hidden `<Activity>` or after an unmount, and
 * picks up again when one does. Call `destroy` to free its last picture for good.
 */
export const useEditor = (text: string, options: Options = {}): Editor => {
  const [editor] = useState(() => createEditor({ text, first: options.first }, options.effects));

  return editor;
};

/**
 * The editor's state, or the part `select` picks, re-rendering the component when it changes. `select` must return a
 * part of the state or a primitive, never a new object, or the component re-renders forever.
 */
export function useEditorState(editor: Editor): State;
export function useEditorState<T>(editor: Editor, select: (state: State) => T): T;
export function useEditorState<T>(editor: Editor, select?: (state: State) => T): State | T {
  const read = () => (select ? select(editor.getState()) : editor.getState());

  return useSyncExternalStore(editor.subscribe, read, read);
}
