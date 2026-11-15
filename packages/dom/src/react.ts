import type { ComponentType } from "react";
import { props as setProps, type Action, type Flow } from "./flow.ts";

// The flow's words, from here too: a demo file runs in the browser, so it imports nothing that pulls in Chromium.
// `props` isn't among them: a demo's script gets one typed to its component.
export { click, fill, hover, move, press, snap, wait, type Flow } from "./flow.ts";

interface Layout {
  /** Width the component lays out at, in px. Without one it takes the width it wants. */
  readonly width?: number;
  /** Room around it for shadows and rings, in px. Default 16. */
  readonly pad?: number;
  /** Named elements, by CSS selector, besides those with a `data-part`. */
  readonly parts?: Readonly<Record<string, string>>;
}

/** Where the demo starts: the component's props, required when the component has required ones. */
export type DemoOptions<P> = Layout & ({} extends P ? { readonly props?: P } : { readonly props: P });

/** What a demo's script gets: `props`, typed to the component, re-renders it with a patch merged over its props. */
export interface Script<P> {
  /** Re-render with these props merged over the current ones, as a parent would. Values must be JSON. */
  readonly props: (patch: Partial<P>) => Action;
}

/** A component and what happens to it, recorded by `recordings()` from `@svjeez/dom/vite`. */
export interface Demo<P = unknown> {
  readonly kind: "svjeez-demo";
  readonly component: ComponentType<P>;
  readonly props: P;
  readonly layout: Layout;
  readonly flow: Flow;
}

/**
 * A demo of a real React component: the component, where it starts, and a script of what happens to it. The script
 * is the flow `dom.run` takes; `props` from its argument re-renders the component with new props and is typed to it.
 * Export it from a `.demo.tsx` file next to the component; `recordings()` renders it through your Vite config, so
 * your CSS, fonts and imports are the app's own.
 *
 * ```tsx
 * export const signIn = demo(SignIn, { width: 360 }, ({ props }) => [
 *   snap("idle"),
 *   fill("email", "sai@example.com"), snap({ over: 1 }),
 *   props({ error: "Unable to sign in." }), snap({ over: 0.25 }),
 * ]);
 * ```
 */
export const demo = <P extends object>(
  component: ComponentType<P>,
  { props, ...layout }: DemoOptions<P>,
  script: (tools: Script<P>) => Flow,
): Demo<P> => ({
  kind: "svjeez-demo",
  component,
  props: (props ?? {}) as P,
  layout,
  flow: script({ props: (patch) => setProps(patch) }),
});

export const isDemo = (value: unknown): value is Demo =>
  typeof value === "object" && value !== null && (value as Demo).kind === "svjeez-demo";
