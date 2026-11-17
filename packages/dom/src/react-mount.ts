import { createElement, type ComponentType } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { ready, type Demo } from "./demo.ts";

export const mount = (demo: Demo, host: HTMLElement): void => {
  const root = createRoot(host);
  let props = demo.props;
  // SAFETY: `demo()` from @svjeez/dom/react took a ComponentType, and only React demos reach this mount.
  const component = demo.component as ComponentType<Demo["props"]>;
  const draw = () => flushSync(() => root.render(createElement(component, props)));

  draw();
  ready(host, (patch) => {
    props = { ...props, ...patch };
    draw();
  });
};
