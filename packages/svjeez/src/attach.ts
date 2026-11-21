import { mount, type Mounted } from "./clocks";
import type { States } from "./model/ir";
import { rests, type StateValue, type View } from "./machine";

export interface AttachOptions {
  /** The state the scene shows: the first one with no animation, each later change animated. */
  readonly state?: StateValue;
  /** Where each state rests its clocks. Read once, with the first state; leave it out to use the states the scene declared. */
  readonly places?: States;
  /** Called once with the mounted scene. It may return a function that runs when the scene is destroyed. */
  readonly onMount?: (scene: Mounted) => void | (() => void);
}

export interface Attached {
  readonly scene: Mounted;
  /** Give it the options as they are now: it animates when `state` has changed, and does nothing when it has not. */
  update(options: AttachOptions): void;
  /** Run the `onMount` cleanup, stop any move and unmount. The element can be attached again. */
  destroy(): void;
}

const same = (a: StateValue | undefined, b: StateValue | undefined): boolean => {
  if (a === b) return true;

  if (!(a instanceof Object) || !(b instanceof Object)) return false;
  const keys = Object.keys(a);

  return keys.length === Object.keys(b).length && keys.every((key) => same(a[key], b[key]));
};

/**
 * Binds the scene inside `element` to a state your framework owns: the one binding every adapter wraps. It mounts
 * the SVG, shows the first `state` at once, and runs the clocks to the resting places of each state after it, as
 * `rests()` does. Its shape is a Svelte action, `{ update, destroy }`; React, Vue and Solid call `attach` when
 * the element appears, `update` when the state changes and `destroy` when it goes. The state can come from anywhere:
 * useState, a store, an XState actor's `value`.
 *
 * A decorative scene should be hidden from assistive technology by the element around it (`aria-hidden`): the
 * framework's own element carries the role, the keyboard and the label.
 */
export const attach = (element: Element, options: AttachOptions = {}): Attached => {
  const scene = mount(element);
  const cleanup = options.onMount?.(scene);
  let view: View | undefined;
  let last: StateValue | undefined;

  const update = ({ state, places }: AttachOptions) => {
    if (state === undefined) return;

    view ??= rests(scene, places ?? scene.states);

    if (view.state === undefined) view.show(state);
    else if (!same(state, last)) void view.go(state);

    last = state;
  };

  update(options);

  return {
    scene,
    update,
    destroy: () => {
      cleanup?.();
      view?.stop();
      scene.unmount();
    },
  };
};
