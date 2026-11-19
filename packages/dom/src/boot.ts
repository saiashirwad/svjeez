import type { BrowserAdapter } from "./framework.ts";
import type { Bag } from "./props.ts";

/** What `component()` sends to the page: JSON data props, and the names of props that are functions. */
export interface BootProps {
  readonly data: Bag;
  readonly fns: readonly string[];
}

declare global {
  interface Window {
    /** Set once a component target has mounted; `film` drives `update` and reads `settled` from it. */
    __svjeez?: { update(props: BootProps): Promise<void>; settled?(): Promise<void> };
  }
}

const standIns = (fns: readonly string[]): Bag =>
  Object.fromEntries(fns.map((name) => [name, () => {}]));

/** Runs in the generated page: mounts `component` into a fresh `#svjeez-root` and exposes `window.__svjeez`. */
export const boot = async <Component>(
  adapter: BrowserAdapter<Component>,
  component: Component,
  { data, fns }: BootProps,
): Promise<void> => {
  const el = document.createElement("div");

  el.id = "svjeez-root";
  document.body.append(el);

  let props: Bag = { ...data, ...standIns(fns) };

  await adapter.mount(component, props, el);

  window.__svjeez = {
    update: async (next) => {
      props = { ...props, ...next.data, ...standIns(next.fns) };
      await adapter.update(props);
    },
    ...(adapter.settled && { settled: () => adapter.settled!() }),
  };
};
