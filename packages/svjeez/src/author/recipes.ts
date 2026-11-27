import { SceneError } from "../model/scene-error";
import { DEFAULT_EASE, NUDGE, ease, type Seconds } from "../model/time";
import { random } from "./random";
import { checkWindow, span, type Interval } from "./span";
import { alongOutline, contoursOf, lengthOf } from "../model/geometry";
import { through } from "./derived";
import type { Vec } from "../model/ir";
import { pair } from "../model/lane";
import type { Curve } from "./spring";
import { track, type Anim, type Goal, type Layer, type LayerValues, type Track } from "./track";
import { outlineOf, type Geometry } from "./values";
import { isNumber, isArray } from "../model/guards";

const REST = { offset: [0, 0], rotate: 0, scale: 1, skew: 0, opacity: 1 } as const;

const closed = ({ start, over }: Interval, what: string): Interval => {
  checkWindow(start, over, what);

  return { start, over };
};

// SAFETY: values is a LayerValues, so its own keys are layer value names.
const named = (values: LayerValues): (keyof LayerValues)[] =>
  Object.keys(values) as (keyof LayerValues)[];

const rest = (values: LayerValues): LayerValues =>
  Object.fromEntries(named(values).map((name) => [name, REST[name]]));

/** A layer with one track per key that both ends give, from one end to the other. */
const between = (from: LayerValues, to: LayerValues, when: Interval, curve: Curve): Layer => ({
  ...(from.offset && to.offset && { offset: track<Vec>(from.offset).to(to.offset, when, curve) }),
  ...(from.rotate !== undefined &&
    to.rotate !== undefined && { rotate: track(from.rotate).to(to.rotate, when, curve) }),
  ...(from.scale !== undefined &&
    to.scale !== undefined && {
      scale: track<Vec>(pair(from.scale)).to(pair(to.scale), when, curve),
    }),
  ...(from.skew !== undefined &&
    to.skew !== undefined && { skew: track(from.skew).to(to.skew, when, curve) }),
  ...(from.opacity !== undefined &&
    to.opacity !== undefined && { opacity: track(from.opacity).to(to.opacity, when, curve) }),
});

export interface EnterOptions {
  /** Where it starts, merged over `{ opacity: 0 }`: it is hidden before its span unless you pass an `opacity` yourself. */
  readonly from?: LayerValues;
  readonly curve?: Curve;
}

export const enter = (when: Interval, { from, curve = DEFAULT_EASE }: EnterOptions = {}): Layer => {
  const { start, over } = closed(when, "enter()");
  const first: LayerValues = { opacity: 0, ...from };

  return between(first, rest(first), span(start, over), curve);
};

export interface ExitOptions {
  /** Where it ends, merged over `{ opacity: 0 }`: it is gone after its span unless you pass an `opacity` yourself. */
  readonly to?: LayerValues;
  readonly curve?: Curve;
}

export const exit = (when: Interval, { to, curve = DEFAULT_EASE }: ExitOptions = {}): Layer => {
  const { start, over } = closed(when, "exit()");
  const last: LayerValues = { opacity: 0, ...to };

  return between(rest(last), last, span(start, over), curve);
};

export interface WiggleOptions {
  readonly seed: string | number;
  readonly rate?: number;
  readonly curve?: Curve;
  readonly period?: Seconds;
}

export const wiggle = (amplitude: LayerValues, options: WiggleOptions): Layer => {
  const period = options.period ?? 2;
  const rate = options.rate ?? 8;

  if (!Number.isFinite(period) || period <= 0)
    throw new SceneError(`wiggle() needs a positive period, got ${period}.`);

  if (!(rate > 0 && Number.isFinite(rate)))
    throw new SceneError(`wiggle() needs a positive rate, got ${rate}.`);
  const count = Math.max(2, Math.round(rate * period));
  const next = random(String(options.seed));
  const curve = options.curve ?? DEFAULT_EASE;

  const noise = (amp: number): number[] =>
    Array.from({ length: count }, () => amp * (next() * 2 - 1));

  /** One looped track through `at(i)` for i = 0..count, each step a `period / count` long. */
  const looped = <T>(from: Track<T>, at: (i: number) => Goal<T>): Track<T> => {
    let out = from;

    for (let i = 1; i <= count; i++)
      out = out.to(at(i % count), span(((i - 1) * period) / count, period / count), curve);

    return out.loop(period);
  };

  const opacity = amplitude.opacity === undefined ? undefined : noise(amplitude.opacity);
  const rotate = amplitude.rotate === undefined ? undefined : noise(amplitude.rotate);
  const scale = amplitude.scale === undefined ? undefined : pair(amplitude.scale).map(noise);
  const offset = amplitude.offset === undefined ? undefined : amplitude.offset.map(noise);

  const bounded = (i: number): number => Math.min(1, Math.max(0, 1 + opacity![i]!));
  const grown = (i: number): Vec => [1 + scale![0]![i]!, 1 + scale![1]![i]!];
  const shifted = (i: number): Vec => [offset![0]![i]!, offset![1]![i]!];

  return {
    ...(opacity && {
      opacity: looped(track(bounded(0)), (i) => bounded(i)),
    }),
    ...(rotate && { rotate: looped(track(rotate[0]!), (i) => rotate[i]!) }),
    ...(scale && { scale: looped(track(grown(0)), grown) }),
    ...(offset && { offset: looped(track(shifted(0)), shifted) }),
  };
};

