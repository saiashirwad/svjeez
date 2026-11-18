import { NUDGE, ease, type Ease, type Seconds } from "../motion";
import { random } from "../random";
import { checkWindow, span, type Span, type When } from "../span";
import { contoursOf } from "./geometry";
import type { Vec } from "./ir";
import { pair } from "./lane";
import { motion, track, type LayerValues, type Motion, type Track } from "./track";
import { outlineOf, type Geometry } from "./values";

const REST = { offset: [0, 0], rotate: 0, scale: 1, opacity: 1 } as const;

const closed = ({ at, over }: Span, what: string): Span => {
  checkWindow(at, over, what);

  return { at, over };
};

// SAFETY: values is a LayerValues, so its own keys are layer value names.
const named = (values: LayerValues): (keyof LayerValues)[] =>
  Object.keys(values) as (keyof LayerValues)[];

const rest = (values: LayerValues): LayerValues =>
  Object.fromEntries(named(values).map((name) => [name, REST[name]]));

/** Arrive from `from` to rest. Without `from` it is a fade-in. */
export const enter = (
  when: Span,
  from: LayerValues = { opacity: 0 },
  curve: Ease = ease.out,
): Motion => {
  const { at, over } = closed(when, "enter()");

  return motion(from).to(rest(from), span(at, over), curve);
};

/** Leave rest for `to`. Without `to` it is a fade-out. */
export const exit = (
  when: Span,
  to: LayerValues = { opacity: 0 },
  curve: Ease = ease.out,
): Motion => {
  const { at, over } = closed(when, "exit()");

  return motion().to(to, span(at, over), curve);
};

export interface WiggleOptions {
  /** Pins the noise. Change it to reroll. */
  readonly seed: string | number;
  /** Samples per second. Default 8. */
  readonly rate?: number;
  /** Shape between samples. `ease.inOut` (default) drifts; `ease.hold` jitters. */
  readonly ease?: Ease;
  /** Loop length, snapped to divide the scene. Default 2s. */
  readonly period?: Seconds;
}

/** Seeded noise around rest, looping seamlessly. Values are baked at call time, so output is reproducible. */
export const wiggle = (amplitude: LayerValues, options: WiggleOptions): Motion => {
  const period = options.period ?? 2;
  const rate = options.rate ?? 8;

  if (!Number.isFinite(period) || period <= 0)
    throw new Error(`wiggle() needs a positive period, got ${period}.`);

  if (!(rate > 0 && Number.isFinite(rate)))
    throw new Error(`wiggle() needs a positive rate, got ${rate}.`);
  const count = Math.max(2, Math.round(rate * period));
  const next = random(String(options.seed));

  const noise = (amp: number): number[] =>
    Array.from({ length: count }, () => amp * (next() * 2 - 1));

  const opacity = amplitude.opacity === undefined ? undefined : noise(amplitude.opacity);
  const rotate = amplitude.rotate === undefined ? undefined : noise(amplitude.rotate);
  const scale = amplitude.scale === undefined ? undefined : pair(amplitude.scale).map(noise);
  const offset = amplitude.offset === undefined ? undefined : amplitude.offset.map(noise);

  const at = (index: number): LayerValues => {
    const i = index % count;

    return {
      ...(opacity && { opacity: Math.min(1, Math.max(0, 1 + opacity[i]!)) }),
      ...(rotate && { rotate: rotate[i]! }),
      ...(scale && { scale: [1 + scale[0]![i]!, 1 + scale[1]![i]!] as const }),
      ...(offset && { offset: [offset[0]![i]!, offset[1]![i]!] as const }),
    };
  };

  let layer = motion(at(0));

  for (let i = 1; i <= count; i++)
    layer = layer.to(
      at(i),
      span(((i - 1) * period) / count, period / count),
      options.ease ?? ease.inOut,
    );

  return layer.loop(period);
};

