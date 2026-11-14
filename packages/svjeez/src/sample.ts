import {
  spec,
  valueOf,
  type NumericChannel,
  type Target,
  type TargetValue,
  type TargetValues,
} from "./channels";
import { isNumber, keysOf, snapPeriod, valueAt } from "./keys";
import { dataOf, type Motion, type Seconds, type Stack } from "./motion";
import type { NumericProperty } from "./properties";

export interface SampleOptions {
  /** The scene's `duration`, as passed to `render()`. */
  readonly duration: Seconds;
  /** The scene's `loop`, as passed to `render()`. False holds the last frame after `duration`. Default true. */
  readonly loop?: boolean;
}

type NumericTarget = NumericChannel | NumericProperty;

/** How two layers of a stack add up on one channel, for the channels that stack. */
const STACKED: Partial<Record<Target, (outer: number, inner: number) => number>> = {
  opacity: (a, b) => a * b,
  scale: (a, b) => a * b,
  rotate: (a, b) => a + b,
  x: (a, b) => a + b,
  y: (a, b) => a + b,
  blur: Math.hypot,
};

const layerAt = (layer: Motion, t: Seconds, { duration, loop = true }: SampleOptions) => {
  const data = dataOf(layer);
  const period = data.period ?? duration;
  const snapped = data.period === undefined ? duration : snapPeriod(data.period, duration);
  const scene = loop ? ((t % duration) + duration) % duration : Math.min(duration, Math.max(0, t));
  const local = !loop && scene === duration ? period : ((scene % snapped) / snapped) * period;

  // SAFETY: motion() validated every key of initial and of each step as a Target name.
  const touched = [
    ...new Set([
      ...Object.keys(data.initial),
      ...data.steps.flatMap((step) => Object.keys(step.values)),
    ]),
  ] as Target[];

  return touched.flatMap((target): (readonly [Target, number])[] => {
    if (!isNumber(spec(target).value)) return [];
    const start = valueOf(data.initial, target) ?? spec(target).identity;

    if (!isNumber(start))
      throw new Error(
        `sample() needs a starting value for ${target}. Pass it to motion({ ${target}: … }).`,
      );

    // SAFETY: the one entry pairs target with a value read for it, so the object is a TargetValues.
    const only = (value: TargetValue | undefined) => ({ [target]: value }) as TargetValues;

    const keys = keysOf(
      only(start),
      data.steps
        .flatMap((step) =>
          target in step.values ? [{ ...step, values: only(valueOf(step.values, target)) }] : [],
        )
        .sort((a, b) => a.start - b.start),
      period,
    );

    // SAFETY: every key holds this numeric target, from start or a step of the same target, so valueAt blends a number.
    return [[target, valueOf(valueAt(keys, local), target) as number]];
  });
};

/**
 * What `stack` draws at scene time `t`, as the browser plays it: loops snap and repeat as `render()` runs them, and
 * every transition is eased. Numeric channels and properties only. Layers add up the way they stack: `x`, `y` and
 * `rotate` add, `opacity` and `scale` multiply. A layer that turns or scales outside one that moves is not
 * composed as a matrix, so read those layers one at a time.
 */
export function sample<K extends Target>(
  motion: Motion<K>,
  t: Seconds,
  options: SampleOptions,
): { readonly [P in Extract<K, NumericTarget>]: number };
/** A stack's channels are optional, since a falsy layer adds none. */
export function sample<K extends Target>(
  stack: Stack<K>,
  t: Seconds,
  options: SampleOptions,
): { readonly [P in Extract<K, NumericTarget>]?: number };
export function sample(
  stack: Stack,
  t: Seconds,
  options: SampleOptions,
): { readonly [target: string]: number } {
  if (!(options.duration > 0))
    throw new Error(`sample() needs a positive duration, got ${options.duration}.`);

  if (!Number.isFinite(t)) throw new Error(`sample() needs a finite time, got ${t}.`);
  const layers = (Array.isArray(stack) ? stack : [stack]).filter((layer) => !!layer);
  const out = new Map<Target, number>();

  for (const layer of layers)
    for (const [target, value] of layerAt(layer, t, options)) {
      const known = out.get(target);
      const add = STACKED[target];

      if (known !== undefined && !add)
        throw new Error(
          `Two motions both animate \`${target}\` in sample(): put them in one motion().`,
        );
      out.set(target, known === undefined ? value : add!(known, value));
    }

  return Object.fromEntries(out);
}
