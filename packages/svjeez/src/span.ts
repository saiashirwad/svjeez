import type { Seconds } from "./motion";

/** A stretch of a clock: from `at`, for `over` seconds. A plain `{ at, over }` is a span. */
export interface Span {
  readonly at: Seconds;
  readonly over: Seconds;
}

/** A span that runs to the end of its clock: `over` is left out. */
export interface OpenSpan {
  readonly at: Seconds;
  readonly over?: undefined;
}

/** Anything `show()` and `<Clip>` take for "when": a span, or a start that runs to the end. */
export interface When {
  readonly at: Seconds;
  readonly over?: Seconds;
}

/** A span with the helpers `span()` adds. */
export interface Spanned extends Span {
  /** When it ends: `at + over`. */
  readonly end: Seconds;
  /** The same span `dt` seconds later. */
  shift(dt: Seconds): Spanned;
  /** The next span: `over` long, starting `gap` seconds after this one ends. */
  next(over: Seconds, gap?: Seconds): Spanned;
  /** Grow it `before` seconds earlier and `after` (default `before`) seconds later. Negative shrinks. */
  pad(before: Seconds, after?: Seconds): Spanned;
}

/** A span from `at` to the end of its clock. */
export interface OpenSpanned extends OpenSpan {
  /** Always `Infinity`: nothing ends it. */
  readonly end: number;
  shift(dt: Seconds): OpenSpanned;
  /** Start `before` seconds earlier. Negative starts later. */
  pad(before: Seconds): OpenSpanned;
}

const finite = (value: number, what: string): void => {
  if (!Number.isFinite(value))
    throw new Error(`${what} needs a finite number of seconds, got ${value}.`);
};

class Range implements Span {
  constructor(
    readonly at: Seconds,
    readonly over: Seconds,
  ) {}

  get end(): Seconds {
    return this.at + this.over;
  }

  shift(dt: Seconds): Range {
    finite(dt, "shift()");

    return build(this.at + dt, this.over, "shift()");
  }

  next(over: Seconds, gap: Seconds = 0): Range {
    finite(gap, "next()");

    return build(this.end + gap, over, "next()");
  }

  pad(before: Seconds, after: Seconds = before): Range {
    finite(before, "pad()");
    finite(after, "pad()");

    return build(this.at - before, this.over + before + after, "pad()");
  }
}

class Tail implements OpenSpan {
  readonly over = undefined;
  readonly end = Infinity;

  constructor(readonly at: Seconds) {}

  shift(dt: Seconds): Tail {
    finite(dt, "shift()");

    return build(this.at + dt, undefined, "shift()");
  }

  pad(before: Seconds): Tail {
    finite(before, "pad()");

    return build(this.at - before, undefined, "pad()");
  }
}

function build(at: Seconds, over: Seconds, what: string): Range;
function build(at: Seconds, over: undefined, what: string): Tail;
function build(at: Seconds, over: Seconds | undefined, what: string): Range | Tail {
  if (!Number.isFinite(at) || at < 0)
    throw new Error(`${what} needs a start of 0 or later, got ${at}.`);

  if (over === undefined) return new Tail(at);

  if (!Number.isFinite(over) || over < 0)
    throw new Error(`${what} needs a length of 0 or more, got ${over}.`);

  return new Range(at, over);
}

/**
 * A span of a clock, `over` seconds long from `at`. Without `over` it runs to the end. Spans chain:
 * `span(0, 0.7).next(1, 0.2)` starts a gap after the first ends, and `.pad(0.15)` grows one on both sides.
 */
export function span(at: Seconds, over: Seconds): Spanned;
export function span(at: Seconds): OpenSpanned;
export function span(at: Seconds, over?: Seconds): Spanned | OpenSpanned {
  return over === undefined ? build(at, undefined, "span()") : build(at, over, "span()");
}

/** Where a sampled motion plays: `over` seconds from `at` (default 0). The function it samples is given time from 0 to `over`. */
export type SampleWindow =
  | { readonly at?: Seconds; readonly over: Seconds; readonly duration?: never }
  | {
      /** @deprecated use `over` */
      readonly duration: Seconds;
      readonly at?: never;
      readonly over?: never;
    };

/** The `at` and `over` of a sampled window, from `over` or the old `duration`. */
export const sampleWindow = (options: SampleWindow, what: string): Span => {
  const over = options.over ?? options.duration;
  const at = options.at ?? 0;

  if (over === undefined || !Number.isFinite(over) || over <= 0)
    throw new Error(`${what} needs a positive over, got ${over}.`);

  if (!Number.isFinite(at) || at < 0)
    throw new Error(`${what} needs an at of 0 or later, got ${at}.`);

  return { at, over };
};
