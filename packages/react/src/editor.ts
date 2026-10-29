import { createEditor, type Editor, type Effects, type Input, type State } from "@svjeez/live";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

/** A picture made at build time, as a `?svjeez` import gives it. */
export interface First {
  readonly src: string;
  readonly width: number;
  readonly height: number;
  readonly title: string;
}

export interface Options {
  /** Shown until the first compile finishes. */
  readonly first?: First;
  /** Swaps how the editor compiles and shows pictures, such as a test running without a worker. */
  readonly effects?: Partial<Effects>;
}

/**
 * An `@svjeez/live` editor read from React: `state` is always the editor's latest, and `useEditor` re-renders its
 * component on every change. The compile worker starts when `useEditor` first subscribes in an effect, so a server
 * render starts none.
 */
export class SceneEditor {
  readonly #store: Editor;

  constructor(text: string, { first, effects }: Options = {}) {
    this.#store = createEditor(
      {
        text,
        first: first && {
          url: first.src,
          scene: { width: first.width, height: first.height, duration: 0, title: first.title },
        },
      },
      effects,
    );
  }

  get state(): State {
    return this.#store.getState();
  }

  readonly send = (input: Input) => this.#store.send(input);

  readonly subscribe = (onChange: () => void) => this.#store.subscribe(() => onChange());

  /** Stops the compiler and frees every picture URL. `useEditor` calls it when the component goes away. */
  readonly destroy = () => this.#store.destroy();
}

/**
 * An editor for the scene source `text`, made once per component. Later `text` and `options` are ignored: send a
 * `replace` message to change the file.
 */
export const useEditor = (text: string, options?: Options): SceneEditor => {
  const [editor] = useState(() => new SceneEditor(text, options));
  const leaving = useRef<ReturnType<typeof setTimeout>>(undefined);

  // StrictMode and fast refresh run this cleanup and the effect again at once on the same editor, so the destroy waits
  // a tick and a remount cancels it.
  useEffect(() => {
    clearTimeout(leaving.current);

    return () => {
      leaving.current = setTimeout(editor.destroy);
    };
  }, [editor]);

  useSyncExternalStore(
    editor.subscribe,
    () => editor.state,
    () => editor.state,
  );

  return editor;
};
