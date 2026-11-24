import { SceneError } from "../model/scene-error";
import { EPSILON, ease, type Seconds } from "../model/time";
import type { Animated, Key, Lane, Vec } from "../model/ir";
import { isLane } from "../model/lane";
import type { Anchor } from "./refs";
import { breaksOf, follow, laneFrom, valueAt } from "../model/sample";
import { laneOf, mixNumber, mixVec, type Mix, type Parts, type Timing } from "../model/steps";
import { isTrack, passageOf, readOf, type Anim, type Track } from "./track";
import { Window, ramp, windowLane } from "./window";
import { isNumber } from "../model/guards";

export interface MapOptions {
  readonly tolerance?: number;
}

export type Source = number | Vec | Track<number> | Track<Vec> | Derived<number> | Derived<Vec>;

type Read = number | Vec;

type Base = number | Vec | Track<number> | Track<Vec> | Window;

export class Derived<T> {
  readonly sources: readonly Base[];
  readonly read: (values: readonly Read[]) => T;
  readonly tolerance: number | undefined;

  constructor(sources: readonly Base[], read: (values: readonly Read[]) => T, tolerance?: number) {
    if (tolerance !== undefined && !(tolerance > 0 && Number.isFinite(tolerance)))
      throw new SceneError(`A derived track needs a positive tolerance, got ${tolerance}.`);
    this.sources = sources;
    this.read = read;
    this.tolerance = tolerance;
  }

  map<U>(fn: (value: T) => U, options: MapOptions = {}): Derived<U> {
    return new Derived(
      this.sources,
      (values) => fn(this.read(values)),
      options.tolerance ?? this.tolerance,
    );
  }

  with<const S extends readonly Source[]>(...others: S): Together<[T, ...ValuesOf<S>]> {
    // SAFETY: a derived track of anything but numbers or points is refused when it is lowered, where it is read, and
    // its value comes first, as the tuple says.
    return together([this as Derived<number>, ...others]) as Together<[T, ...ValuesOf<S>]>;
  }
}

export const isDerived = <T>(value: Anim<T> | Anchor | undefined): value is Derived<T> =>
  value instanceof Derived;

/** A value, track or derived track read through fn: a plain value is mapped now, a timeline stays one. */
export const through = <T, U>(value: Anim<T>, fn: (value: T) => U): Anim<U> =>
  isTrack(value) || isDerived(value) ? value.map(fn) : fn(value);

const startOf = (source: Base): Read =>
  source instanceof Window
    ? source.of(restOf(source.track))
    : // SAFETY: a source track holds numbers or points, the values read() takes.
      isTrack(source)
      ? (passageOf(source as Track<Read>).data.initial.value as Read)
      : source;

/** The value an animated prop starts from, at the start of its clock. */
export const restOf = <T>(value: Anim<T>): T => {
  if (isTrack(value)) return passageOf(value).data.initial.value!;

  if (!isDerived(value)) return value;

  return value.read(value.sources.map(startOf));
};

const isDerivedSource = (source: Source): source is Derived<number> | Derived<Vec> =>
  source instanceof Derived;

type ValueOf<S> = S extends Track<infer T> ? T : S extends Derived<infer T> ? T : S;

export type ValuesOf<S extends readonly unknown[]> = { -readonly [K in keyof S]: ValueOf<S[K]> };

export interface Together<V extends readonly unknown[]> {
  map<U>(fn: (...values: V) => U, options?: MapOptions): Derived<U>;
}

export const together = <const S extends readonly Source[]>(sources: S): Together<ValuesOf<S>> => ({
  map: (fn, options = {}) => derive(sources, fn, options),
});

const derive = <const S extends readonly Source[], U>(
  sources: S,
  fn: (...values: ValuesOf<S>) => U,
  options: MapOptions,
): Derived<U> => {
  const flat: Base[] = [];

  const readers = sources.map((source): ((values: readonly Read[]) => Read) => {
    const from = flat.length;

    if (isDerivedSource(source)) {
      flat.push(...source.sources);
      const count = source.sources.length;

      return (values) => source.read(values.slice(from, from + count));
    }

    flat.push(source);

    return (values) => values[from]!;
  });

  return new Derived(
    flat,
    // SAFETY: each reader gives the value of the source in its place, so the list is the tuple S names.
    (values) => fn(...(readers.map((reader) => reader(values)) as ValuesOf<S>)),
    options.tolerance,
  );
};

export const mappedTrack = <T, U>(
  source: Track<T>,
  fn: (value: T) => U,
  options: MapOptions,
): Derived<U> =>
  new Derived(
    // SAFETY: a track of anything but numbers or points is refused when it is lowered, where its values are read.
    [source as Track<number>],
    // SAFETY: the one value read is the source's, a T.
    ([value]) => fn(value as T),
    options.tolerance,
  );

/**
 * A value's progress between `from` and `to`, from 0 to 1 and held outside: a draw timeline seen as one part's own.
 * A track's window is exact and cheap, where a map() of it is sampled.
 */
