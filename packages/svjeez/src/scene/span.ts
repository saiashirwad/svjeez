import type { Seconds } from "../motion";

/**
 * Time on a clock. A span is a stretch of it, `over` seconds long from `start`; `end` is where it stops. `at` is
 * never a time in a scene: it is where a node sits.
 */
export interface Span {
  readonly start: Seconds;
  readonly over: Seconds;
}

/** A span with no end: it runs to the end of its clock. */
export interface OpenSpan {
  readonly start: Seconds;
  readonly over?: undefined;
}

/** A span, or one that runs to the end of its clock. */
export interface When {
  readonly start: Seconds;
  readonly over?: Seconds;
}

/** What `span()` makes: a span with the ways to make others from it. */
export interface Spanned extends Span {
  readonly end: Seconds;
  /** The same span, `dt` seconds later. */
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
  /**
   * This span, then one for each length in `overs`, each starting when the one before ends: the steps of a motion
   * that play one after another. `const [crouch, leap, land] = span(0.1, 0.3).chain(0.12, 0.25)`.
   */
  chain<const O extends readonly Seconds[]>(
    ...overs: O
  ): [Spanned, ...{ -readonly [K in keyof O]: Spanned }];
  /**
   * `count` spans as long as this one, each starting `step` seconds after the one before: a cascade of entrances.
   * The last one's `end` is when the cascade settles.
   */
  cascade(count: number, step: Seconds): Spanned[];
}

/** What `span(start)` makes: a span that runs to the end of its clock. */
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

class Range implements Spanned {
  constructor(
    readonly start: Seconds,
    readonly over: Seconds,
  ) {}

  get end(): Seconds {
    return this.start + this.over;
  }

  shift(dt: Seconds): Range {
    finite(dt, "shift()");

    return build(this.start + dt, this.over, "shift()");
  }

  next(over: Seconds, gap: Seconds = 0): Range {
    finite(gap, "next()");

    return build(this.end + gap, over, "next()");
  }

  pad(before: Seconds, after: Seconds = before): Range {
    finite(before, "pad()");
    finite(after, "pad()");

    return build(this.start - before, this.over + before + after, "pad()");
  }

  until(end: Seconds): Range {
    finite(end, "until()");

    return build(this.start, end - this.start, "until()");
  }

  first(over: Seconds): Range {
    return build(this.start, over, "first()");
  }

  last(over: Seconds): Range {
    finite(over, "last()");

    return build(this.end - over, over, "last()");
  }

  chain<const O extends readonly Seconds[]>(
    ...overs: O
  ): [Spanned, ...{ -readonly [K in keyof O]: Spanned }] {
    const out: Spanned[] = [this];

    for (const over of overs) out.push(out[out.length - 1]!.next(over));

    // SAFETY: out holds this span and one per entry of overs, in order, which is the tuple the signature names.
    return out as [Spanned, ...{ -readonly [K in keyof O]: Spanned }];
  }

  cascade(count: number, step: Seconds): Range[] {
    if (!Number.isInteger(count) || count < 0 || !Number.isFinite(step))
      throw new Error(
        `cascade() needs a whole count of 0 or more and a finite step, got count ${count} and step ${step}.`,
      );

    return Array.from({ length: count }, (_, i) =>
      build(this.start + i * step, this.over, "cascade()"),
    );
  }
}

class Tail implements OpenSpanned {
  readonly over = undefined;
  readonly end = Infinity;

  constructor(readonly start: Seconds) {}

  shift(dt: Seconds): Tail {
    finite(dt, "shift()");

    return build(this.start + dt, undefined, "shift()");
  }

  pad(before: Seconds): Tail {
    finite(before, "pad()");

    return build(this.start - before, undefined, "pad()");
  }

  until(end: Seconds): Range {
    finite(end, "until()");

    return build(this.start, end - this.start, "until()");
  }

  first(over: Seconds): Range {
    return build(this.start, over, "first()");
  }
}

function build(start: Seconds, over: Seconds, what: string): Range;
function build(start: Seconds, over: undefined, what: string): Tail;
function build(start: Seconds, over: Seconds | undefined, what: string): Range | Tail {
  if (over === undefined) {
    checkWindow(start, 1, what);

    return new Tail(start);
  }

  checkWindow(start, over, what, true);

  return new Range(start, over);
}

/**
 * The one rule for a start and an `over`: the start is finite and 0 or later, `over` is finite and positive. Whatever
 * plays in the window (a recipe, `sampled`, a `<Sequence>`) needs time to play in, so `over: 0` throws. `span()`
 * alone passes `empty`, since a zero-length span is a point on the clock that `.next` and `.pad` can start from.
 */
export const checkWindow = (start: Seconds, over: Seconds, what: string, empty = false): void => {
  if (!Number.isFinite(start) || start < 0)
    throw new Error(`${what} needs a start of 0 or later, got ${start}.`);

  if (!Number.isFinite(over) || (empty ? over < 0 : over <= 0))
    throw new Error(
      empty
        ? `${what} needs a length of 0 or more, got ${over}.`
        : `${what} needs a positive over, got ${over}.`,
    );
};

/**
 * A span of a clock, `over` seconds long from `start`. Without `over` it runs to the end. Spans chain:
 * `span(0, 0.7).next(1, 0.2)` starts a gap after the first ends, `.pad(0.15)` grows one on both sides, and
 * `span(2).until(3.5)` runs from a start to an end.
 */
export function span(start: Seconds, over: Seconds): Spanned;
export function span(start: Seconds): OpenSpanned;
export function span(start: Seconds, over?: Seconds): Spanned | OpenSpanned {
  return over === undefined ? build(start, undefined, "span()") : build(start, over, "span()");
}
