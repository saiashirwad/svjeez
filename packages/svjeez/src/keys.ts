import { valueOf, type Target, type TargetValue, type TargetValues } from "./channels";
import { easeAt } from "./ease-at";
import { num } from "./format";
import { EPSILON, NUDGE, ease, type Ease, type Seconds, type Step } from "./motion";
import { NUMBER } from "./paths";

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
    } else if (contiguous && last.t + nudge > period + EPSILON) {
      // A cut at the very end: hold one nudge early so the new value still lands on the period.
      keys[keys.length - 1] = { ...last, t: last.t - nudge, ease: ease.hold };
      keys.push({ t: period, values: next, ease: ease.out });
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

export const isNumber = (value: TargetValue | undefined): value is number =>
  typeof value === "number";

/** `target` eased from `a` toward `b` by `amount`, as SMIL interpolates numbers and path data. Colors hold. */
const blend = (
  target: Target,
  a: TargetValue,
  b: TargetValue | undefined,
  amount: number,
): TargetValue => {
  if (isNumber(a) && isNumber(b)) return a + (b - a) * amount;

  if (target !== "d" || b === undefined) return a;
  // A d motion moves between paths with the same commands, so their numbers pair up one to one.
  const to = (String(b).match(NUMBER) ?? []).map(Number);
  let k = 0;

  // SAFETY: the replacement keeps every command letter of a, so the result is path data like a.
  return String(a).replace(NUMBER, (n) =>
    num(Number(n) + (to[k++]! - Number(n)) * amount),
  ) as TargetValue;
};

/** What the keys draw at `t`, as the browser plays them: the last key's values eased toward the next key's. */
export const valueAt = (keys: readonly Key[], t: Seconds): TargetValues => {
  const index = keys.findLastIndex((key) => key.t <= t + EPSILON);
  const [from, to] = [keys[index]!, keys[index + 1]];

  if (!to) return from.values;
  const amount = easeAt(from.ease, (t - from.t) / (to.t - from.t));

  // SAFETY: from.values and the result share their keys, each a Target name with a value of that target's kind.
  return Object.fromEntries(
    (Object.keys(from.values) as Target[]).map((target) => [
      target,
      blend(target, valueOf(from.values, target)!, valueOf(to.values, target), amount),
    ]),
  ) as TargetValues;
};