export const within = (value: Anim<number>, from: number, to: number): Anim<number> => {
  if (!(from < to))
    throw new SceneError(
      `A window runs from ${from} to ${to}, which is not a span.`,
      "Give a start below its end, as in within(draw, 0.2, 0.8).",
    );

  if (!isTrack(value)) return through(value, (progress) => ramp(progress, from, to));

  // SAFETY: the one source is a window, which reads as a number.
  return new Derived([new Window(value, from, to)], ([progress]) => progress as number);
};

const readable = (value: Read): boolean =>
  isNumber(value)
    ? Number.isFinite(value)
    : Array.isArray(value) && value.length === 2 && value.every(Number.isFinite);

const mixRead: Mix<Read> & { readonly parts: Parts<Read> } = Object.assign(
  (a: Read, b: Read, amount: number): Read =>
    isNumber(a) && isNumber(b)
      ? mixNumber(a, b, amount, "a derived track")
      : !isNumber(a) && !isNumber(b)
        ? mixVec(a, b, amount, "a derived track")
        : a,
  {
    parts: {
      split: (value: Read): readonly number[] => (isNumber(value) ? [value] : value),
      join: (values: readonly number[]): Read =>
        values.length === 1 ? values[0]! : [values[0]!, values[1]!],
    },
  },
);

const blendRead = (a: Read, b: Read, amount: number): Read =>
  mixRead(a, b, amount, "a derived track");

interface Flat {
  readonly numbers: readonly number[];
  readonly shape: string;
}

const flatten = <T>(value: T, where: string): Flat => {
  const numbers: number[] = [];

  const shape = JSON.stringify(value, (_key, part) => {
    if (!isNumber(part)) return part;

    if (!Number.isFinite(part))
      throw new SceneError(
        `${where} is derived to ${part} at some moment. Keep the mapping finite.`,
      );
    numbers.push(part);

    return 0;
  });

  return { numbers, shape };
};

const rebuild = <T>(shape: string, numbers: readonly number[]): T => {
  let next = 0;
  const value: T = JSON.parse(shape, (_key, part) => (isNumber(part) ? numbers[next++]! : part));

  return value;
};

const sameKeys = (a: Lane<Read>, b: Lane<Read>): boolean =>
  a.period === b.period &&
  a.keys.length === b.keys.length &&
  a.keys.every(
    (key, i) =>
      Math.abs(key.t - b.keys[i]!.t) <= EPSILON &&
      JSON.stringify(key.ease) === JSON.stringify(b.keys[i]!.ease),
  );

const probes = (key: Key<Read>): number[] => {
  const curve = key.ease;
  const count = curve?.kind === "steps" ? curve.count : 8;

  return Array.from({ length: Math.min(count, 64) - 1 }, (_, i) => (i + 1) / Math.min(count, 64));
};

const near = (a: number, b: number): boolean =>
  Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

const affine = <T>(
  lanes: readonly Animated<Read>[],
  out: (values: readonly Read[]) => T,
  where: string,
): Animated<T> | undefined => {
  const moving = lanes.filter((lane) => isLane(lane));
  const first = moving[0];

  if (!first || !moving.every((lane) => sameKeys(first, lane))) return undefined;

  const at = (i: number): Read[] =>
    lanes.map((lane) => (isLane(lane) ? lane.keys[i]!.value : lane));

  const mapped = first.keys.map((_, i) => flatten(out(at(i)), where));

  for (let i = 1; i < first.keys.length; i++) {
    const [a, b] = [at(i - 1), at(i)];
    const [fa, fb] = [mapped[i - 1]!, mapped[i]!];

    if (fa.shape !== fb.shape) return undefined;

    for (const u of probes(first.keys[i]!)) {
      const mid = flatten(out(a.map((value, s) => blendRead(value, b[s]!, u))), where);

      if (
        mid.shape !== fa.shape ||
        !mid.numbers.every((value, c) =>
          near(value, fa.numbers[c]! + (fb.numbers[c]! - fa.numbers[c]!) * u),
        )
      )
        return undefined;
    }
  }

  const [head, next, ...rest] = first.keys.map((key, i): Key<T> => ({
    ...key,
    value: rebuild<T>(mapped[i]!.shape, mapped[i]!.numbers),
  }));

  if (
    mapped.every(
      ({ numbers, shape }) =>
        shape === mapped[0]!.shape && numbers.every((n, c) => n === mapped[0]!.numbers[c]),
    )
  )
    return head!.value;

  const lane: Lane<T> = { kind: "lane", keys: [head!, next!, ...rest] };

  return first.period === undefined ? lane : { ...lane, period: first.period };
};

const MEASURE = 60;

