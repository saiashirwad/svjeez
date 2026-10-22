import { cssDeclarations, type Channel, type Values } from "./channels";
import { num } from "./format";
import { ease, type Ease, type Seconds, type Step } from "./motion";

/**
 * Backend-neutral keyframe: `ease` shapes the segment that STARTS here. This file is the only place
 * that knows it; authors pass an ease to the transition it shapes.
 */
export interface Key {
  readonly t: Seconds;
  readonly values: Values;
  readonly ease: Ease;
}

/** Snap a loop so it divides the scene and every loop stays in lockstep with it. */
export const snapPeriod = (period: Seconds, duration: Seconds): Seconds => duration / Math.max(1, Math.round(duration / period));

const same = (a: Values, b: Values): boolean => (Object.keys(a) as Channel[]).every((channel) => a[channel] === b[channel]);

/** One lane's history as keys over 0..period. Holds are implicit; a cut becomes a hold that jumps. */
export const keysOf = (initial: Values, segments: readonly Step[], period: Seconds): Key[] => {
  const keys: Key[] = [{ t: 0, values: initial, ease: ease.out }];
  const nudge = period * 1e-5;
  let current = initial;
  for (const segment of segments) {
    const next = { ...current, ...segment.values };
    const last = keys.at(-1)!;
    const contiguous = segment.start <= last.t + 1e-9;
    if (segment.over > 0) {
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
  if (keys.at(-1)!.t < period) keys.push({ t: period, values: current, ease: ease.out });
  return keys;
};

const moving = (keys: readonly Key[], index: number): boolean => {
  const next = keys[index + 1];
  return next !== undefined && !same(keys[index]!.values, next.values);
};

/** Value of a lane at local time `t`, snapped to the key at or before it. */
export const valueAt = (keys: readonly Key[], t: Seconds): Values => keys.findLast((key) => key.t <= t + 1e-9)!.values;

const short = (value: number): string => num(value).replace(/^(-?)0\./, "$1.");

export const timing = (curve: Ease): string => {
  switch (curve.kind) {
    case "linear":
      return "linear";
    case "bezier":
      return `cubic-bezier(${curve.points.map(short).join(",")})`;
    case "steps":
      return `steps(${curve.count})`;
  }
};

export const BASE_TIMING = timing(ease.out);

const percents = (keys: readonly Key[], period: Seconds): string[] => {
  for (const places of [3, 4]) {
    const out = keys.map((key) => `${num((key.t / period) * 100, places)}%`);
    if (new Set(out).size === out.length) return out;
  }
  throw new Error(`Two keys are too close to tell apart on a ${num(period)}s timeline: ${keys.map((key) => key.t).join(", ")}.`);
};

/**
 * CSS keyframes body for one lane. The most common ease is hoisted to the lane's timing; keys with
 * the same declarations share one selector list.
 */
export const cssKeyframes = (lane: string, keys: readonly Key[], period: Seconds): { body: string; timing: string } => {
  const counts = new Map<string, number>();
  keys.forEach((key, index) => {
    if (moving(keys, index)) counts.set(timing(key.ease), (counts.get(timing(key.ease)) ?? 0) + 1);
  });
  const [laneTiming] = [...counts].reduce<[string, number]>((best, entry) => (entry[1] > best[1] ? entry : best), [BASE_TIMING, counts.get(BASE_TIMING) ?? 0]);
  const blocks = new Map<string, string[]>();
  const at = percents(keys, period);
  keys.forEach((key, index) => {
    const own = timing(key.ease);
    const block = cssDeclarations(lane, key.values) + (moving(keys, index) && own !== laneTiming ? `;animation-timing-function:${own}` : "");
    blocks.set(block, [...(blocks.get(block) ?? []), at[index]!]);
  });
  return { body: [...blocks].map(([block, list]) => `${list.join(",")}{${block}}`).join(""), timing: laneTiming };
};

const format = (value: Values[Channel]): string => (typeof value === "number" ? num(value) : String(value));

const lerp = (from: Values[Channel], to: Values[Channel], amount: number): Values[Channel] =>
  typeof from === "number" && typeof to === "number" ? from + (to - from) * amount : amount < 1 ? from : to;

/** SMIL <animate> attributes for one attribute lane, from the same keys the CSS backend reads. */
export const smilAttributes = (attribute: string, channel: Channel, keys: readonly Key[], period: Seconds, duration: Seconds): Record<string, string> => {
  const movingKeys = keys.filter((_, index) => moving(keys, index));
  const discrete = movingKeys.length > 0 && movingKeys.every((key) => key.ease.kind === "steps");
  const points: { t: Seconds; value: Values[Channel]; spline: string }[] = [];
  keys.forEach((key, index) => {
    const value = key.values[channel];
    const next = keys[index + 1];
    if (!next || !moving(keys, index) || key.ease.kind !== "steps") {
      const spline = next && moving(keys, index) && key.ease.kind === "bezier" ? key.ease.points.map((point) => num(point)).join(" ") : "0 0 1 1";
      points.push({ t: key.t, value, spline });
      return;
    }
    const count = key.ease.count;
    for (let step = 0; step < count; step++) {
      const t = key.t + ((next.t - key.t) * step) / count;
      const stepValue = lerp(value, next.values[channel], step / count);
      if (step > 0 && !discrete) points.push({ t, value: lerp(value, next.values[channel], (step - 1) / count), spline: "0 0 1 1" });
      points.push({ t, value: stepValue, spline: "0 0 1 1" });
    }
    if (!discrete) points.push({ t: next.t, value: lerp(value, next.values[channel], (count - 1) / count), spline: "0 0 1 1" });
  });
  const spline = !discrete && points.slice(0, -1).some((point) => point.spline !== "0 0 1 1");
  return {
    attributeName: attribute,
    values: points.map((point) => format(point.value)).join(";"),
    keyTimes: points.map((point) => num(point.t / period, 5)).join(";"),
    ...(discrete ? { calcMode: "discrete" } : spline ? { calcMode: "spline", keySplines: points.slice(0, -1).map((point) => point.spline).join(";") } : {}),
    dur: `${num(duration)}s`,
    repeatCount: "indefinite",
  };
};
