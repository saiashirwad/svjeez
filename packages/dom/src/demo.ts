import { props, type Action, type Flow, type Patch } from "./flow.ts";

/** Room around a demo for shadows and rings, in px, when its layout gives none. */
export const PAD = 16;

// The flow's words, from here too: a demo file runs in the browser, so it imports nothing that pulls in Chromium.
// `props` isn't among them: a demo's script gets one typed to its component. Nor is `html`, which replaces a mounted
// card's markup and would throw the component away.
export {
  act,
  click,
  drag,
  fill,
  hover,
  move,
  press,
  snap,
  wait,
  type Act,
  type Action,
  type DragOptions,
  type Flow,
  type Instruction,
  type PageAction,
  type Snap,
  type Timing,
  type Wait,
} from "./flow.ts";

export interface Layout {
  /** Width the component lays out at, in px. Without one it takes the width it wants. */
  readonly width?: number;
  /** Room around it for shadows and rings, in px. Default 16. */
  readonly pad?: number;
  /** Named elements, by CSS selector, besides those with a `data-part`. */
  readonly parts?: Readonly<Record<string, string>>;
}

/** Where the demo starts: the component's props, required when the component has required ones. */
export type DemoOptions<P> = Layout &
  ({} extends P ? { readonly props?: P } : { readonly props: P });

/** What a demo's script gets: `props`, typed to the component, re-renders it with a patch merged over its props. */
export interface Script<P> {
  /** Re-render with these props merged over the current ones, as a parent would. Values must be JSON. */
  readonly props: (patch: Partial<P>) => Action;
}

export type Framework = "react" | "svelte";

/** A component and what happens to it, recorded by `recordings()` from `@svjeez/dom/vite`. */
export interface Demo<P = Patch> {
  readonly kind: "svjeez-demo";
  readonly framework: Framework;
  readonly component: Function;
  readonly props: P;
  readonly layout: Layout;
  readonly flow: Flow;
}

export const demoOf = <P>(
  framework: Framework,
  component: Function,
  { props: initial, ...layout }: DemoOptions<P>,
  script: (tools: Script<P>) => Flow,
): Demo<P> => ({
  kind: "svjeez-demo",
  framework,
  component,
  // SAFETY: `props` is optional only when P has no required props, so an empty object is a P.
  props: (initial ?? {}) as P,
  layout,
  // SAFETY: a patch is a few of the component's props, and they must be JSON to cross into the page, as Script says.
  flow: script({ props: (patch) => props(patch as Patch) }),
});

/**
 * What a mount tells the recorder: `update` applies a patch to the props, and the host is ready to be read. Both
 * framework mounts end with this call.
 */
export const ready = (element: HTMLElement, update: (patch: Patch) => void): void => {
  window.__svjeez = {
    props: async (patch) => {
      update(patch);
    },
  };

  element.dataset.ready = "";
};

export const isDemo = (value: unknown): value is Demo =>
  typeof value === "object" && value !== null && "kind" in value && value.kind === "svjeez-demo";

declare global {
  interface Window {
    /** How the recorder re-renders the mounted demo with new props. */
    __svjeez?: { props: (patch: Patch) => Promise<void> };
  }
}
