import type { Page } from "playwright-core";
import type { Ease } from "svjeez";

/** A value that can cross into the page as JSON. */
export type Json =
  | string
  | number
  | boolean
  | null
  | readonly Json[]
  | { readonly [key: string]: Json };

/** New props for a mounted component, by name. */
export type Patch = { readonly [prop: string]: Json };

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
  /**
   * The mouse: move it to a point in a target (`at` is a fraction of its box, the middle by default) over `steps`
   * moves, then press or release its button. `drag()` writes these.
   */
  | {
      readonly pointer: {
        readonly to?: string;
        readonly at?: readonly [x: number, y: number];
        readonly steps?: number;
        readonly button?: "down" | "up";
      };
    }
  /** New markup for a mounted card, as `card.html`. Hover and focus don't carry over. */
  | { readonly html: string }
  /**
   * Re-render the component with these props merged over the ones it has. The page must say how, through
   * `window.__svjeez.props`, as a demo from `@svjeez/dom/react` does. State inside the component (typed text, focus)
   * stays, as it would when a parent re-renders it.
   */
  | { readonly props: Patch };

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
export const props = (patch: Patch): Action => ({ props: patch });

export interface DragOptions {
  /** Where the pointer takes hold of `from`, as fractions of its box. Default `[0.5, 0.5]`, the middle. */
  readonly grab?: readonly [x: number, y: number];
  /** Where on `to` it lets go, as fractions of its box. Default `[0.5, 0.5]`. */
  readonly release?: readonly [x: number, y: number];
  /** Pointer moves on the way, each one a `pointermove` the page sees. Default 10. */
  readonly steps?: number;
  /** A snap after the button goes down, to show the lift. Default none. */
  readonly lifted?: Snap | false;
  /** A snap while it is held over `to`, to show the slide. Default `snap({ over: 0.6 })`. */
  readonly carried?: Snap | false;
  /** A snap after it lets go. Default `snap({ over: 0.2 })`. */
  readonly dropped?: Snap | false;
}

/**
 * Drags `from` onto `to` (part names or CSS selectors) with the real mouse: down on `from`, moves to `to` in
 * steps, up. Snaps in between show the lift and the slide. Spread it into a flow: `...drag("card", "done")`.
 *
 * ```ts
 * ...drag("card-42", "lane-done", { carried: snap("carried", { over: 0.6 }), dropped: snap("dropped") })
 * ```
 */
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
