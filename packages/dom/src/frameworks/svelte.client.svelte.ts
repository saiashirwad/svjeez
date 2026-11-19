import { flushSync, mount, tick, unmount, type Component } from "svelte";
import type { BrowserAdapter } from "../framework.ts";
import type { Bag } from "../props.ts";

// A $state proxy as the props object is what lets `update` re-render without remounting.
let props: Bag = $state({});
let instance: Bag | undefined;

const adapter: BrowserAdapter<Component<Bag>> = {
  mount(component, initial, el) {
    props = initial;
    instance = mount(component, { target: el, props });
    flushSync();
  },
  update(next) {
    for (const key of Object.keys(props)) if (!(key in next)) delete props[key];

    Object.assign(props, next);
    flushSync();
  },
  unmount() {
    if (instance) void unmount(instance);
  },
  settled: () => tick(),
};

export default adapter;
