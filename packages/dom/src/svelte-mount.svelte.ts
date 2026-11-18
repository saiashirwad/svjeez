import { flushSync, mount as render, type Component } from "svelte";
import { ready, type Demo } from "./demo.ts";

export const mount = (demo: Demo, host: HTMLElement): void => {
  const props = $state({ ...demo.props });
  // SAFETY: `demo()` from @svjeez/dom/svelte took a Svelte component, and only Svelte demos reach this mount.
  const component = demo.component as Component<Demo["props"]>;

  render(component, { target: host, props });
  flushSync();
  ready(host, (patch) => {
    Object.assign(props, patch);
    flushSync();
  });
};
