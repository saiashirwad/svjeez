import { props, type Action, type Flow, type Patch } from "./flow.ts";

export const PAD = 16;

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
  readonly width?: number;
  readonly pad?: number;
  readonly parts?: Readonly<Record<string, string>>;
}

export type DemoOptions<P> = Layout &
  ({} extends P ? { readonly props?: P } : { readonly props: P });

export interface Script<P> {
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