export interface RideOptions {
  /** Also rotate to the path's heading (degrees; 0 faces +x, so draw the marker pointing right). */
  readonly turn?: boolean;
}

/**
 * A layer that moves the node's [0, 0] to the point `progress` (0 to 1, a number or a track) of the way along
 * `geometry` by arc length, the share `draw` and `trim` use: a node driven by the same track as a drawn line sits at the
 * line's tip. The path's coordinates are the node's own, so put the node at the origin of the path's space. Held at
 * the ends; with `turn`, it also faces the path's heading.
 */
export const ride = (
  geometry: Geometry,
  progress: Anim<number>,
  { turn = false }: RideOptions = {},
): Layer => {
  const outline = outlineOf(geometry);
  const length = lengthOf(outline);
  const at = (share: number) => alongOutline(outline, Math.min(1, Math.max(0, share)) * length);

  return {
    offset: through(progress, (share): Vec => at(share).point),
    ...(turn && { rotate: through(progress, (share) => (at(share).angle * 180) / Math.PI) }),
  };
};

export interface SampledOptions {
  readonly step?: Seconds;
  readonly tolerance: number;
  readonly precision?: number;
}

interface Kept<T> {
  readonly start: Seconds;
  readonly over: Seconds;
  readonly value: T;
}

interface Simplified<T> {
  readonly first: T;
  readonly kept: readonly Kept<T>[];
}

interface Sample<T> {
  readonly t: Seconds;
  readonly value: T;
  readonly points: readonly (readonly number[])[];
}

const apart = (a: Sample<unknown>, b: Sample<unknown>): number =>
  Math.max(
    0,
    ...a.points.map((point, i) => Math.hypot(...point.map((v, c) => v - b.points[i]![c]!))),
  );

const ramerDouglasPeucker = <T>(run: readonly Sample<T>[], tolerance: number): number[] => {
  const kept = [0, run.length - 1];

  const split = (a: number, b: number): void => {
    let worst = -1;
    let error = tolerance;

    for (let i = a + 1; i < b; i++) {
      const u = (i - a) / (b - a);
      const [from, to, here] = [run[a]!, run[b]!, run[i]!];

      const miss = Math.max(
        ...here.points.map((point, p) =>
          Math.hypot(
            ...point.map(
              (v, c) => v - (from.points[p]![c]! + (to.points[p]![c]! - from.points[p]![c]!) * u),
            ),
          ),
        ),
      );

      if (miss > error) [worst, error] = [i, miss];
    }

    if (worst < 0) return;
    kept.push(worst);
    split(a, worst);
    split(worst, b);
  };

  split(0, run.length - 1);

  return kept.sort((a, b) => a - b);
};

const jump = <T>(
  a: Sample<T>,
  b: Sample<T>,
  at: (t: Seconds) => Sample<T>,
  tolerance: number,
): readonly [Sample<T>, Sample<T>] | undefined => {
  const floor = Math.max(tolerance, apart(a, b) / 1000);
  let [lo, hi] = [a, b];

  for (let i = 0; i < 20; i++) {
    const mid = at((lo.t + hi.t) / 2);
    [lo, hi] = apart(lo, mid) > apart(mid, hi) ? [lo, mid] : [mid, hi];

    if (apart(lo, hi) <= floor) return undefined;
  }

  return [lo, hi];
};

const simplified = <T>(
  window: Interval,
  read: (t: Seconds) => T,
  points: (value: T, t: Seconds) => readonly (readonly number[])[],
  options: { readonly step?: Seconds; readonly tolerance: number },
  what: string,
): Simplified<T> => {
  const { step = 0.05, tolerance } = options;
  const { start: from, over: duration } = closed(window, what);

  if (!Number.isFinite(step) || step <= 0)
    throw new SceneError(`${what} needs a positive step, got ${step}.`);

  if (!(tolerance >= 0 && Number.isFinite(tolerance)))
    throw new SceneError(`${what} needs a finite tolerance of 0 or more, got ${tolerance}.`);
  const edge = duration * NUDGE;

  const times = Array.from(
    { length: Math.ceil((duration - edge) / step) },
    (_, i) => i * step,
  ).concat(duration);

  const at = (t: Seconds): Sample<T> => {
    const value = read(t);

    return { t, value, points: points(value, t) };
  };

  const samples = times.map(at);
  const runs: Sample<T>[][] = [[samples[0]!]];

  for (const next of samples.slice(1)) {
    const run = runs.at(-1)!;
    const last = run.at(-1)!;
    const cut = apart(last, next) > tolerance ? jump(last, next, at, tolerance) : undefined;

    if (cut) {
      if (cut[0].t > last.t) run.push(cut[0]);
      runs.push(cut[1].t < next.t ? [cut[1], next] : [next]);
    } else run.push(next);
  }

  const kept: Kept<T>[] = [];

  runs.forEach((run, r) => {
    if (r > 0) kept.push({ start: from + run[0]!.t, over: 0, value: run[0]!.value });
    const keep = run.length > 1 ? ramerDouglasPeucker(run, tolerance) : [];

    for (let j = 1; j < keep.length; j++) {
      const [a, b] = [run[keep[j - 1]!]!, run[keep[j]!]!];

      kept.push({ start: from + a.t, over: b.t - a.t, value: b.value });
    }
  });

  return { first: samples[0]!.value, kept };
};

