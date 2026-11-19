import { createElement, type ComponentType } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import type { BrowserAdapter } from "../framework.ts";
import type { Bag } from "../props.ts";

let root: Root | undefined;
let current: ComponentType<Bag> | undefined;

const adapter: BrowserAdapter<ComponentType<Bag>> = {
  mount(component, props, el) {
    current = component;
    root = createRoot(el);
    this.update(props);
  },
  update(props) {
    flushSync(() => root!.render(createElement(current!, props)));
  },
  unmount() {
    root?.unmount();
  },
};

export default adapter;
