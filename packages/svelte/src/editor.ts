import { createEditor, type Editor, type EditorOptions, type Input, type State } from "@svjeez/live";
import { createSubscriber } from "svelte/reactivity";

/**
 * An `@svjeez/live` editor whose state is reactive: read `state` in a template or an effect and it updates on every
 * change. The compile worker starts when `state` is first read in an effect, so a server render starts none, and the
 * editor pauses whenever no effect reads it.
 */
export class SceneEditor implements Editor {
  readonly #store: Editor;
  readonly #subscribe: () => void;

  constructor(text: string, { first, effects }: EditorOptions = {}) {
    this.#store = createEditor({ text, first }, effects);
    this.#subscribe = createSubscriber((update) => this.#store.subscribe(() => update()));
  }

  get state(): State {
    this.#subscribe();

    return this.#store.getState();
  }

  readonly getState = () => this.#store.getState();

  readonly subscribe = (listener: (state: State) => void) => this.#store.subscribe(listener);

  readonly send = (input: Input) => this.#store.send(input);

  /** Stops the compiler and frees every picture URL. Call it when the page that made the editor goes away. */
  readonly destroy = () => this.#store.destroy();
}
