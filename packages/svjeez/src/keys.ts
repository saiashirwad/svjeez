import { valueOf, type Target, type TargetValue, type TargetValues } from "./channels";
import { easeAt, splitEase } from "./ease-at";
import { EPSILON, NUDGE, ease, type Ease, type Seconds, type Step } from "./motion";
import { blendPaths } from "./paths";

/** Most keys one lane may carry. */
export const MAX_KEYS = 2000;

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

/** `blend`, but a value it cannot compute (a colour mid-transition) throws instead of holding. `where` starts the error. */
export const blendStrict = (
  target: Target,
  a: TargetValue,
  b: TargetValue | undefined,
  amount: number,
  where: string,
): TargetValue => {
  if (b === undefined || a === b) return a;

  if (isNumber(a) && isNumber(b)) return a + (b - a) * amount;

  if (target === "d") return blendPaths(String(a), String(b), amount);

  throw new Error(
    `${where} stops ${target} partway through a transition from ${a} to ${b}, and only numbers and paths can be cut there. Cut it between transitions.`,
  );
};

/** `target` eased from `a` toward `b` by `amount`, as SMIL interpolates numbers and path data. Colors hold. */
const blend = (
  target: Target,
  a: TargetValue,
  b: TargetValue | undefined,
  amount: number,
): TargetValue => {
  if (isNumber(a) && isNumber(b)) return a + (b - a) * amount;

  if (target !== "d" || b === undefined) return a;

  return blendPaths(String(a), String(b), amount);
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

/** `keys` with one at `t`, where the lane's own curve passes through it. The two halves of a cut transition draw the whole. */
const splitAt = (keys: readonly Key[], t: Seconds, where: string): Key[] => {
  const index = keys.findLastIndex((key) => key.t <= t + EPSILON);
  const from = keys[index]!;
  const to = keys[index + 1];

  if (!to || Math.abs(from.t - t) <= EPSILON) return [...keys];

  const progress = (t - from.t) / (to.t - from.t);
  const movesTo = !same(from.values, to.values);
  const [first, second] = movesTo ? splitEase(from.ease, progress, where) : [from.ease, from.ease];
  const amount = easeAt(from.ease, progress);

  // SAFETY: the entries are from's own targets, each paired with a TargetValue from blendStrict, so the result is a TargetValues.
  const values = Object.fromEntries(
    (Object.keys(from.values) as Target[]).map((target) => [
      target,
      blendStrict(target, valueOf(from.values, target)!, valueOf(to.values, target), amount, where),
    ]),
  ) as TargetValues;

  return [
    ...keys.slice(0, index),
    { ...from, ease: first },
    { t, values, ease: second },
    ...keys.slice(index + 1),
  ];
};

/**
 * The same keys played `shift` later, wrapping around the end of the `period`: what a loop does when the clip that holds
 * it starts `shift` into the loop. A jump where the loop closes moves to the wrap.
 */
export const rotateKeys = (
  keys: readonly Key[],
  shift: Seconds,
  period: Seconds,
  where: string,
): Key[] => {
  const nudge = period * NUDGE;
  const by = ((shift % period) + period) % period;

  if (by < nudge * 4 || period - by < nudge * 4) return [...keys];

  const wrap = period - by;
  const split = splitAt(keys, wrap, where);

  const tail = split
    .filter((key) => key.t >= wrap - EPSILON)
    .map((key) => ({ ...key, t: key.t - wrap }));

  const front = split
    .filter((key) => key.t <= wrap + EPSILON)
    .map((key) => ({ ...key, t: key.t + by }));

  const [joinEnd, joinStart] = [tail.at(-1)!, front[0]!];

  if (same(joinEnd.values, joinStart.values)) return [...tail.slice(0, -1), ...front];

  return [...tail.slice(0, -1), { ...joinEnd, t: by - nudge, ease: ease.hold }, ...front];
};
