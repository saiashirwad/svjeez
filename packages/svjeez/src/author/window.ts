import { DEFAULT_EASE, EPSILON, ease, isHold, type Seconds } from "../model/time";
import { easeAt, easeBetween, staysInside } from "../model/ease-at";
import type { Key, Lane } from "../model/ir";
import { SceneError } from "../model/scene-error";
import { isCurveFn, isSpring } from "./spring";
import { passageOf, type Track } from "./track";

export const ramp = (value: number, from: number, to: number): number =>
  Math.min(1, Math.max(0, (value - from) / (to - from)));

/** A track's progress seen through a window: 0 until it reaches `from`, 1 from `to`, and rescaled between. */
export class Window {
  constructor(
    readonly track: Track<number>,
    readonly from: number,
    readonly to: number,
  ) {}

  of(value: number): number {
    return ramp(value, this.from, this.to);
  }
}

const unit = (x: number): number => Math.min(1, Math.max(0, x));

/** The progress x of a segment at which its curve reaches y (the curve must rise from 0 to 1 without overshoot). */
const curveTimeAt = (curve: (x: number) => number, y: number): number => {
  let [lo, hi] = [0, 1];

  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;

    if (curve(mid) < y) lo = mid;
    else hi = mid;
  }

  return (lo + hi) / 2;
};

/**
 * The first scene time (in seconds) when a numeric `track` reaches `target`, or `undefined` if it never crosses it.
 * Useful for firing an effect at the moment an eased `draw` track reaches a station along a path.
 */
export const timeAt = (source: Track<number>, target: number): Seconds | undefined => {
  if (!Number.isFinite(target))
    throw new SceneError(`timeAt() needs a finite target value, got ${target}.`);

  const { initial, steps } = passageOf(source).data;
  let current = initial.value ?? 0;

  if (Math.abs(current - target) <= 1e-9) return 0;

  const sorted = [...steps].sort((a, b) => a.start - b.start);

  for (const step of sorted) {
    const next = step.values.value;

    if (next === undefined) continue;

    if (step.over === 0) {
      if (Math.abs(next - target) <= 1e-9) return step.start;
      current = next;
      continue;
    }

    const rising = next >= current;

    const inRange = rising
      ? target >= current - 1e-9 && target <= next + 1e-9
      : target <= current + 1e-9 && target >= next - 1e-9;

    if (isSpring(step.ease)) {
      const SAMPLES = 128;
      let prevT = 0;
      let prevV = current;

      for (let i = 1; i <= SAMPLES; i++) {
        const dt = (step.over * i) / SAMPLES;
        const val = next + step.ease.state(current - next, 0, dt)[0];

        if ((prevV - target) * (val - target) <= 0) {
          let [lo, hi] = [prevT, dt];
          const up = val >= prevV;

          for (let k = 0; k < 40; k++) {
            const mid = (lo + hi) / 2;
            const mv = next + step.ease.state(current - next, 0, mid)[0];

            if (up ? mv < target : mv > target) lo = mid;
            else hi = mid;
          }

          return step.start + (lo + hi) / 2;
        }

        prevT = dt;
        prevV = val;
      }
    } else if (inRange && Math.abs(next - current) > 1e-12) {
      const y = unit((target - current) / (next - current));
      const curve = step.ease ?? DEFAULT_EASE;

      if (isCurveFn(curve)) return step.start + curveTimeAt(curve, y) * step.over;

      if (!isHold(curve)) return step.start + curveTimeAt((x) => easeAt(curve, x), y) * step.over;

      if (Math.abs(next - target) <= 1e-9) return step.start + step.over;
    }

    current = next;
  }

  return undefined;
};

/**
 * The window of a lane, exactly. Inside each step the window is the same ease over a shorter time, so a step the
 * window crosses costs two keys, however the ease bends. Undefined when a step cannot be cut that way.
 */
export const windowLane = (
  lane: Lane<number>,
  window: Window,
): Lane<number> | number | undefined => {
  const [first, ...rest] = lane.keys;
  const keys: Key<number>[] = [{ t: first.t, value: window.of(first.value) }];
  let before = first;

  for (const key of rest) {
    const curve = key.ease ?? ease.out;
    const [from, to] = [window.of(before.value), window.of(key.value)];
    const dt = key.t - before.t;

    if (key.via || (!isHold(curve) && curve.kind === "steps") || !staysInside(curve))
      return undefined;

    if (isHold(curve)) {
      keys.push({ t: key.t, value: to, ease: curve });
    } else if (from === to && before.value === key.value) {
      keys.push({ t: key.t, value: to, ease: ease.linear });
    } else {
      const rise = key.value - before.value;
      const [a, b] = [(window.from - before.value) / rise, (window.to - before.value) / rise];
      const [y1, y2] = [unit(Math.min(a, b)), unit(Math.max(a, b))];

      if (y2 - y1 < EPSILON) {
        keys.push({ t: key.t, value: to, ease: ease.linear });
      } else {
        const [x1, x2] = [
          y1 <= EPSILON ? 0 : curveTimeAt((x) => easeAt(curve, x), y1),
          y2 >= 1 - EPSILON ? 1 : curveTimeAt((x) => easeAt(curve, x), y2),
        ];

        if (x1 > 0) keys.push({ t: before.t + x1 * dt, value: from, ease: ease.linear });
        keys.push({
          t: before.t + x2 * dt,
          value: x2 === 1 ? to : window.of(before.value + rise * y2),
          ease: easeBetween(curve, x1, x2, "a window"),
        });

        if (x2 < 1) keys.push({ t: key.t, value: to, ease: ease.linear });
      }
    }

    before = key;
  }

  const kept = keys.filter(
    (key, i) =>
      i === 0 ||
      i === keys.length - 1 ||
      key.value !== keys[i - 1]!.value ||
      key.value !== keys[i + 1]!.value,
  );

  const [head, next, ...others] = kept;

  if (kept.every((key) => key.value === head!.value)) return head!.value;

  const out: Lane<number> = { kind: "lane", keys: [head!, next!, ...others] };

  return lane.period === undefined ? out : { ...out, period: lane.period };
};