/** A `trim` that strokes the outline on, from nothing to all of it. */
export const draw = (when: Span, curve: Ease = ease.out): Track<Vec> => {
  const { at, over } = closed(when, "draw()");

  return track([0, 0]).to([0, 1], span(at, over), curve);
};

/** A `rotate` that turns once every `every` seconds, forever. */
export const spin = ({ every }: { readonly every: Seconds }): Track<number> => {
  if (!(every > 0 && Number.isFinite(every)))
    throw new Error(`spin() needs a positive every, got ${every}.`);

  return track(0).to(360, span(0, every), ease.linear).loop(every);
};

const isList = (spans: When | readonly When[]): spans is readonly When[] => Array.isArray(spans);

const merge = (list: readonly When[]): [number, number][] => {
  const out: [number, number][] = [];

  for (const { at, over } of [...list].sort((a, b) => a.at - b.at)) {
    const until = over === undefined ? Infinity : at + over;
    const last = out.at(-1);

    if (last && at <= last[1]) last[1] = Math.max(last[1], until);
    else out.push([at, until]);
  }

  return out;
};

/**
 * An `opacity` that is 1 during each span and 0 outside. Fades sit inside the span. Overlapping or touching spans
 * merge; a span shorter than two fades shrinks them. `fade: 0` cuts. A span without `over` stays to the end.
 */
export const show = (
  spans: When | readonly When[],
  { fade = 0.3 }: { readonly fade?: Seconds } = {},
): Track<number> => {
  const list: readonly When[] = isList(spans) ? spans : [spans];

  if (!(fade >= 0 && Number.isFinite(fade)))
    throw new Error(`show() needs a fade of 0 or more, got ${fade}.`);

  for (const { at, over } of list) {
    if (!Number.isFinite(at) || at < 0)
      throw new Error(`show() needs a start of 0 or later, got ${at}.`);

    if (over !== undefined && !(over > 0 && Number.isFinite(over)))
      throw new Error(`show() needs a positive over, or none to stay to the end, got ${over}.`);
  }

  const merged = merge(list);
  let shown = track(fade === 0 && merged[0]?.[0] === 0 ? 1 : 0);

  for (const [a, b] of merged) {
    const f = Math.min(fade, (b - a) / 2);

    if (f > 0) shown = shown.to(1, span(a, f));
    else if (a > 0) shown = shown.set(1, a);

    if (b === Infinity) continue;
    shown = f > 0 ? shown.to(0, span(b - f, f)) : shown.set(0, b);
  }

  return shown;
};

export interface ShakeAmplitude {
  /** How far it swings first, across and down. */
  readonly offset?: Vec;
  /** How far it turns first, in degrees. */
  readonly rotate?: number;
}

/** A damped swing around rest, back and forth `rate` times a second (default 12), settling at rest by the span's end. */
export const shake = (
  when: Span,
  amplitude: ShakeAmplitude,
  { rate = 12 }: { readonly rate?: number } = {},
): Motion => {
  const { at, over } = closed(when, "shake()");

  if (!(rate > 0 && Number.isFinite(rate)))
    throw new Error(`shake() needs a positive rate, got ${rate}.`);
  const count = Math.max(2, Math.round(over * rate));

  const swing = (k: number): LayerValues => {
    const share = k === count ? 0 : (k % 2 ? -1 : 1) * (1 - k / count);
    const { offset, rotate } = amplitude;

    return {
      ...(offset && { offset: [offset[0] * share, offset[1] * share] as const }),
      ...(rotate !== undefined && { rotate: rotate * share }),
    };
  };

  let layer = motion();

  for (let k = 1; k <= count; k++)
    layer = layer.to(swing(k), span(at + ((k - 1) * over) / count, over / count), ease.linear);

  return layer;
};

export interface SampledOptions {
  /** Seconds between samples before simplifying. Default 0.05. */
  readonly step?: Seconds;
  /**
   * How far the straight run between two kept keys may stray from a sample, in the value's own units: px for a point,
   * and for a geometry the farthest any of its points strays.
   */
  readonly tolerance: number;
  /** Decimal places a number or point is rounded to before simplifying. Default none. */
  readonly precision?: number;
}

