import type { Bag, Prop } from "./props.ts";

/**
 * The browser half of a framework adapter. A module in the page default-exports one of these; `boot` drives it.
 * `update` gets the full, merged props each time. Everything is optional-to-await: return a Promise if you need to.
 */
export interface BrowserAdapter<Component = never> {
  /** Renders `component` with `props` into `el` (empty, in the page), synchronously if the framework can. */
  mount(component: Component, props: Bag, el: HTMLElement): void | Promise<void>;
  /** Re-renders with new props, reusing the mounted instance. */
  update(props: Bag): void | Promise<void>;
  /** Tears the instance down. */
  unmount(): void;
  /**
   * Resolves when the framework has nothing pending (rendered, effects and commands run, subscriptions flushed).
   * `film` waits for it before every `snap` and after every `update`, then still waits for fonts, transitions and a
   * stable layout. Leave it out and only those run.
   */
  settled?(): Promise<void>;
  /**
   * A stable identity for `el` that the framework knows and the DOM does not (React's `key`), or undefined. `film` stamps it
   * as `data-svjeez-id` before each capture, and `pair` matches elements by it across states like a `data-key`, so a reordered
   * list slides instead of fading. Leave it out for a framework with no such notion.
   */
  identify?(el: Element): string | undefined;
}

/**
 * A UI framework `component()` can film. The node side is this small descriptor; the browser side is a module.
 * To add a framework, write both and pass the descriptor as `component(C, props, { framework })`
 * (or add it to the list `component` detects from). Film's core does not change.
 */
export interface Framework {
  readonly name: string;
  /** Is `component`, exported from `file`, one of yours? Called in order until one says yes. */
  detect(file: string, component: Prop): boolean;
  /** Absolute path of the browser module whose default export is a `BrowserAdapter`. It is bundled into the page. */
  readonly client: string;
}
