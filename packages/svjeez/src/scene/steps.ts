import { easeAt, splitEase } from "../ease-at";
import { MAX_KEYS, snapPeriod } from "../keys";
import { EPSILON, NUDGE, ease, type Ease, type Seconds } from "../motion";
import type { Span } from "../span";
import { num } from "../format";
import type { Animated, Key, Lane, Vec } from "./ir";

/**
 * Steps over a set of named values, and the lanes they become. The builder is today's `motion()`, and the
 * resolution is `resolve.ts` and `keys.ts`, both for any value instead of the SVG channel table.
 */
export interface Step<V> {
  readonly start: Seconds;
  readonly over: Seconds;
  readonly ease: Ease;
  readonly values: Partial<V>;
  /** A cut back to the first value of each of these, between two passes of a repeat. */
  readonly restore?: readonly (keyof V)[];
  readonly until?: Seconds;
}

export interface PassageData<V> {
  readonly initial: Partial<V>;
  readonly steps: readonly Step<V>[];
  readonly period?: Seconds;
  readonly rewind?: { readonly over: Seconds; readonly ease: Ease };
  readonly repeated?: boolean;
}

const MAX_UNROLLED = 20000;

const time = (value: Seconds, what: string): Seconds => {
  if (!Number.isFinite(value) || value < 0)
    throw new Error(`${what} needs a finite, non-negative number of seconds, got ${value}.`);

  return value;
};

const end = <V>(step: Step<V>): Seconds =>
  step.until === undefined ? step.start + step.over : Math.min(step.start + step.over, step.until);

const isUntil = (
  value: number | { readonly until: Seconds },
): value is { readonly until: Seconds } => typeof value === "object";

const isSpan = (when: Span | Seconds | null | undefined): when is Span =>
  typeof when === "object" && when !== null;

const isTime = (at: Seconds | Span | undefined): at is Seconds => typeof at === "number";

// SAFETY: values is a Partial<V>, so its own keys are keys of V.
const names = <V extends object>(values: Partial<V>): (keyof V)[] =>
  Object.keys(values) as (keyof V)[];

/** The steps of one track or one motion layer. Immutable: every method returns a new passage. */
export class Passage<V extends object> {
  constructor(readonly data: PassageData<V>) {}