/** One kept step: a transition over `over` seconds, or a cut when `over` is 0. */
interface Kept<T> {
  readonly at: Seconds;
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

/** How far `b`'s farthest point is from `a`'s. */
const apart = (a: Sample<unknown>, b: Sample<unknown>): number =>
  Math.max(
    0,
    ...a.points.map((point, i) => Math.hypot(...point.map((v, c) => v - b.points[i]![c]!))),
  );

/** The samples to keep so straight runs between them stay within `tolerance` of every sample. */
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

/** Narrows a jump between two samples down to the two closest moments either side of it, or none if it is a slope. */
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

/**
 * Samples a function densely and keeps only the steps a viewer can tell apart: morphs come out dense, holds sparse, and
 * a jump comes out as a cut. `points` reads a value as points to measure, and throws on one that can't follow the first.
 */
const simplified = <T>(
  window: Span,
  read: (t: Seconds) => T,
  points: (value: T, t: Seconds) => readonly (readonly number[])[],
  options: { readonly step?: Seconds; readonly tolerance: number },
  what: string,
): Simplified<T> => {
  const { step = 0.05, tolerance } = options;
  const { at: from, over: duration } = closed(window, what);

  if (!Number.isFinite(step) || step <= 0)
    throw new Error(`${what} needs a positive step, got ${step}.`);

  if (!(tolerance >= 0 && Number.isFinite(tolerance)))
    throw new Error(`${what} needs a finite tolerance of 0 or more, got ${tolerance}.`);
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
    if (r > 0) kept.push({ at: from + run[0]!.t, over: 0, value: run[0]!.value });
    const keep = run.length > 1 ? ramerDouglasPeucker(run, tolerance) : [];

    for (let j = 1; j < keep.length; j++) {
      const [a, b] = [run[keep[j - 1]!]!, run[keep[j]!]!];

      kept.push({ at: from + a.t, over: b.t - a.t, value: b.value });
    }
  });

  return { first: samples[0]!.value, kept };
};

const roundTo = (precision: number | undefined, what: string): ((value: number) => number) => {
  if (precision === undefined) return (value) => value;

  if (!(Number.isInteger(precision) && precision >= 0))
    throw new Error(`${what} needs a whole, non-negative precision, got ${precision}.`);
  const factor = 10 ** precision;

  return (value) => Math.round(value * factor) / factor;
};

const isNumber = (value: number | Vec | Geometry): value is number => typeof value === "number";

const isScalar = (value: number | Vec): value is number => typeof value === "number";

const isVec = (value: Vec | Geometry): value is Vec => Array.isArray(value);

/** A geometry as contours to measure. An arc always has four pieces, so arcs of any sweep compare point by point. */
const measured = (outline: ReturnType<typeof outlineOf>) =>
  contoursOf(outline, outline.kind === "arc" ? 4 : undefined);

/** A geometry's kind and the shape of its contours: two samples with the same one blend point by point. */
const structure = (outline: ReturnType<typeof outlineOf>): string =>
  `${outline.kind}:${measured(outline)
    .map((contour) => `${contour.curves.length}${contour.closed ? "z" : ""}`)
    .join(",")}`;

/**
 * A track sampled from a function of time: `sample` gets time from 0 to the span's `over`, and the track plays it from
 * the span's `at`, holding the first value before and the last after. Only the keys the tolerance needs are kept, as
 * linear steps, and a jump becomes a cut. A geometry sample keeps its kind and its number of points throughout.
 */
