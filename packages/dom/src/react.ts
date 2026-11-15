import type { ReactElement } from "react";
import type { Flow } from "./flow.ts";

// The flow's words, from here too: a demo file runs in the browser, so it imports nothing that pulls in Chromium.
export { click, fill, hover, move, press, props, snap, wait, type Flow } from "./flow.ts";

export interface DemoOptions {
  /** Width the component lays out at, in px. Without one it takes the width it wants. */
  readonly width?: number;
  /** Room around it for shadows and rings, in px. Default 16. */
  readonly pad?: number;
  /** Named elements, by CSS selector, besides those with a `data-part`. */
  readonly parts?: Readonly<Record<string, string>>;
}

/** A component and what happens to it, recorded by `recordings()` from `@svjeez/dom/vite`. */
export interface Demo {
  readonly kind: "svjeez-demo";
  readonly element: ReactElement;
  readonly options: DemoOptions;
  readonly flow: Flow;
}

/**
 * A demo of a real React component. Its flow is the one `dom.run` takes, plus `props()` to re-render the element with
 * new props. Export it from a `.demo.tsx` file next to the component; `recordings()` renders it through your Vite
 * config, so your CSS, fonts and imports are the app's own.
 */
export const demo = (element: ReactElement, options: DemoOptions, flow: Flow): Demo => ({
  kind: "svjeez-demo",
  element,
  options,
  flow,
});

export const isDemo = (value: unknown): value is Demo =>
  typeof value === "object" && value !== null && (value as Demo).kind === "svjeez-demo";