const sampledLane = <T>(
  lanes: readonly Animated<Read>[],
  out: (values: readonly Read[]) => T,
  window: Seconds,
  period: Seconds | undefined,
  tolerance: number | undefined,
  where: string,
  curves: boolean,
): Animated<T> => {
  const shape = flatten(out(lanes.map((lane) => valueAt(lane, 0, blendRead))), where).shape;

  const at = (t: Seconds): readonly number[] => {
    const flat = flatten(out(lanes.map((lane) => valueAt(lane, t, blendRead))), where);

    if (flat.shape !== shape)
      throw new SceneError(
        `${where} is derived to values of different shapes over time, such as two kinds of geometry. Derive one kind with the same number of points.`,
      );

    return flat.numbers;
  };

  const count = Math.max(2, Math.ceil(window * MEASURE));
  const seen = Array.from({ length: count + 1 }, (_, i) => at((window * i) / count));

  const range = Math.max(
    0,
    ...seen[0]!.map(
      (_, c) => Math.max(...seen.map((v) => v[c]!)) - Math.min(...seen.map((v) => v[c]!)),
    ),
  );

  const keys = follow(
    at,
    breaksOf(lanes, window),
    tolerance ?? Math.min(0.05, Math.max(range * 1e-3, 1e-6)),
    [],
    lanes,
    curves && shape === "[0,0]",
  );

  const lane = laneFrom(keys, (numbers): T => rebuild<T>(shape, numbers));

  return period === undefined || !isLane(lane) ? lane : { ...lane, period };
};

const COLOR = /^\[0,0,0,0\]$|^\{"kind":"token","name":".*"\}$/;

const steppedLane = <T>(
  lanes: readonly Animated<Read>[],
  out: (values: readonly Read[]) => T,
  window: Seconds,
  period: Seconds | undefined,
  where: string,
): Animated<T> | undefined => {
  const at = (t: Seconds): T => out(lanes.map((lane) => valueAt(lane, t, blendRead)));
  const count = Math.max(2, Math.ceil(window * MEASURE));
  const times = Array.from({ length: count + 1 }, (_, i) => (window * i) / count);
  const values = times.map(at);
  const ids = values.map((value) => JSON.stringify(value));
  const changes = ids.flatMap((id, i) => (i > 0 && id !== ids[i - 1] ? [i] : []));

  if (changes.length === 0 || changes.length > count / 8) return undefined;
  const shape = flatten(values[0], where).shape;

  if (
    !values.every((value) => {
      const own = flatten(value, where).shape;

      return own === shape || (COLOR.test(own) && COLOR.test(shape));
    })
  )
    return undefined;

  const keys = changes.map((i): Key<T> => {
    let [low, high] = [times[i - 1]!, times[i]!];

    for (let step = 0; step < 40 && high - low > EPSILON; step++) {
      const mid = (low + high) / 2;

      if (JSON.stringify(at(mid)) === ids[i - 1]) low = mid;
      else high = mid;
    }

    return { t: high, value: values[i]!, ease: ease.hold };
  });

  const [next, ...rest] = keys;

  if (!next) return undefined;
  const lane: Lane<T> = { kind: "lane", keys: [{ t: 0, value: values[0]! }, next, ...rest] };

  return period === undefined ? lane : { ...lane, period };
};

/** A track's lane seen through a window: cut exactly where it can be, sampled where it cannot. */
const windowed = (
  lane: Animated<Read>,
  window: Window,
  timing: Timing,
  where: string,
): Animated<Read> => {
  // SAFETY: a window is of a number track, so its lane holds numbers.
  const numbers = lane as Animated<number>;

  if (!isLane(numbers)) return window.of(numbers);
  const exact = windowLane(numbers, window);

  if (exact !== undefined) return exact;
  const period = numbers.period;

  return sampledLane(
    [numbers],
    // SAFETY: the one lane is a number track's, so its value is a number.
    ([progress]) => window.of(progress as number),
    period ?? timing.duration,
    period,
    undefined,
    where,
    false,
  );
};

const isBaseTrack = (source: Base): source is Track<number> | Track<Vec> | Window =>
  source instanceof Window || isTrack(source);

export const derivedOf = <A, T>(
  value: Derived<A>,
  change: (value: A) => T,
  timing: Timing,
  where: string,
  curves = false,
): Animated<T> => {
  const lanes = value.sources.map((source): Animated<Read> => {
    if (!isBaseTrack(source)) return source;
    const track = source instanceof Window ? source.track : source;
    const { data } = readOf<Read>(track, timing, `a track that ${where} is derived from`);
    const first = data.initial.value;

    if (first === undefined || !readable(first))
      throw new SceneError(
        `${where} is derived from a track of something other than numbers or points. Derive from a number or point track, and map it to the value you need.`,
      );

    const lane = laneOf(data, first, timing, mixRead, `a track that ${where} is derived from`);

    return source instanceof Window ? windowed(lane, source, timing, where) : lane;
  });

  const out = (values: readonly Read[]): T => change(value.read(values));
  const moving = lanes.filter((lane) => isLane(lane));

  if (moving.length === 0) return out(lanes.map((lane) => valueAt(lane, 0, blendRead)));
  const kept = affine(lanes, out, where);

  if (kept !== undefined) return kept;
  const period = moving[0]!.period;
  const shared = period !== undefined && moving.every((lane) => lane.period === period);

  const stepped = steppedLane(
    lanes,
    out,
    shared ? period : timing.duration,
    shared ? period : undefined,
    where,
  );

  if (stepped !== undefined) return stepped;

  return sampledLane(
    lanes,
    out,
    shared ? period : timing.duration,
    shared ? period : undefined,
    value.tolerance,
    where,
    curves,
  );
};
