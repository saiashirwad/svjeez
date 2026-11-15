// Runs in the page the recorder opens, inside the app's own Vite build.
import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import type { Demo } from "./react.ts";

declare global {
  interface Window {
    __svjeez?: { props: (patch: Record<string, unknown>) => Promise<void> };
  }
}

export const mount = (demo: Demo, host: HTMLElement): void => {
  const root = createRoot(host);
  let props = demo.props as Record<string, unknown>;
  const draw = () => flushSync(() => root.render(createElement(demo.component as never, props)));

  draw();

  window.__svjeez = {
    props: async (patch) => {
      props = { ...props, ...patch };
      draw();
    },
  };

  host.dataset.ready = "";
};
