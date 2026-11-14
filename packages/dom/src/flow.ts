import type { Page } from "playwright-core";
import type { Ease } from "svjeez";

/**
 * Something to do to the page as plain data, the way Playwright's codegen writes it. A target is a part name
 * (`data-part` or the `parts` option) or, failing that, a CSS selector.
 */
export type Action =
  | { readonly click: string }
  | { readonly fill: readonly [target: string, text: string] }
  | { readonly hover: string }
  | { readonly press: string }
  | { readonly move: readonly [x: number, y: number] }
  /** New markup for a mounted card, as `card.html`. Hover and focus don't carry over. */
  | { readonly html: string };

/** How the timeline arrives at a snapshot: it starts where the one before ended, plus any waits. */
export interface Timing {
  /** Seconds the move into this snapshot lasts. Default 0.6. */
  readonly over?: number;
  readonly ease?: Ease;
}

/** Read the page into a snapshot, named or `true`, and move the timeline to it. */
export interface Snap extends Timing {
  readonly snap: string | true;
}

/** Hold the picture this many seconds before the next move. */
export interface Wait {
  readonly wait: number;
}

/** Anything Playwright can do to the page. Whatever it resolves to is awaited and dropped. */
export type PageAction = (page: Page) => void;

/** A `PageAction` in a flow. It isn't data, so a flow with one needs what it depends on in `snapshots()` inputs. */
export interface Act {
  readonly act: PageAction;
}

export type Instruction = Action | Snap | Wait | Act;

/** What `card.run` takes: a list of instructions. A sub-flow is a function that returns one, spread in. */
export type Flow = readonly Instruction[];

/** A snap while `snap()` builds it. */
interface Draft {
  snap: string | true;
  over?: number;
  ease?: Ease;
}

const isTiming = (value: string | Timing | undefined): value is Timing => typeof value === "object";

/** Read the page here. A name lets `find` look the snapshot up; the timing is how the timeline moves to it. */
export function snap(name?: string, timing?: Timing): Snap;
export function snap(timing: Timing): Snap;
export function snap(first?: string | Timing, second?: Timing): Snap {
  const [name, timing] = isTiming(first) ? [undefined, first] : [first, second];
  // Keys for the timing given only: `card.run` reads a snap without any as untimed.
  const out: Draft = { snap: name ?? true };

  if (timing?.over !== undefined) out.over = timing.over;

  if (timing?.ease) out.ease = timing.ease;

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
