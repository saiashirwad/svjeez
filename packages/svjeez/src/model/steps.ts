import { easeAt, splitEase } from "./ease-at";
import { MAX_KEYS, snapPeriod } from "../svg/keys";
import { EPSILON, NUDGE, ease, type Ease, type Seconds } from "./time";
import type { Span } from "../author/span";
import { num } from "./format";
import { isCurved, splitCurve, type Controls } from "./curve";
import type { Animated, Key, Lane, Vec } from "./ir";
import { isLane } from "./lane";
import { endSlope, isSpring, type Curve, type Spring } from "../author/spring";

export interface Step<V> {
  readonly start: Seconds;
  readonly over: Seconds;
  readonly ease: Curve;
  readonly values: Partial<V>;
  readonly restore?: readonly (keyof V)[];
  readonly until?: Seconds;
}

export interface PassageData<V> {
  readonly initial: Partial<V>;
  readonly steps: readonly Step<V>[];
  readonly period?: Seconds;
  readonly rewind?: { readonly over: Seconds; readonly ease: Curve };
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

const cuts = <V>(spring: Step<V>, later: Step<V>): boolean =>
  isSpring(spring.ease) && spring.start < later.start - EPSILON;

export class Passage<V extends object> {
  constructor(readonly data: PassageData<V>) {}

  #with(patch: Partial<PassageData<V>>): Passage<V> {
    return new Passage({ ...this.data, ...patch });
  }

  to(values: Partial<V>, when: Span, curve: Curve = ease.out): Passage<V> {
    if (!isSpan(when))
      throw new Error(
        `to() takes a span, got ${String(when)}. Write .to(value, span(start, over)); a step right after another is span.next(over).`,
      );
    const start = time(when.start, "to()");

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

  rewind(over: Seconds, curve: Curve = ease.out): Passage<V> {
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

      if (
        shared &&
        step.start < end(other) - EPSILON &&
        other.start < end(step) - EPSILON &&
        !cuts(other, step) &&
        !cuts(step, other)
      )
        throw new Error(
          `Two transitions move \`${String(shared)}\` between ${Math.max(step.start, other.start)}s and ${Math.min(end(step), end(other))}s. Move them in one .to(), or stack two motions. Only a spring can be cut by a step that starts while it moves.`,
        );
    }

    return this.#with({ steps: [...this.data.steps, step] });
  }
}

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

export const touches = <V extends object>(data: PassageData<V>, name: keyof V): boolean =>
  name in data.initial || data.steps.some((step) => name in step.values);

export interface ClipFrame {
  readonly label: string;
  readonly start: Seconds;
  readonly end: Seconds;
  readonly open: boolean;
}

export interface Clock {
  readonly offset: Seconds;
  readonly end: Seconds;
  readonly clips: readonly ClipFrame[];
}

export interface Parts<T> {
  split(value: T): readonly number[];
  join(values: readonly number[]): T;
}

export type Mix<T> = (a: T, b: T, amount: number, where: string) => T;

type Springy<T> = Mix<T> & { readonly parts: Parts<T> };

const isSpringy = <T>(mix: Mix<T>): mix is Springy<T> => "parts" in mix;

export const mixNumber: Springy<number> = Object.assign(
  (a: number, b: number, amount: number): number => a + (b - a) * amount,
  { parts: { split: (value: number) => [value], join: (values: readonly number[]) => values[0]! } },
);

export const mixVec: Springy<Vec> = Object.assign(
  (a: Vec, b: Vec, amount: number): Vec => [
    a[0] + (b[0] - a[0]) * amount,
    a[1] + (b[1] - a[1]) * amount,
  ],
  {
    parts: {
      split: (value: Vec) => value,
      join: (values: readonly number[]): Vec => [values[0]!, values[1]!],
    },
  },
);

export const same = <T>(a: T, b: T): boolean => a === b || JSON.stringify(a) === JSON.stringify(b);

export const noMix = <T>(a: T, b: T, _amount: number, where: string): T => {
  if (same(a, b)) return a;

  throw new Error(
    `${where} is cut partway through a transition, and only numbers and points can be cut there. Cut it between transitions.`,
  );
};

interface Held<T> {
  readonly t: Seconds;
  readonly value: T;
  readonly ease: Ease;
  readonly via?: Controls;
}

interface Segment<T> {
  readonly start: Seconds;
  readonly over: Seconds;
  readonly ease: Ease;
  readonly value: T;
  readonly via?: Controls;
}

interface Written<T> {
  readonly segments: readonly Segment<T>[];
  readonly last: Seconds;
}

