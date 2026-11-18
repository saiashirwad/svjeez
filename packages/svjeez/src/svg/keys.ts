import { valueOf, type Channel, type ChannelValue, type ChannelValues } from "./channels";
import { easeAt } from "../model/ease-at";
import { EPSILON, type Ease, type Seconds } from "../model/time";
import { blendPaths } from "../model/paths";

export const MAX_KEYS = 2000;

export interface Key {
  readonly t: Seconds;
  readonly values: ChannelValues;
  readonly ease: Ease;
}

export const snapPeriod = (period: Seconds, duration: Seconds): Seconds =>
  duration / Math.max(1, Math.round(duration / period));

// SAFETY: a and b are ChannelValues, so their keys are Channel names.
const same = (a: ChannelValues, b: ChannelValues): boolean =>
  (Object.keys(a) as Channel[]).every((target) => valueOf(a, target) === valueOf(b, target));

const FOLD_LANES = new Set(["translate", "rotate", "width", "height"]);
const FOLD_TOLERANCE = 0.1;

export const foldKeys = (lane: string, keys: readonly Key[]): readonly Key[] => {
  if (!FOLD_LANES.has(lane) || keys.length < 3) return keys;
  // SAFETY: Object.keys of a key's values lists its targets, and the values are keyed by Channel.
  const targets = Object.keys(keys[0]!.values) as Channel[];

  const nums = keys.map((key) =>
    targets.map((target) => {
      const value = valueOf(key.values, target);

      // SAFETY: Number.isFinite is true only for a number, so the value is one when it passes.
      return Number.isFinite(value) ? (value as number) : undefined;
    }),
  );

  if (nums.some((row) => row.some((value) => value === undefined))) return keys;

  const linear = (index: number): boolean => keys[index]!.ease.kind === "linear";

  const fits = (from: number, to: number): boolean => {
    if (!linear(from)) return false;
    const span = keys[to]!.t - keys[from]!.t;

    for (let k = from + 1; k < to; k++) {
      if (!linear(k)) return false;
      const amount = span > 0 ? (keys[k]!.t - keys[from]!.t) / span : 0;

      for (let c = 0; c < targets.length; c++) {
        const [a, b] = [nums[from]![c]!, nums[to]![c]!];

        if (Math.abs(a + (b - a) * amount - nums[k]![c]!) > FOLD_TOLERANCE) return false;
      }
    }

    return true;
  };

  const kept: Key[] = [keys[0]!];
  let anchor = 0;

  while (anchor < keys.length - 1) {
    let next = anchor + 1;

    while (next + 1 < keys.length && fits(anchor, next + 1)) next++;
    kept.push(keys[next]!);
    anchor = next;
  }

  return kept.length === keys.length ? keys : kept;
};

export const moving = (keys: readonly Key[], index: number): boolean => {
  const next = keys[index + 1];

  return next !== undefined && !same(keys[index]!.values, next.values);
};

export const isNumber = (value: ChannelValue | undefined): value is number =>
  typeof value === "number";

const blend = (
  target: Channel,
  a: ChannelValue,
  b: ChannelValue | undefined,
  amount: number,
): ChannelValue => {
  if (isNumber(a) && isNumber(b)) return a + (b - a) * amount;

  if (target !== "d" || b === undefined) return a;

  return blendPaths(String(a), String(b), amount);
};

export const valueAt = (keys: readonly Key[], t: Seconds): ChannelValues => {
  const index = keys.findLastIndex((key) => key.t <= t + EPSILON);
  const [from, to] = [keys[index]!, keys[index + 1]];

  if (!to) return from.values;
  const amount = easeAt(from.ease, (t - from.t) / (to.t - from.t));

  // SAFETY: from.values and the result share their keys, each a Channel name with a value of that target's kind.
  return Object.fromEntries(
    (Object.keys(from.values) as Channel[]).map((target) => [
      target,
      blend(target, valueOf(from.values, target)!, valueOf(to.values, target), amount),
    ]),
  ) as ChannelValues;
};
