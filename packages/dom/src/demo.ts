import { props as setProps, type Action, type Flow } from "./flow.ts";

// The flow's words, from here too: a demo file runs in the browser, so it imports nothing that pulls in Chromium.
// `props` isn't among them: a demo's script gets one typed to its component.
export { click, fill, hover, move, press, snap, wait, type Flow } from "./flow.ts";

export interface Layout {
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

export type Framework = "react" | "svelte";

/** A component and what happens to it, recorded by `recordings()` from `@svjeez/dom/vite`. */
export interface Demo<P = unknown> {
  readonly kind: "svjeez-demo";
  readonly framework: Framework;
  readonly component: unknown;
  readonly props: P;
  readonly layout: Layout;
  readonly flow: Flow;
}

export const demoOf = <P>(
  framework: Framework,
  component: unknown,
  { props, ...layout }: DemoOptions<P>,
  script: (tools: Script<P>) => Flow,
): Demo<P> => ({
  kind: "svjeez-demo",
  framework,
  component,
  props: (props ?? {}) as P,
  layout,
  flow: script({ props: (patch) => setProps(patch) }),
});

export const isDemo = (value: unknown): value is Demo =>
  typeof value === "object" && value !== null && (value as Demo).kind === "svjeez-demo";

declare global {
  interface Window {
    /** How the recorder re-renders the mounted demo with new props. */
    __svjeez?: { props: (patch: Record<string, unknown>) => Promise<void> };
  }
}
