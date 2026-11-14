import type { Page } from "playwright-core";
import type { Ease, Span } from "svjeez";

/** Something to do to the page as plain data, the way Playwright's codegen writes it. */
export type Action =
  | { readonly click: string }
  | { readonly fill: readonly [selector: string, text: string] }
  | { readonly hover: string }
  | { readonly press: string }
  | { readonly move: readonly [x: number, y: number] }
  /** New markup for a mounted card, as `card.render`. */
  | { readonly render: string };

/**
 * Read the page into a snapshot, named or `true`. `at` and `over` are when the timeline arrives at it from the
 * snapshot before, and `ease` how, as a `[snapshot, span, ease]` step says.
 */
export interface Snap {
  readonly snap: string | true;
  readonly at?: number;
  readonly over?: number;
  readonly ease?: Ease;
}

/** Anything Playwright can do. It isn't data, so a flow with one needs what it depends on in `snapshots()` inputs. */
export interface Act {
  readonly act: (page: Page) => unknown;
}

export type Instruction = Action | Snap | Act;

/** What `card.run` takes: an `async function*` that yields instructions, or a list of them as data. */
export type Flow = AsyncIterable<Instruction> | readonly Instruction[];

/** When the timeline arrives at a snapshot: a span, and an ease if not the `<Dom>`'s. */
export type Timing = Span & { readonly ease?: Ease };

/** Read the page here. A name lets `find` look the snapshot up; the timing is when the timeline arrives at it. */
export function snap(name?: string, timing?: Timing): Snap;
export function snap(timing: Timing): Snap;
export function snap(first?: string | Timing, second?: Timing): Snap {
  const name = typeof first === "object" ? undefined : first;
  const timing = typeof first === "object" ? first : second;

  return {
    snap: name ?? true,
    ...(timing && { at: timing.at, over: timing.over }),
    ...(timing?.ease && { ease: timing.ease }),
  };
}

export const act = (fn: Act["act"]): Act => ({ act: fn });
export const render = (html: string): Action => ({ render: html });
export const fill = (selector: string, text: string): Action => ({ fill: [selector, text] });
export const click = (selector: string): Action => ({ click: selector });
export const hover = (selector: string): Action => ({ hover: selector });
export const press = (key: string): Action => ({ press: key });
export const move = (x: number, y: number): Action => ({ move: [x, y] });