export function sampled(
  window: Span,
  sample: (t: Seconds) => number,
  options: SampledOptions,
): Track<number>;
export function sampled(
  window: Span,
  sample: (t: Seconds) => Vec,
  options: SampledOptions,
): Track<Vec>;
export function sampled(
  window: Span,
  sample: (t: Seconds) => Geometry,
  options: SampledOptions,
): Track<Geometry>;
export function sampled(
  window: Span,
  sample: (t: Seconds) => number | Vec | Geometry,
  options: SampledOptions,
): Track<number | Vec | Geometry> {
  const round = roundTo(options.precision, "sampled()");
  let shape: string | undefined;

  const read = (t: Seconds): number | Vec | Geometry => {
    const value = sample(t);

    if (isNumber(value)) return round(value);

    return isVec(value) ? [round(value[0]), round(value[1])] : value;
  };

  const points = (value: number | Vec | Geometry, t: Seconds): number[][] => {
    if (isNumber(value) || isVec(value)) {
      const each = isNumber(value) ? [value] : [...value];

      if (!each.every(Number.isFinite))
        throw new Error(
          `sampled() returned ${JSON.stringify(value)} at t=${t}; every sample needs finite numbers.`,
        );

      return [each];
    }

    const outline = outlineOf(value);
    const own = structure(outline);

    shape ??= own;

    if (own !== shape)
      throw new Error(
        `sampled() returned geometry at t=${t} that doesn't match the first sample (${own} against ${shape}). Return one kind with the same number of points every time.`,
      );

    return measured(outline).flatMap((contour) => [
      [...contour.start],
      ...contour.curves.flatMap((curve) => curve.map((point) => [...point])),
    ]);
  };

  const { first, kept } = simplified(window, read, points, options, "sampled()");
  let out = track<number | Vec | Geometry>(first);

  for (const { at, over, value } of kept)
    out = over > 0 ? out.to(value, span(at, over), ease.linear) : out.set(value, at);

  return out;
}

export interface SampledMotionOptions {
  /** Seconds between samples before simplifying. Default 0.05. */
  readonly step?: Seconds;
  /** One tolerance for each value the function returns, in its own units: px for `offset`, degrees for `rotate`. */
  readonly tolerance: { readonly [K in keyof LayerValues]?: number };
  /** Decimal places each value is rounded to before simplifying. Default none. */
  readonly precision?: number;
}

const LAYER_NAMES = ["offset", "rotate", "scale", "opacity"] as const;

/**
 * A motion layer sampled from a function of time, each value it returns simplified with its own tolerance, as
 * `sampled()` does for one track.
 */
sampled.motion = (
  window: Span,
  sample: (t: Seconds) => LayerValues,
  options: SampledMotionOptions,
): Motion => {
  const round = roundTo(options.precision, "sampled.motion()");
  const names = LAYER_NAMES.filter((name) => sample(0)[name] !== undefined);

  const lanes = names.map((name) => {
    const tolerance = options.tolerance[name];

    if (tolerance === undefined)
      throw new Error(
        `sampled.motion() needs a tolerance for \`${name}\`, which the function returns.`,
      );

    const read = (t: Seconds): readonly number[] => {
      const value = sample(t)[name];

      if (value === undefined)
        throw new Error(
          `sampled.motion() returned no \`${name}\` at t=${t}; every sample needs the same values.`,
        );
      const each = isScalar(value) ? (name === "scale" ? [value, value] : [value]) : [...value];

      if (!each.every(Number.isFinite))
        throw new Error(
          `sampled.motion() returned ${JSON.stringify(value)} for \`${name}\` at t=${t}; it needs finite numbers.`,
        );

      return each.map(round);
    };

    const valueOf = (each: readonly number[]): LayerValues =>
      name === "rotate" || name === "opacity"
        ? { [name]: each[0]! }
        : { [name]: [each[0]!, each[1]!] as const };

    const { first, kept } = simplified(
      window,
      read,
      (each) => [each],
      { ...options, tolerance },
      "sampled.motion()",
    );

    return {
      first: valueOf(first),
      kept: kept.map((step) => ({ ...step, value: valueOf(step.value) })),
    };
  });

  let layer = motion(Object.assign({}, ...lanes.map((lane) => lane.first)));

  for (const { kept } of lanes)
    for (const { at, over, value } of kept)
      layer = over > 0 ? layer.to(value, span(at, over), ease.linear) : layer.set(value, at);

  return layer;
};
