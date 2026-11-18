import type { Page } from "playwright-core";
import type { Curve } from "svjeez";

export type Json =
  | string
  | number
  | boolean
  | null
  | readonly Json[]
  | { readonly [key: string]: Json };

export type Patch = { readonly [prop: string]: Json };

export type Action =
  | { readonly click: string }
  | { readonly fill: readonly [target: string, text: string] }
  | { readonly hover: string }
  | { readonly press: string }
  | { readonly move: readonly [x: number, y: number] }
  | {
      readonly pointer: {
        readonly to?: string;
        readonly at?: readonly [x: number, y: number];
        readonly steps?: number;
        readonly button?: "down" | "up";
      };
    }
  | { readonly html: string }
  | { readonly props: Patch };

export interface Timing {
  readonly over?: number;
  readonly curve?: Curve;
}

export interface Snap extends Timing {
  readonly snap: string | true;
}

export interface Wait {
  readonly wait: number;
}

export type PageAction = (page: Page) => void;

export interface Act {
  readonly act: PageAction;
}

export type Instruction = Action | Snap | Wait | Act;

export type Flow = readonly Instruction[];

interface Draft {
  snap: string | true;
  over?: number;
  curve?: Curve;
}

const isTiming = (value: string | Timing | undefined): value is Timing => typeof value === "object";

export function snap(name?: string, timing?: Timing): Snap;
export function snap(timing: Timing): Snap;
export function snap(first?: string | Timing, second?: Timing): Snap {
  const [name, timing] = isTiming(first) ? [undefined, first] : [first, second];
  const out: Draft = { snap: name ?? true };

  if (timing?.over !== undefined) out.over = timing.over;

  if (timing?.curve) out.curve = timing.curve;

  return out;
}

export const wait = (seconds: number): Wait => ({ wait: seconds });
export const act = (fn: PageAction): Act => ({ act: fn });
export const html = (markup: string): Action => ({ html: markup });
export const fill = (target: string, text: string): Action => ({ fill: [target, text] });
export const click = (target: string): Action => ({ click: target });
export const hover = (target: string): Action => ({ hover: target });
export const press = (key: string): Action => ({ press: key });
export const move = (x: number, y: number): Action => ({ move: [x, y] });
export const props = (patch: Patch): Action => ({ props: patch });

export interface DragOptions {
  readonly grab?: readonly [x: number, y: number];
  readonly release?: readonly [x: number, y: number];
  readonly steps?: number;
  readonly lifted?: Snap | false;
  readonly carried?: Snap | false;
  readonly dropped?: Snap | false;
}

export const drag = (from: string, to: string, options: DragOptions = {}): Flow => {
  const {
    grab,
    release,
    steps = 10,
    lifted = false,
    carried = snap({ over: 0.6 }),
    dropped = snap({ over: 0.2 }),
  } = options;

  if (!(Number.isInteger(steps) && steps >= 1))
    throw new Error(`drag() needs a whole number of steps, 1 or more, got ${steps}.`);

  const point = (at: readonly [number, number] | undefined) => (at ? { at } : {});

  return [
    { pointer: { to: from, ...point(grab), button: "down" } },
    ...(lifted ? [lifted] : []),
    { pointer: { to, ...point(release), steps } },
    ...(carried ? [carried] : []),
    { pointer: { button: "up" } },
    ...(dropped ? [dropped] : []),
  ];
};
