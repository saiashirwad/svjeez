import { easeAt } from "../ease-at";
import { EPSILON, NUDGE, ease, type Seconds } from "../motion";
import type { Animated, Key, Lane, Vec } from "./ir";
import { isLane } from "./lane";
import { fitted, type RunKey, type Sample } from "./spring";

/**
 * Reading lanes back at any time, and writing a value that is only known by sampling (a point that follows a moving
 * node) as a lane of few keys.
 */
export type Blend<T> = (a: T, b: T, amount: number) => T;

export const blendNumber: Blend<number> = (a, b, u) => a + (b - a) * u;

export const blendVec: Blend<Vec> = (a, b, u) => [
  a[0] + (b[0] - a[0]) * u,
  a[1] + (b[1] - a[1]) * u,
];

/** Where a lane's period puts a time on the scene's clock. The end of a period is its own last moment, not the next one's first. */
const local = (t: Seconds, period: Seconds | undefined): Seconds =>
  period === undefined ? t : t - period * Math.max(0, Math.ceil(t / period - EPSILON) - 1);

/** The value at `t`, as every backend draws it: the later key's ease shapes the way between two keys. */
export const valueAt = <T>(value: Animated<T>, t: Seconds, blend: Blend<T>): T => {
  if (!isLane(value)) return value;
  const { keys } = value;
  const at = local(t, value.period);
  const index = keys.findLastIndex((key) => key.t <= at);

  if (index < 0) return keys[0].value;
  const [from, to] = [keys[index]!, keys[index + 1]];

  if (!to) return from.value;

  return blend(
    from.value,
    to.value,
    easeAt(to.ease ?? ease.linear, (at - from.t) / (to.t - from.t)),
  );
};

/** Every time in `[0, duration]` where one of `values` has a key: the joins a sampled lane must keep. */
export const breaksOf = (values: readonly Animated<unknown>[], duration: Seconds): Seconds[] => {
  const times = [0, duration];

  for (const value of values) {
    if (!isLane(value)) continue;
    const period = value.period ?? duration;

    for (let start = 0; start < duration - EPSILON; start += period)
      for (const key of value.keys)
        if (start + key.t <= duration + EPSILON) times.push(start + key.t);
  }

  return times
    .map((t) => Math.min(duration, Math.max(0, t)))
    .sort((a, b) => a - b)
    .filter((t, index, all) => index === 0 || t - all[index - 1]! > EPSILON);
};

/** Samples a second between two joins. Enough that a fitted ease never misses a turn. */
const RATE = 120;

const far = (a: readonly number[], b: readonly number[], tolerance: number): boolean =>
  Math.hypot(...a.map((value, c) => value - b[c]!)) > tolerance;

const withVelocity = (
  times: readonly Seconds[],
  values: readonly (readonly number[])[],
): Sample[] =>
  times.map((t, i) => {
    const [a, b] = [Math.max(0, i - 1), Math.min(times.length - 1, i + 1)];

    return {
      t,
      values: values[i]!,
      velocity: values[i]!.map(
        (_, c) => (values[b]![c]! - values[a]![c]!) / (times[b]! - times[a]!),
      ),
    };
  });

/**
 * A value known only at each moment, written as keys over the whole scene that stay within `tolerance` of it. Between
 * two joins it is sampled densely and fitted with eases; at a join where it jumps, the keys cut. Components listed in
 * `turns` are angles in degrees, kept continuous rather than wrapped.
 */
export const follow = (
  at: (t: Seconds) => readonly number[],
  breaks: readonly Seconds[],
  tolerance: number,
  turns: readonly number[] = [],
): RunKey[] => {
  const duration = breaks.at(-1)!;
  const nudge = duration * NUDGE;
  let last: readonly number[] | undefined;

  const read = (t: Seconds): readonly number[] => {
    const values = [...at(t)];

    for (const c of turns)
      if (last) values[c] = values[c]! - 360 * Math.round((values[c]! - last[c]!) / 360);
    last = values;

    return values;
  };

  const keys: RunKey[] = [];

  breaks.slice(1).forEach((end, index) => {
    const start = breaks[index]!;
    const count = Math.max(2, Math.ceil((end - start) * RATE));
    const times = Array.from({ length: count + 1 }, (_, i) => start + ((end - start) * i) / count);
    const final = index + 2 === breaks.length;
    const values = times.map((t, i) => read(i === count && !final ? end - nudge : t));
    const after = final ? values.at(-1)! : read(end);
    const jumps = far(values.at(-1)!, after, tolerance);

    if (jumps) times[count] = end - nudge;
    else values[count] = after;
    last = after;

    const run = fitted(withVelocity(times, values), tolerance);
    const before = keys.at(-1);

    if (before && before.t < start - EPSILON)
      keys.push({ t: start, values: run[0]!.values, ease: ease.hold });

    keys.push(...(before ? run.slice(1) : run));
  });

  return keys.filter((key, index) => {
    const [before, next] = [keys[index - 1], keys[index + 1]];

    return (
      !before || !next || far(before.values, key.values, 1e-9) || far(key.values, next.values, 1e-9)
    );
  });
};

/** Keys as a lane of `T`, or the value itself when nothing changes. */
export const laneFrom = <T>(
  keys: readonly RunKey[],
  join: (values: readonly number[]) => T,
): Animated<T> => {
  const [first, second, ...rest] = keys.map((key, index): Key<T> =>
    index === 0
      ? { t: key.t, value: join(key.values) }
      : { t: key.t, value: join(key.values), ease: key.ease ?? ease.linear },
  );

  if (!first || !second || keys.every((key) => !far(key.values, keys[0]!.values, 1e-9)))
    return join(keys[0]!.values);

  const lane: Lane<T> = { kind: "lane", keys: [first, second, ...rest] };

  return lane;
};

/** A lane's keys on the scene's clock across the whole scene, its period written out. */
export const unrolled = <T>(lane: Lane<T>, duration: Seconds): Key<T>[] => {
  const period = lane.period ?? duration;
  const out: Key<T>[] = [];

  for (let start = 0; start < duration - EPSILON; start += period)
    for (const key of lane.keys) {
      const t = start + key.t;

      if (t > duration + EPSILON || (out.length > 0 && t <= out.at(-1)!.t + EPSILON)) continue;
      out.push({ ...key, t });
    }

  return out;
};