  #with(patch: Partial<PassageData<V>>): Passage<V> {
    return new Passage({ ...this.data, ...patch });
  }

  to(values: Partial<V>, when: Span, curve: Ease = ease.out): Passage<V> {
    if (!isSpan(when))
      throw new Error(
        `to() takes a span, got ${String(when)}. Write .to(value, span(at, over)); a step right after another is span.next(over).`,
      );
    const start = time(when.at, "to()");

    if (!(time(when.over, "to()") > 0))
      throw new Error(`to() needs a positive duration, got ${when.over}. Use set() for a cut.`);

    return this.#push({ start, over: when.over, ease: curve, values });
  }

  set(values: Partial<V>, at: Seconds): Passage<V> {
    if (!isTime(at))
      throw new Error(
        `set() takes the time of the cut in seconds, got ${at === undefined ? "none" : JSON.stringify(at)}. Write .set(value, at).`,
      );

    return this.#push({ start: time(at, "set()"), over: 0, ease: ease.hold, values });
  }

  loop(period: Seconds): Passage<V> {
    if (!(time(period, "loop()") > 0))
      throw new Error(`loop() needs a positive period, got ${period}.`);
    const last = Math.max(0, ...this.data.steps.map(end));

    if (last > period + EPSILON)
      throw new Error(`loop(${period}) is shorter than the motion, which runs until ${last}s.`);

    return this.#with({ period });
  }

  repeat(times: number | { readonly until: Seconds }): Passage<V> {
    const { steps } = this.data;

    this.#open("repeat()");

    if (steps.length === 0)
      throw new Error("repeat() needs a passage to repeat: write a transition first.");

    if (isUntil(times)) {
      if (!Number.isFinite(times.until))
        throw new Error(`repeat() needs a finite until, got ${times.until}.`);
    } else if (!Number.isInteger(times) || times < 1)
      throw new Error(`repeat() needs a whole number of plays of 1 or more, got ${times}.`);

    const from = Math.min(...steps.map((step) => step.start));
    const to = Math.max(...steps.map(end));
    const length = to - from;
    const limit = isUntil(times) ? times.until : Infinity;

    if (!(length > 0))
      throw new Error(
        `repeat() needs a passage with a length, but its steps start and end at ${from}s. Add a transition.`,
      );

    if (limit !== Infinity && !(limit > to + EPSILON))
      throw new Error(
        `repeat({ until: ${limit} }) needs a time after the passage ends, at ${to}s.`,
      );

    const passes = isUntil(times) ? Math.ceil((limit - from) / length - EPSILON) : times;

    if (passes * steps.length > MAX_UNROLLED)
      throw new Error(
        `repeat() would unroll ${passes} passes of ${steps.length} steps into keyframes. Use .loop(period) for a motion that never stops.`,
      );

    const touched = [...new Set(steps.flatMap((step) => names(step.values)))];
    const copies: Step<V>[] = [...steps];

    for (let pass = 1; pass < passes; pass++) {
      const shift = pass * length;

      copies.push({ start: from + shift, over: 0, ease: ease.hold, values: {}, restore: touched });

      for (const step of steps) {
        const start = step.start + shift;

        if (start >= limit - EPSILON) continue;
        const own = step.until === undefined ? Infinity : step.until + shift;
        const stop = start + step.over > limit + EPSILON ? Math.min(own, limit) : own;

        copies.push(stop === Infinity ? { ...step, start } : { ...step, start, until: stop });
      }
    }

    return this.#with({ steps: copies, repeated: true });
  }

  rewind(over: Seconds, curve: Ease = ease.out): Passage<V> {
    if (!(time(over, "rewind()") > 0))
      throw new Error(`rewind() needs a positive duration, got ${over}.`);

    this.#open("rewind()");

    return this.#with({ rewind: { over, ease: curve } });
  }

  #open(what: string): void {
    if (this.data.rewind)
      throw new Error(`${what} can't follow rewind(), which runs to the end of the clock.`);
  }

  #push(step: Step<V>): Passage<V> {
    const { period } = this.data;

    this.#open("A transition");

    if (period !== undefined && end(step) > period + EPSILON)
      throw new Error(`A step ending at ${end(step)}s overruns loop(${period}).`);

    for (const other of this.data.steps) {
      const shared = names(step.values).find((name) => name in other.values);

      if (shared && step.start < end(other) - EPSILON && other.start < end(step) - EPSILON)
        throw new Error(
          `Two transitions move \`${String(shared)}\` between ${Math.max(step.start, other.start)}s and ${Math.min(end(step), end(other))}s. Move them in one .to(), or stack two motions.`,
        );
    }

    return this.#with({ steps: [...this.data.steps, step] });
  }
}

/** The same passage with every value of `name` passed through `change`: how lowering turns authored values into the model's. */
export const mapped = <V extends object, K extends keyof V, U>(
  data: PassageData<V>,
  name: K,
  change: (value: Exclude<V[K], undefined>) => U,
): PassageData<{ readonly value: U }> => {
  const pick = (values: Partial<V>): { readonly value?: U } => {
    const value = values[name];

    // SAFETY: undefined was just ruled out, so the value is in Exclude<V[K], undefined>.
    return value === undefined ? {} : { value: change(value as Exclude<V[K], undefined>) };
  };

  return {
    ...data,
    initial: pick(data.initial),
    steps: data.steps
      .filter((step) => name in step.values || step.restore?.includes(name))
      .map((step) =>
        step.restore
          ? { ...step, values: {}, restore: ["value"] as const }
          : {
              start: step.start,
              over: step.over,
              ease: step.ease,
              values: pick(step.values),
              ...(step.until !== undefined && { until: step.until }),
            },
      ),
  };
};

/** Whether a passage says anything about `name`. */
export const touches = <V extends object>(data: PassageData<V>, name: keyof V): boolean =>
  name in data.initial || data.steps.some((step) => name in step.values);

export interface ClipFrame {
  readonly label: string;
  readonly start: Seconds;
  readonly end: Seconds;
  readonly open: boolean;
}

/** The clock a passage is written on: where its zero is on the scene's clock, and when it ends. */
export interface Clock {
  readonly offset: Seconds;
  readonly end: Seconds;
  readonly clips: readonly ClipFrame[];
}

/** How to stop between two values, for a cut that lands inside a transition. */
export type Mix<T> = (a: T, b: T, amount: number, where: string) => T;

export const mixNumber: Mix<number> = (a, b, amount) => a + (b - a) * amount;