const roundTo = (precision: number | undefined, what: string): ((value: number) => number) => {
  if (precision === undefined) return (value) => value;

  if (!(Number.isInteger(precision) && precision >= 0))
    throw new SceneError(`${what} needs a whole, non-negative precision, got ${precision}.`);
  const factor = 10 ** precision;

  return (value) => Math.round(value * factor) / factor;
};

const measured = (outline: ReturnType<typeof outlineOf>) =>
  contoursOf(outline, outline.kind === "arc" ? 4 : undefined);

const structure = (outline: ReturnType<typeof outlineOf>): string =>
  `${outline.kind}:${measured(outline)
    .map((contour) => `${contour.curves.length}${contour.closed ? "z" : ""}`)
    .join(",")}`;

/** The track type for what a sample returns: numbers, points or geometry. */
export type Sampled<T> = T extends number ? number : T extends Vec ? Vec : Geometry;

const sampledTrack = <T extends number | Vec | Geometry>(
  sample: (t: Seconds) => T,
  window: Interval,
  options: SampledOptions,
): Track<Sampled<T>> => {
  const round = roundTo(options.precision, "sampled()");
  let shape: string | undefined;

  const read = (t: Seconds): number | Vec | Geometry => {
    const value = sample(t);

    if (isNumber(value)) return round(value);

    return isArray(value) ? [round(value[0]), round(value[1])] : value;
  };

  const points = (value: number | Vec | Geometry, t: Seconds): number[][] => {
    if (isNumber(value) || isArray(value)) {
      const each = isNumber(value) ? [value] : [...value];

      if (!each.every(Number.isFinite))
        throw new SceneError(
          `sampled() returned ${JSON.stringify(value)} at t=${t}; every sample needs finite numbers.`,
        );

      return [each];
    }

    const outline = outlineOf(value);
    const own = structure(outline);

    shape ??= own;

    if (own !== shape)
      throw new SceneError(
        `sampled() returned geometry at t=${t} that doesn't match the first sample (${own} against ${shape}). Return one kind with the same number of points every time.`,
      );

    return measured(outline).flatMap((contour) => [
      [...contour.start],
      ...contour.curves.flatMap((curve) => curve.map((point) => [...point])),
    ]);
  };

  const { first, kept } = simplified(window, read, points, options, "sampled()");
  let out = track<number | Vec | Geometry>(first);

  for (const { start, over, value } of kept)
    out = over > 0 ? out.to(value, span(start, over), ease.linear) : out.set(value, span(start));

  // SAFETY: every sample is a T, so every value of the track is a Sampled<T>.
  return out as Track<Sampled<T>>;
};

/** A record of tracks, one per key, each typed by what that key's sample returns. */
export type SampledAll<R extends Record<string, number | Vec | Geometry>> = {
  readonly [K in keyof R]: Track<Sampled<R[K]>>;
};

/**
 * Samples a function of time into a Track.
 *
 * Time is measured from the start of the window. The function's values are simplified with
 * Ramer-Douglas-Peucker under `tolerance`, so smooth motion keeps few keyframes.
 */
export const sampled = Object.assign(sampledTrack, {
  /**
   * Samples several quantities that come from one computation (an IK solve, say), calling `sample` once per
   * time and returning a Track per key.
   *
   * Policy: each key is simplified independently from the shared samples, so a gently moving key doesn't
   * inherit the keyframes of a fast one. The tracks match what `sampled` gives for that key alone, and the
   * output is never larger than one shared set of times. Geometry must keep the same shape per key.
   */
  all<R extends Record<string, number | Vec | Geometry>>(
    sample: (t: Seconds) => R,
    window: Interval,
    options: SampledOptions,
  ): SampledAll<R> {
    const cache = new Map<Seconds, R>();

    const at = (t: Seconds): R => {
      let record = cache.get(t);

      if (!record) cache.set(t, (record = sample(t)));

      return record;
    };

    const keys = Object.keys(at(0));

    const tracks: Record<string, ReturnType<typeof sampledTrack>> = {};

    for (const key of keys) {
      tracks[key] = sampledTrack(
        (t) => {
          const value = at(t)[key];

          if (value === undefined)
            throw new SceneError(
              `sampled.all() returned no "${key}" at t=${t}; every sample needs every key.`,
            );

          return value;
        },
        window,
        options,
      );
    }

    // SAFETY: `tracks` has exactly the keys of R, each built from that key's values, which are R[K].
    return tracks as SampledAll<R>;
  },
});
