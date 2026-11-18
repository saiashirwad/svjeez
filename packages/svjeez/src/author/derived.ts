import { EPSILON, type Seconds } from "../model/time";
import type { Animated, Key, Lane, Vec } from "../model/ir";
import { isLane } from "../model/lane";
import type { Anchor } from "./refs";
import { breaksOf, follow, laneFrom, valueAt } from "../model/sample";
import { laneOf, mixNumber, mixVec, type Mix, type Parts, type Timing } from "../model/steps";
import { isTrack, passageOf, type Anim, type Track } from "./track";

/**
 * Derived tracks: one value computed from others, such as a spoke's end from an angle. The model has no such thing:
 * lowering writes each as an ordinary lane. When the mapping is affine along every move of its sources, each key maps
 * to one key with the same ease, so the lane is as small as its source; otherwise it is sampled and fitted to few keys.
 */
export interface MapOptions {
  /**
   * How far a sampled lane may stray from the mapping, in the value's own units: px for a point. Default: a
   * thousandth of how far the value moves, and at most 0.05.
   */
  readonly tolerance?: number;
}

/** What a derived track reads: a track of numbers or points, one derived from them, or a still value. */
export type Source = number | Vec | Track<number> | Track<Vec> | Derived<number> | Derived<Vec>;

/** A source's value at one moment. */
type Read = number | Vec;

type Base = number | Vec | Track<number> | Track<Vec>;

/** A value that follows its sources. It takes no steps of its own: move the sources instead. */
export class Derived<T> {
  /** Tracks and still values, never another derived track: those are read through. */
  readonly sources: readonly Base[];
  readonly read: (values: readonly Read[]) => T;
  readonly tolerance: number | undefined;

  constructor(sources: readonly Base[], read: (values: readonly Read[]) => T, tolerance?: number) {
    if (tolerance !== undefined && !(tolerance > 0 && Number.isFinite(tolerance)))
      throw new Error(`A derived track needs a positive tolerance, got ${tolerance}.`);
    this.sources = sources;
    this.read = read;
    this.tolerance = tolerance;
  }

  /** Another track, `fn` of this one's value at every moment. */
  map<U>(fn: (value: T) => U, options: MapOptions = {}): Derived<U> {
    return new Derived(
      this.sources,
      (values) => fn(this.read(values)),
      options.tolerance ?? this.tolerance,
    );
  }

  /** This track read together with others, to `map` them into one: `x.with(y).map((x, y) => [x, y])`. */
  with<const S extends readonly Source[]>(...others: S): Together<[T, ...ValuesOf<S>]> {
    // SAFETY: a derived track of anything but numbers or points is refused when it is lowered, where it is read, and
    // its value comes first, as the tuple says.
    return together([this as Derived<number>, ...others]) as Together<[T, ...ValuesOf<S>]>;
  }
}

export const isDerived = <T>(value: Anim<T> | Anchor | undefined): value is Derived<T> =>
  value instanceof Derived;

const isDerivedSource = (source: Source): source is Derived<number> | Derived<Vec> =>
  source instanceof Derived;

type ValueOf<S> = S extends Track<infer T> ? T : S extends Derived<infer T> ? T : S;

/** The values of a list of sources, in order. */
export type ValuesOf<S extends readonly unknown[]> = { -readonly [K in keyof S]: ValueOf<S[K]> };

/** Tracks read together, as `a.with(b)` makes them: `map` turns them into one. */
export interface Together<V extends readonly unknown[]> {
  /** A track that is `fn` of the sources' values at every moment. */
  map<U>(fn: (...values: V) => U, options?: MapOptions): Derived<U>;
}

/** Sources read together, each of them a track, a derived track or a still value. */
export const together = <const S extends readonly Source[]>(sources: S): Together<ValuesOf<S>> => ({
  map: (fn, options = {}) => derive(sources, fn, options),
});

/** A track computed from several. Each source may itself be derived. */
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

/** A track's `map`: the one source is the track itself. */
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

const isNumber = (value: Read | undefined): value is number => typeof value === "number";

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

/** A value as its numbers, and its shape with the numbers taken out: two values of one shape blend number by number. */
interface Flat {
  readonly numbers: readonly number[];
  readonly shape: string;
}

const flatten = <T>(value: T, where: string): Flat => {
  const numbers: number[] = [];

  const shape = JSON.stringify(value, (_key, part) => {
    if (!isNumber(part)) return part;

    if (!Number.isFinite(part))
      throw new Error(`${where} is derived to ${part} at some moment. Keep the mapping finite.`);
    numbers.push(part);

    return 0;
  });

  return { numbers, shape };
};

/** The value of shape `shape` with `numbers` in it, in the order `flatten` took them out. */
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

/** Where between two keys the line must be checked: every step of a steps ease, or eighths. */
const probes = (key: Key<Read>): number[] => {
  const curve = key.ease;
  const count = curve?.kind === "steps" ? curve.count : 8;

  return Array.from({ length: Math.min(count, 64) - 1 }, (_, i) => (i + 1) / Math.min(count, 64));
};

const near = (a: number, b: number): boolean =>
  Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

/** The lane with each key mapped, when the mapping is affine along every move: then it keeps the keys and their eases. */
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

/** Samples a second when measuring how far a sampled value moves. */
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
      throw new Error(
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

const isBaseTrack = (source: Base): source is Track<number> | Track<Vec> => isTrack(source);

/**
 * A derived track as the model's value: a lane on the scene's clock, or a still value when nothing it reads moves.
 * `change` turns what the mapping gives into the model's value, as it does for a hand-written prop. `curves` says the
 * value is a position, which a sampled lane may draw with curved keys.
 */
export const derivedOf = <A, T>(
  value: Derived<A>,
  change: (value: A) => T,
  timing: Timing,
  where: string,
  curves = false,
): Animated<T> => {
  const lanes = value.sources.map((source): Animated<Read> => {
    if (!isBaseTrack(source)) return source;
    const { data } = passageOf<Read>(source);
    const first = data.initial.value;

    if (first === undefined || !readable(first))
      throw new Error(
        `${where} is derived from a track of something other than numbers or points. Derive from a number or point track, and map it to the value you need.`,
      );

    return laneOf(data, first, timing, mixRead, `a track that ${where} is derived from`);
  });

  const out = (values: readonly Read[]): T => change(value.read(values));
  const moving = lanes.filter((lane) => isLane(lane));

  if (moving.length === 0) return out(lanes.map((lane) => valueAt(lane, 0, blendRead)));
  const kept = affine(lanes, out, where);

  if (kept !== undefined) return kept;
  const period = moving[0]!.period;
  const shared = period !== undefined && moving.every((lane) => lane.period === period);

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
