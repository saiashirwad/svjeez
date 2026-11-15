// Runs in the page the recorder opens, inside the app's own Vite build.
import { cloneElement, type ReactElement } from "react";
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
  let element: ReactElement = demo.element;

  flushSync(() => root.render(element));

  window.__svjeez = {
    props: async (patch) => {
      element = cloneElement(element, patch);
      flushSync(() => root.render(element));
    },
  };

  host.dataset.ready = "";
};
