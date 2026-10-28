import { groupBy } from "./layout/group";
import {
  CHANNELS,
  clamp,
  spec,
  type NumericChannel,
  type RestChannel,
  type TargetValues,
  type Values,
} from "./channels";
import type { NumericProperty } from "./properties";
import {
  NUDGE,
  ease,
  motion,
  type Ease,
  type Exact,
  type Motion,
  type Seconds,
  type Span,
} from "./motion";

type Shake = "x" | "y" | "rotate";

const span = ({ at, over }: Span, what: string): Span => {
  if (!Number.isFinite(at) || at < 0)
    throw new Error(`${what} needs a start of 0 or later, got ${at}.`);

  if (!Number.isFinite(over) || over <= 0)
    throw new Error(`${what} needs a positive duration, got ${over}.`);

  return { at, over };
};

// SAFETY: values is typed Values<RestChannel>, so its keys are rest channel names.
const rest = (values: Values<RestChannel>): Values<RestChannel> =>
  Object.fromEntries(
    (Object.keys(values) as RestChannel[]).map((channel) => [channel, CHANNELS[channel].identity]),
  );

/** Arrive from `from` to rest. Without `from` it is a fade-in. */
export function enter(at: Span, from?: undefined, curve?: Ease): Motion<"opacity">;
export function enter<V extends Values<RestChannel>>(
  at: Span,
  from: Exact<V, RestChannel>,
  curve?: Ease,
): Motion<keyof V & RestChannel>;
export function enter(
  at: Span,
  from: Values<RestChannel> = { opacity: 0 },
  curve: Ease = ease.out,
): Motion {
  const { at: start, over } = span(at, "enter()");

  return motion(from).at(start).to(rest(from), over, curve);
}

/** Leave rest for `to`. Without `to` it is a fade-out. */
export function exit(at: Span, to?: undefined, curve?: Ease): Motion<"opacity">;
export function exit<V extends Values<RestChannel>>(
  at: Span,
  to: Exact<V, RestChannel>,
  curve?: Ease,
): Motion<keyof V & RestChannel>;
export function exit(
  at: Span,
  to: Values<RestChannel> = { opacity: 0 },
  curve: Ease = ease.out,
): Motion {
  const { at: start, over } = span(at, "exit()");

  return motion().at(start).to(to, over, curve);
}

/** Stroke a shape on, 0 → 1. Render adds pathLength/dasharray and hides the round-cap dot at 0. */
export const draw = (at: Span, curve: Ease = ease.out): Motion<"draw"> => {
  const { at: start, over } = span(at, "draw()");

  return motion({ draw: 0 }).at(start).to({ draw: 1 }, over, curve);
};

/** Damped oscillation around rest. Deterministic. `rate` is direction changes per second. */
export function shake<V extends Values<Shake>>(
  at: Span,
  amplitude: Exact<V, Shake>,
  options: { readonly rate?: number } = {},
): Motion<keyof V & Shake> {
  const { at: start, over } = span(at, "shake()");
  const count = Math.max(2, Math.round(over * (options.rate ?? 12)));
  const amounts: Values<Shake> = amplitude;

  const swing = (k: number): Values<Shake> =>
    Object.fromEntries(
      Object.entries(amounts).map(([channel, amp]) => [
        channel,
        k === count ? 0 : (k % 2 ? -1 : 1) * amp * (1 - k / count),
      ]),
    );

  let track: Motion = motion();

  for (let k = 1; k <= count; k++)
    track = track.at(start + ((k - 1) * over) / count).to(swing(k), over / count, ease.linear);

  // SAFETY: every step was built from amplitude's keys, so track only moves channels in keyof V & Shake.
  return track as Motion<keyof V & Shake>;
}

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

const fnv1a = (text: string): number => {
  let hash = 0x811c9dc5;

  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193);

  return hash >>> 0;
};

const mulberry32 = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/** Seeded noise around rest, looping seamlessly. Values are baked at call time, so output is reproducible. */
export function wiggle<V extends Values<RestChannel>>(
  amplitude: Exact<V, RestChannel>,
  options: WiggleOptions,
): Motion<keyof V & RestChannel> {
  const period = options.period ?? 2;
  const count = Math.max(2, Math.round((options.rate ?? 8) * period));
  const random = mulberry32(fnv1a(String(options.seed)));
  const amounts: Values<RestChannel> = amplitude;
  // SAFETY: amounts is typed Values<RestChannel>, so its keys are rest channel names.
  const channels = (Object.keys(amounts) as RestChannel[]).sort();

  const samples = channels.map((channel) => {
    const amp = amounts[channel] ?? 0;
    const base = CHANNELS[channel].identity;

    return Array.from({ length: count }, () => clamp(channel, base + amp * (random() * 2 - 1)));
  });

  const at = (i: number): Values<RestChannel> =>
    Object.fromEntries(channels.map((channel, c) => [channel, samples[c]![i % count]]));

  let track: Motion = motion(at(0));

  for (let i = 1; i <= count; i++)
    track = track
      .at(((i - 1) * period) / count)
      .to(at(i), period / count, options.ease ?? ease.inOut);

  // SAFETY: every step was built from amplitude's keys, so the loop only moves keyof V & RestChannel.
  return track.loop(period) as Motion<keyof V & RestChannel>;
}

