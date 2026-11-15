// Runs in the page the recorder opens, inside the app's own Vite build.
import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { host as ready, type Demo } from "./demo.ts";

export const mount = (demo: Demo, host: HTMLElement): void => {
  const root = createRoot(host);
  let props = demo.props as Record<string, unknown>;
  const draw = () => flushSync(() => root.render(createElement(demo.component as never, props)));

  draw();
  ready(host, (patch) => {
    props = { ...props, ...patch };
    draw();
  });
};