interface Moving {
  readonly at: Seconds;
  readonly velocity: () => readonly number[];
}

const componentsOf = <T>(mix: Mix<T>, where: string): Parts<T> => {
  if (!isSpringy(mix))
    throw new Error(
      `${where} moves on a spring, and a spring moves only numbers and points. Use an ease such as ease.out.`,
    );

  return mix.parts;
};

const segmentsOf = <T>(
  initial: T,
  data: PassageData<{ readonly value: T }>,
  clockEnd: Seconds,
  mix: Mix<T>,
  where: string,
  curves: boolean,
): Written<T> => {
  const out: Segment<T>[] = [];
  let current = initial;
  let moving: Moving | undefined;
  let last = 0;

  const apply = (segment: Segment<T>): void => {
    const from = current;

    out.push(segment);
    current = segment.value;
    last = Math.max(last, segment.start + segment.over);

    moving =
      segment.over > 0
        ? {
            at: segment.start + segment.over,
            velocity: () => {
              const parts = componentsOf(mix, where);
              const [a, b] = [parts.split(from), parts.split(segment.value)];
              const slope = endSlope(segment.ease) / segment.over;

              return a.map((value, c) => (b[c]! - value) * slope);
            },
          }
        : undefined;
  };

  const spring = (curve: Spring, start: Seconds, stop: Seconds, value: T, ends: boolean): void => {
    const parts = componentsOf(mix, where);
    const from = parts.split(current);

    const carried =
      moving && Math.abs(moving.at - start) <= EPSILON ? moving.velocity() : from.map(() => 0);

    const run = curve.run(from, parts.split(value), carried, stop - start, curves);

    if (ends && !run.settled)
      throw new Error(
        `The spring on ${where} from ${num(start)}s needs ${num(Math.ceil(run.needs * 100) / 100)}s to settle, but its span is ${num(stop - start)}s. Give it a longer span, a stiffer or more damped spring, or cut it with a later step.`,
      );

    run.keys.slice(1).forEach((key, index) => {
      const before = run.keys[index]!;

      out.push({
        start: start + before.t,
        over: key.t - before.t,
        ease: key.ease ?? ease.linear,
        value: parts.join(key.values),
        ...(key.via && { via: key.via }),
      });
    });

    current = parts.join(run.keys.at(-1)!.values);
    last = Math.max(last, stop);
    moving = run.settled ? undefined : { at: stop, velocity: () => run.velocity };
  };

  const steps = [...data.steps].sort((a, b) => a.start - b.start);

  steps.forEach((step, index) => {
    const value = step.values.value;
    const curve = step.ease;

    if (step.restore) {
      if (!same(current, initial))
        apply({ start: step.start, over: 0, ease: ease.hold, value: initial });
      moving = undefined;
    } else if (value === undefined) return;
    else if (isSpring(curve)) {
      const cut = steps[index + 1]?.start ?? Infinity;
      const close = step.start + step.over;
      const stop = Math.min(close, cut, step.until ?? Infinity);

      spring(curve, step.start, stop, value, stop === close && cut > close + EPSILON);
    } else if (step.until !== undefined && step.until < step.start + step.over - EPSILON) {
      const progress = (step.until - step.start) / step.over;
      const [head] = splitEase(curve, progress, "repeat({ until })");

      apply({
        start: step.start,
        over: step.until - step.start,
        ease: head,
        value: mix(current, value, easeAt(curve, progress), "repeat({ until })"),
      });
    } else apply({ start: step.start, over: step.over, ease: curve, value });
  });

  if (data.rewind && !same(current, initial)) {
    const start = clockEnd - data.rewind.over;
    const curve = data.rewind.ease;

    if (start < last - EPSILON)
      throw new Error(
        `rewind(${data.rewind.over}) on ${where} needs the last ${data.rewind.over}s of its ${clockEnd}s clock, but the motion runs until ${last}s.`,
      );

    if (isSpring(curve)) spring(curve, start, clockEnd, initial, true);
    else apply({ start, over: data.rewind.over, ease: curve, value: initial });
  }

  return { segments: out, last };
};

