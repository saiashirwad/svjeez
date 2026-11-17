import { props, type Action, type Flow, type Patch } from "./flow.ts";

export const PAD = 16;

// A demo file runs in the browser: import nothing that pulls in Chromium.
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
  readonly parts?: Readonly<Record<string, string>>;
}

/** Where the demo starts: the component's props, required when the component has required ones. */
export type DemoOptions<P> = Layout &
  ({} extends P ? { readonly props?: P } : { readonly props: P });

export interface Script<P> {
  /** Re-render with these props merged over the current ones, as a parent would. Values must be JSON. */
  readonly props: (patch: Partial<P>) => Action;
}

export type Framework = "react" | "svelte";

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
    __svjeez?: { props: (patch: Patch) => Promise<void> };
  }
}
