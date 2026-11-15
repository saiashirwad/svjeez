// Runs in the page the recorder opens, inside the app's own Vite build, compiled by its Svelte plugin.
import { flushSync, mount as render, type Component } from "svelte";
import type { Demo } from "./demo.ts";

export const mount = (demo: Demo, host: HTMLElement): void => {
  // Reactive props: a patch assigned into them updates the component in place, as a parent's would.
  const props = $state({ ...(demo.props as Record<string, unknown>) });

  render(demo.component as Component<Record<string, unknown>>, { target: host, props });
  flushSync();

  window.__svjeez = {
    props: async (patch) => {
      Object.assign(props, patch);
      flushSync();
    },
  };

  host.dataset.ready = "";
};
