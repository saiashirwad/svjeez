import type { Seconds } from "./motion";

export interface Span {
  readonly at: Seconds;
  readonly over: Seconds;
}

export interface OpenSpan {
  readonly at: Seconds;
  readonly over?: undefined;
}

export interface When {
  readonly at: Seconds;
  readonly over?: Seconds;
}

export interface Spanned extends Span {
  readonly end: Seconds;
  shift(dt: Seconds): Spanned;
  /** The next span: `over` long, starting `gap` seconds after this one ends. */
  next(over: Seconds, gap?: Seconds): Spanned;
  /** Grow it `before` seconds earlier and `after` (default `before`) seconds later. Negative shrinks. */
  pad(before: Seconds, after?: Seconds): Spanned;
  /** From the same start to `end`, a time on the same clock: `a.until(b.end)` ends when `b` does. */
  until(end: Seconds): Spanned;
  /** The first `over` seconds: a span that starts with this one. `over` may run past its end. */
  first(over: Seconds): Spanned;
  /** The last `over` seconds: a span that ends with this one. */
  last(over: Seconds): Spanned;
}

export interface OpenSpanned extends OpenSpan {
  readonly end: number;
  shift(dt: Seconds): OpenSpanned;
  /** Start `before` seconds earlier. Negative starts later. */
  pad(before: Seconds): OpenSpanned;
  /** From the same start to `end`: `span(a).until(b)` is the span from `a` to `b`. */
  until(end: Seconds): Spanned;
  first(over: Seconds): Spanned;
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

  until(end: Seconds): Range {
    finite(end, "until()");

    return build(this.at, end - this.at, "until()");
  }

  first(over: Seconds): Range {
    return build(this.at, over, "first()");
  }

  last(over: Seconds): Range {
    finite(over, "last()");

    return build(this.end - over, over, "last()");
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

  until(end: Seconds): Range {
    finite(end, "until()");

    return build(this.at, end - this.at, "until()");
  }

  first(over: Seconds): Range {
    return build(this.at, over, "first()");
  }
}

function build(at: Seconds, over: Seconds, what: string): Range;
function build(at: Seconds, over: undefined, what: string): Tail;
function build(at: Seconds, over: Seconds | undefined, what: string): Range | Tail {
  if (over === undefined) {
    checkWindow(at, 1, what);

    return new Tail(at);
  }

  checkWindow(at, over, what, true);

  return new Range(at, over);
}

/**
 * The one rule for an `at` and an `over`: `at` is finite and 0 or later, `over` is finite and positive. Whatever
 * plays in the window (a recipe, `sampled`, `show`, `<Clip>`) needs time to play in, so `over: 0` throws. `span()`
 * alone passes `empty`, since a zero-length span is a point on the clock that `.next` and `.pad` can start from.
 */
export const checkWindow = (at: Seconds, over: Seconds, what: string, empty = false): void => {
  if (!Number.isFinite(at) || at < 0)
    throw new Error(`${what} needs a start of 0 or later, got ${at}.`);

  if (!Number.isFinite(over) || (empty ? over < 0 : over <= 0))
    throw new Error(
      empty
        ? `${what} needs a length of 0 or more, got ${over}.`
        : `${what} needs a positive over, got ${over}.`,
    );
};

/**
 * A span of a clock, `over` seconds long from `at`. Without `over` it runs to the end. Spans chain:
 * `span(0, 0.7).next(1, 0.2)` starts a gap after the first ends, `.pad(0.15)` grows one on both sides, and
 * `span(2).until(3.5)` runs from a start to an end.
 */
export function span(at: Seconds, over: Seconds): Spanned;
export function span(at: Seconds): OpenSpanned;
export function span(at: Seconds, over?: Seconds): Spanned | OpenSpanned {
  return over === undefined ? build(at, undefined, "span()") : build(at, over, "span()");
}

/**
 * Spans end to end: `first`, then one span for each length in `overs`, each starting when the one before ends. The
 * steps of a motion that play one after another: `const [crouch, leap, land] = chain(span(0.1, 0.3), 0.12, 0.25)`.
 * A pause between two is `.next(over, gap)` on the one before.
 */
export function chain<const O extends readonly Seconds[]>(
  first: Span,
  ...overs: O
): [Spanned, ...{ -readonly [K in keyof O]: Spanned }] {
  const out: Spanned[] = [build(first.at, first.over, "chain()")];

  for (const over of overs) out.push(out[out.length - 1]!.next(over));

  // SAFETY: out holds first and one span per entry of overs, in order, which is the tuple the signature names.
  return out as [Spanned, ...{ -readonly [K in keyof O]: Spanned }];
}

/**
 * `count` spans as long as `first`, each starting `step` seconds after the one before: a cascade of entrances. The
 * last one's `end` is when the cascade settles.
 */
export const stagger = (first: Span, count: number, step: Seconds): Spanned[] => {
  if (!Number.isInteger(count) || count < 0 || !Number.isFinite(step))
    throw new Error(
      `stagger() needs a whole count of 0 or more and a finite step, got count ${count} and step ${step}.`,
    );

  return Array.from({ length: count }, (_, i) =>
    build(first.at + i * step, first.over, "stagger()"),
  );
};