export const mixVec: Mix<Vec> = (a, b, amount) => [
  a[0] + (b[0] - a[0]) * amount,
  a[1] + (b[1] - a[1]) * amount,
];

export const same = <T>(a: T, b: T): boolean => a === b || JSON.stringify(a) === JSON.stringify(b);

/** For values with nothing between them that could be drawn, such as two tokens. */
export const noMix = <T>(a: T, b: T, _amount: number, where: string): T => {
  if (same(a, b)) return a;

  throw new Error(
    `${where} is cut partway through a transition, and only numbers and points can be cut there. Cut it between transitions.`,
  );
};

interface Held<T> {
  readonly t: Seconds;
  readonly value: T;
  /** Shapes the way from this key to the next. */
  readonly ease: Ease;
}

interface Segment<T> {
  readonly start: Seconds;
  readonly over: Seconds;
  readonly ease: Ease;
  readonly value: T;
}

const segmentsOf = <T>(
  initial: T,
  data: PassageData<{ readonly value: T }>,
  clockEnd: Seconds,
  mix: Mix<T>,
  where: string,
): Segment<T>[] => {
  const out: Segment<T>[] = [];
  let current = initial;

  const apply = (segment: Segment<T>): void => {
    out.push(segment);
    current = segment.value;
  };

  for (const step of [...data.steps].sort((a, b) => a.start - b.start)) {
    const value = step.values.value;

    if (step.restore) {
      if (!same(current, initial))
        apply({ start: step.start, over: 0, ease: ease.hold, value: initial });
    } else if (value === undefined) continue;
    else if (step.until !== undefined && step.until < step.start + step.over - EPSILON) {
      const progress = (step.until - step.start) / step.over;
      const [curve] = splitEase(step.ease, progress, "repeat({ until })");

      apply({
        start: step.start,
        over: step.until - step.start,
        ease: curve,
        value: mix(current, value, easeAt(step.ease, progress), "repeat({ until })"),
      });
    } else apply({ start: step.start, over: step.over, ease: step.ease, value });
  }

  if (data.rewind && !same(current, initial)) {
    const last = Math.max(0, ...out.map((segment) => segment.start + segment.over));
    const start = clockEnd - data.rewind.over;

    if (start < last - EPSILON)
      throw new Error(
        `rewind(${data.rewind.over}) on ${where} needs the last ${data.rewind.over}s of its ${clockEnd}s clock, but the motion runs until ${last}s.`,
      );

    apply({ start, over: data.rewind.over, ease: data.rewind.ease, value: initial });
  }

  return out;
};

const heldOf = <T>(initial: T, segments: readonly Segment<T>[], period: Seconds): Held<T>[] => {
  const keys: Held<T>[] = [{ t: 0, value: initial, ease: ease.out }];
  const nudge = period * NUDGE;
  let current = initial;

  for (const segment of segments) {
    const last = keys.at(-1)!;
    const contiguous = segment.start < last.t + nudge;

    if (segment.over >= nudge) {
      if (contiguous) keys[keys.length - 1] = { ...last, ease: segment.ease };
      else keys.push({ t: segment.start, value: current, ease: segment.ease });
      keys.push({ t: segment.start + segment.over, value: segment.value, ease: ease.out });
    } else if (keys.length === 1 && segment.start === 0) {
      keys[0] = { ...last, value: segment.value };
    } else if (contiguous && last.t + nudge > period + EPSILON) {
      keys[keys.length - 1] = { ...last, t: last.t - nudge, ease: ease.hold };
      keys.push({ t: period, value: segment.value, ease: ease.out });
    } else {
      keys[keys.length - 1] = { ...last, ease: ease.hold };
      keys.push({
        t: contiguous ? last.t + nudge : segment.start,
        value: segment.value,
        ease: ease.out,
      });
    }

    current = segment.value;
  }

  if (keys.at(-1)!.t < period - EPSILON) keys.push({ t: period, value: current, ease: ease.out });

  return keys;
};

const splitAt = <T>(
  keys: readonly Held<T>[],
  t: Seconds,
  mix: Mix<T>,
  where: string,
): Held<T>[] => {
  const index = keys.findLastIndex((key) => key.t <= t + EPSILON);
  const from = keys[index]!;
  const to = keys[index + 1];

  if (!to || Math.abs(from.t - t) <= EPSILON) return [...keys];

  const progress = (t - from.t) / (to.t - from.t);
  const moves = !same(from.value, to.value);
  const [first, second] = moves ? splitEase(from.ease, progress, where) : [from.ease, from.ease];
  const value = moves ? mix(from.value, to.value, easeAt(from.ease, progress), where) : from.value;

  return [
    ...keys.slice(0, index),
    { ...from, ease: first },
    { t, value, ease: second },
    ...keys.slice(index + 1),
  ];
};

