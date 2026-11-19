import { SceneError } from "../model/scene-error";
import type { Seconds } from "../model/time";

export interface Interval {
  readonly start: Seconds;
  readonly over: Seconds;
}

export interface OpenInterval {
  readonly start: Seconds;
  readonly over?: undefined;
}

export type When = Interval | OpenInterval;

export const isWhen = (when: When | Seconds | null | undefined): when is When =>
  typeof when === "object" && when !== null && Number.isFinite(when.start);

export type Spans<N extends number, Done extends Span[] = []> = number extends N
  ? Span[]
  : Done["length"] extends N
    ? Done
    : Spans<N, [...Done, Span]>;

export interface Span extends Interval {
  readonly end: Seconds;
  shift(dt: Seconds): Span;
  next(over: Seconds, gap?: Seconds): Span;
  chain<const O extends readonly Seconds[]>(
    ...overs: O
  ): [Span, ...{ -readonly [K in keyof O]: Span }];
  cascade<const N extends number>(count: N, step: Seconds): Spans<N>;
}

export interface OpenSpan extends OpenInterval {
  readonly end: number;
  shift(dt: Seconds): OpenSpan;
}

const finite = (value: number, what: string): void => {
  if (!Number.isFinite(value))
    throw new SceneError(`${what} needs a finite number of seconds, got ${value}.`);
};

class Range implements Span {
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

  chain<const O extends readonly Seconds[]>(
    ...overs: O
  ): [Span, ...{ -readonly [K in keyof O]: Span }] {
    const out: Span[] = [this];

    for (const over of overs) out.push(out[out.length - 1]!.next(over));

    // SAFETY: out holds this span and one per entry of overs, in order, which is the tuple the signature names.
    return out as [Span, ...{ -readonly [K in keyof O]: Span }];
  }

  cascade<const N extends number>(count: N, step: Seconds): Spans<N> {
    if (!Number.isInteger(count) || count < 0 || !Number.isFinite(step))
      throw new SceneError(
        `cascade() needs a whole count of 0 or more and a finite step, got count ${count} and step ${step}.`,
      );

    // SAFETY: the array holds count spans, which is the tuple Spans<N> names for a literal count.
    return Array.from({ length: count }, (_, i) =>
      build(this.start + i * step, this.over, "cascade()"),
    ) as Spans<N>;
  }
}

class Tail implements OpenSpan {
  readonly over = undefined;
  readonly end = Infinity;

  constructor(readonly start: Seconds) {}

  shift(dt: Seconds): Tail {
    finite(dt, "shift()");

    return build(this.start + dt, undefined, "shift()");
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

export const checkWindow = (start: Seconds, over: Seconds, what: string, empty = false): void => {
  if (!Number.isFinite(start) || start < 0)
    throw new SceneError(`${what} needs a start of 0 or later, got ${start}.`);

  if (!Number.isFinite(over) || (empty ? over < 0 : over <= 0))
    throw new SceneError(
      empty
        ? `${what} needs a length of 0 or more, got ${over}.`
        : `${what} needs a positive over, got ${over}.`,
    );
};

export function span(start: Seconds, over: Seconds): Span;
export function span(start: Seconds): OpenSpan;
export function span(start: Seconds, over?: Seconds): Span | OpenSpan {
  return over === undefined ? build(start, undefined, "span()") : build(start, over, "span()");
}