type LaneOf<C extends NumericChannel> = (typeof CHANNELS)[C]["lane"];

type Sampled = NumericChannel | NumericProperty;

/**
 * Per lane, the most the replay may stray from the samples, in the lane's own units. `x` and `y` share `translate`,
 * measured as px distance. A property is its own lane.
 */
type Tolerance = { readonly [L in LaneOf<NumericChannel> | NumericProperty]?: number };

type Covered<T extends Tolerance> = {
  readonly [C in NumericChannel as LaneOf<C> extends keyof T ? C : never]?: number;
} & {
  readonly [P in keyof T & NumericProperty]?: number;
};

export interface SampledOptions<T extends Tolerance> {
  readonly duration: Seconds;
  /** Seconds between samples before simplifying. Default 0.05. */
  readonly step?: Seconds;
  readonly tolerance: T;
}

const ramerDouglasPeucker = (
  samples: readonly (readonly number[])[],
  tolerance: number,
): number[] => {
  const kept = [0, samples.length - 1];

  const split = (a: number, b: number): void => {
    let worst = -1;
    let error = tolerance;

    for (let i = a + 1; i < b; i++) {
      const u = (i - a) / (b - a);

      const miss = Math.hypot(
        ...samples[i]!.map(
          (value, c) => value - (samples[a]![c]! + (samples[b]![c]! - samples[a]![c]!) * u),
        ),
      );

      if (miss > error) [worst, error] = [i, miss];
    }

    if (worst < 0) return;
    kept.push(worst);
    split(a, worst);
    split(worst, b);
  };

  split(0, samples.length - 1);

  return kept.sort((a, b) => a - b);
};

/**
 * Sample `(t) => values` densely, then keep only the keys each lane needs. Morphs come out dense and
 * holds sparse. Every channel or property returned needs a tolerance for its lane.
 */
export function sampled<T extends Tolerance, V extends Covered<T>>(
  sample: (t: Seconds) => V & { readonly [P in Exclude<keyof V, keyof Covered<T>>]: never },
  options: SampledOptions<T>,
): Motion<keyof V & Sampled> {
  const { duration, step = 0.05 } = options;

  if (!Number.isFinite(duration) || duration <= 0)
    throw new Error(`sampled() needs a positive duration, got ${duration}.`);

  if (!Number.isFinite(step) || step <= 0)
    throw new Error(`sampled() needs a positive step, got ${step}.`);
  const edge = duration * NUDGE;

  const times = Array.from(
    { length: Math.ceil((duration - edge) / step) },
    (_, i) => i * step,
  ).concat(duration);

  // SAFETY: sample returns V, keyed by numeric channel or property names; the check below requires every frame to have the same finite keys.
  const frames = times.map(sample) as Partial<Record<Sampled, number>>[];

  // SAFETY: a frame's keys are Sampled names, since frames come from sample() as checked just above.
  const present = (frame: Partial<Record<Sampled, number>>) =>
    (Object.keys(frame) as Sampled[]).filter((channel) => Number.isFinite(frame[channel])).sort();

  const channels = present(frames[0]!);
  frames.forEach((frame, i) => {
    if (present(frame).join() !== channels.join())
      throw new Error(
        `sampled() returned different channels at t=${times[i]} than at t=0; every sample needs the same keys, each a finite number.`,
      );
  });
  const lanes = groupBy(channels, (channel) => spec(channel).lane);
  // SAFETY: every frame passed the same-keys check above, so frame 0 is an object of Sampled names to numbers.
  let track: Motion = motion(frames[0]! as TargetValues);

  for (const [lane, members] of lanes) {
    // SAFETY: tolerance is keyed by lane names, and lane comes from spec(), so the lookup is a tolerance or undefined, which the check below rejects.
    const tolerance = (options.tolerance as Record<string, number | undefined>)[lane];

    if (tolerance === undefined || !(tolerance >= 0))
      throw new Error(
        `sampled() needs a non-negative tolerance for \`${lane}\`, got ${tolerance}.`,
      );

    const kept = ramerDouglasPeucker(
      frames.map((frame) => members.map((channel) => frame[channel]!)),
      tolerance,
    );

    for (let j = 1; j < kept.length; j++) {
      const [from, to] = [kept[j - 1]!, kept[j]!];
      const values = Object.fromEntries(members.map((channel) => [channel, frames[to]![channel]]));
      // SAFETY: members are channels of this lane, and every frame holds each of them as a number, so values is a TargetValues.
      track = track
        .at(times[from]!)
        .to(values as TargetValues, times[to]! - times[from]!, ease.linear);
    }
  }

  // SAFETY: every step was built from frame keys that are Sampled names, so track only moves keyof V & Sampled.
  return track as Motion<keyof V & Sampled>;
}