const rotated = <T>(
  keys: readonly Held<T>[],
  shift: Seconds,
  period: Seconds,
  mix: Mix<T>,
  where: string,
): Held<T>[] => {
  const nudge = period * NUDGE;
  const by = ((shift % period) + period) % period;

  if (by < nudge * 4 || period - by < nudge * 4) return [...keys];

  const wrap = period - by;
  const split = splitAt(keys, wrap, mix, where);

  const tail = split
    .filter((key) => key.t >= wrap - EPSILON)
    .map((key) => ({ ...key, t: key.t - wrap }));

  const front = split
    .filter((key) => key.t <= wrap + EPSILON)
    .map((key) => ({ ...key, t: key.t + by }));

  const [joinEnd, joinStart] = [tail.at(-1)!, front[0]!];

  if (same(joinEnd.value, joinStart.value)) return [...tail.slice(0, -1), ...front];

  return [...tail.slice(0, -1), { ...joinEnd, t: by - nudge, ease: ease.hold }, ...front];
};

const reach = (
  clock: Clock,
  onClock: boolean,
  until: Seconds,
  duration: Seconds,
  period: Seconds,
  where: string,
): void => {
  if (!onClock) {
    if (until > period + EPSILON)
      throw new Error(`${where} runs until ${num(until)}s, past its ${num(period)}s loop.`);

    return;
  }

  for (const clip of [...clock.clips].reverse())
    if (!clip.open && until > clip.end + EPSILON)
      throw new Error(
        `${where} runs until ${num(until - clip.start)}s, past the ${num(clip.end - clip.start)}s ${clip.label}.`,
      );

  if (until > duration + EPSILON) {
    const inside = clock.clips.at(-1);

    throw new Error(
      `${where} runs until ${num(until)}s${inside ? ` (${num(until - clock.offset)}s into ${inside.label})` : ""}, past the ${num(duration)}s scene.`,
    );
  }
};

export interface Timing {
  readonly duration: Seconds;
  readonly clock: Clock;
}

/**
 * One value's steps as a lane on the scene's clock, or as the value itself when it never changes. `initial` is
 * what the value is before its first step when the passage doesn't say.
 */
export const laneOf = <T>(
  data: PassageData<{ readonly value: T }>,
  initial: T,
  { duration, clock }: Timing,
  mix: Mix<T>,
  where: string,
): Animated<T> => {
  const first = data.initial.value ?? initial;
  const looped = data.period !== undefined;
  const period = data.period ?? duration;
  const offset = looped ? 0 : clock.offset;
  const snapped = looped ? snapPeriod(period, duration) : duration;
  const segments = segmentsOf(first, data, looped ? period : clock.end - clock.offset, mix, where);
  const last = Math.max(0, ...segments.map((segment) => segment.start + segment.over));

  reach(clock, !looped, offset + last, duration, period, where);

  const written = heldOf(
    first,
    segments.map((segment) => ({ ...segment, start: segment.start + offset })),
    period,
  );

  const keys =
    looped && clock.offset > 0
      ? rotated(
          written,
          ((clock.offset % snapped) / snapped) * period,
          period,
          mix,
          `A loop on ${where} inside ${clock.clips.at(-1)?.label ?? "a sequence"}`,
        )
      : written;

  if (keys.length > MAX_KEYS)
    throw new Error(
      `${where} has ${keys.length} keys; the cap is ${MAX_KEYS}.${data.repeated ? " repeat() unrolls every pass, so use .loop(period) for a motion that never stops." : ""}`,
    );

  if (keys.every((key) => same(key.value, first))) return first;

  const scale = snapped / period;

  const [head, next, ...rest] = keys.map((key, index): Key<T> =>
    index === 0
      ? { t: key.t * scale, value: key.value }
      : { t: key.t * scale, value: key.value, ease: keys[index - 1]!.ease },
  );

  const lane: Lane<T> = { kind: "lane", keys: [head!, next!, ...rest] };

  return looped ? { ...lane, period: snapped } : lane;
};