const heldOf = <T>(initial: T, segments: readonly Segment<T>[], period: Seconds): Held<T>[] => {
  const keys: Held<T>[] = [{ t: 0, value: initial, ease: ease.out }];
  const nudge = period * NUDGE;
  let current = initial;

  for (const segment of segments) {
    const last = keys.at(-1)!;
    const contiguous = segment.start < last.t + nudge;

    if (segment.over >= nudge) {
      const via = segment.via && { via: segment.via };

      if (contiguous)
        keys[keys.length - 1] = { t: last.t, value: last.value, ease: segment.ease, ...via };
      else keys.push({ t: segment.start, value: current, ease: segment.ease, ...via });
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
  const moves = from.via !== undefined || !same(from.value, to.value);
  const [first, second] = moves ? splitEase(from.ease, progress, where) : [from.ease, from.ease];

  if (from.via) {
    // SAFETY: only a lane of points has a curve (ir.ts), so both values are points, and so is the one between.
    const [a, b] = [from.value as Vec, to.value as Vec];
    const [head, at, tail] = splitCurve(a, from.via, b, easeAt(from.ease, progress));

    return [
      ...keys.slice(0, index),
      { ...from, ease: first, via: head },
      // SAFETY: as above, T is Vec.
      { t, value: at as T, ease: second, via: tail },
      ...keys.slice(index + 1),
    ];
  }

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
        `${where} runs until ${num(until - clip.start)}s, past the ${num(clip.end - clip.start)}s ${clip.label}. End it by then, or give the sequence a longer over.`,
      );

  if (until > duration + EPSILON) {
    const inside = clock.clips.at(-1);

    throw new Error(
      `${where} runs until ${num(until)}s${inside ? ` (${num(until - clock.offset)}s into ${inside.label})` : ""}, past the ${num(duration)}s scene. End it by then, or give scene() a longer duration.`,
    );
  }
};

export interface Timing {
  readonly duration: Seconds;
  readonly clock: Clock;
}

const within = (key: Key<unknown>): boolean =>
  key.ease?.kind !== "bezier" ||
  [key.ease.points[1], key.ease.points[3]].every((y) => y >= 0 && y <= 1);

const costOf = (value: Animated<unknown>): number =>
  isLane(value) ? value.keys.reduce((sum, key) => sum + (key.via ? 1.5 : 1), 0) : 0;

export const laneOf = <T>(
  data: PassageData<{ readonly value: T }>,
  initial: T,
  timing: Timing,
  mix: Mix<T>,
  where: string,
  curves = false,
): Animated<T> => {
  const straight = written(data, initial, timing, mix, where, false);

  if (
    !curves ||
    (!data.steps.some((step) => isSpring(step.ease)) &&
      !(data.rewind && isSpring(data.rewind.ease)))
  )
    return straight;
  const curved = written(data, initial, timing, mix, where, true);

  return isLane(curved) &&
    isCurved(curved.keys) &&
    curved.keys.every(within) &&
    costOf(curved) < costOf(straight)
    ? curved
    : straight;
};

const written = <T>(
  data: PassageData<{ readonly value: T }>,
  initial: T,
  { duration, clock }: Timing,
  mix: Mix<T>,
  where: string,
  curves: boolean,
): Animated<T> => {
  const first = data.initial.value ?? initial;
  const looped = data.period !== undefined;
  const period = data.period ?? duration;
  const offset = looped ? 0 : clock.offset;
  const snapped = looped ? snapPeriod(period, duration) : duration;

  const { segments, last } = segmentsOf(
    first,
    data,
    looped ? period : clock.end - clock.offset,
    mix,
    where,
    curves,
  );

  reach(clock, !looped, offset + last, duration, period, where);

  const held = heldOf(
    first,
    segments.map((segment) => ({ ...segment, start: segment.start + offset })),
    period,
  );

  const keys =
    looped && clock.offset > 0
      ? rotated(
          held,
          ((clock.offset % snapped) / snapped) * period,
          period,
          mix,
          `A loop on ${where} inside ${clock.clips.at(-1)?.label ?? "a sequence"}`,
        )
      : held;

  if (keys.length > MAX_KEYS)
    throw new Error(
      `${where} has ${keys.length} keys; the cap is ${MAX_KEYS}.${data.repeated ? " repeat() unrolls every pass, so use .loop(period) for a motion that never stops." : ""}`,
    );

  if (keys.every((key) => !key.via && same(key.value, first))) return first;

  const scale = snapped / period;

  const [head, next, ...rest] = keys.map((key, index): Key<T> => {
    const before = keys[index - 1];

    return before
      ? {
          t: key.t * scale,
          value: key.value,
          ease: before.ease,
          ...(before.via && { via: before.via }),
        }
      : { t: key.t * scale, value: key.value };
  });

  const lane: Lane<T> = { kind: "lane", keys: [head!, next!, ...rest] };

  return looped ? { ...lane, period: snapped } : lane;
};
