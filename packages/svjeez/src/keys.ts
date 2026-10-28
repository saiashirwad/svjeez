import { valueOf, type Target, type TargetValues } from "./channels";
import { EPSILON, NUDGE, ease, type Ease, type Seconds, type Step } from "./motion";

export interface Key {
  readonly t: Seconds;
  readonly values: TargetValues;
  readonly ease: Ease;
}

export const snapPeriod = (period: Seconds, duration: Seconds): Seconds =>
  duration / Math.max(1, Math.round(duration / period));

// SAFETY: a and b are TargetValues, so their keys are Target names.
const same = (a: TargetValues, b: TargetValues): boolean =>
  (Object.keys(a) as Target[]).every((target) => valueOf(a, target) === valueOf(b, target));

export const keysOf = (
  initial: TargetValues,
  segments: readonly Step[],
  period: Seconds,
): Key[] => {
  const keys: Key[] = [{ t: 0, values: initial, ease: ease.out }];
  const nudge = period * NUDGE;
  let current = initial;

  for (const segment of segments) {
    const next = { ...current, ...segment.values };
    const last = keys.at(-1)!;
    const contiguous = segment.start < last.t + nudge;

    if (segment.over >= nudge) {
      if (contiguous) keys[keys.length - 1] = { ...last, ease: segment.ease };
      else keys.push({ t: segment.start, values: current, ease: segment.ease });
      keys.push({ t: segment.start + segment.over, values: next, ease: ease.out });
    } else if (keys.length === 1 && segment.start === 0) {
      keys[0] = { ...last, values: next };
    } else {
      keys[keys.length - 1] = { ...last, ease: ease.hold };
      keys.push({ t: contiguous ? last.t + nudge : segment.start, values: next, ease: ease.out });
    }

    current = next;
  }

  if (keys.at(-1)!.t < period - EPSILON) keys.push({ t: period, values: current, ease: ease.out });

  return keys;
};

export const moving = (keys: readonly Key[], index: number): boolean => {
  const next = keys[index + 1];

  return next !== undefined && !same(keys[index]!.values, next.values);
};

export const valueAt = (keys: readonly Key[], t: Seconds): TargetValues =>
  keys.findLast((key) => key.t <= t + EPSILON)!.values;
