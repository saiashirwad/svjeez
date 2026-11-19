import { EPSILON, ease, isHold, type Ease } from "../model/time";
import { easeAt, easeBetween, staysInside } from "../model/ease-at";
import type { Key, Lane } from "../model/ir";
import type { Track } from "./track";

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

/** The progress x of a segment at which its ease reaches y (the ease must rise from 0 to 1 without overshoot). */
const timeAt = (curve: Ease, y: number): number => {
  let [lo, hi] = [0, 1];

  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;

    if (easeAt(curve, mid) < y) lo = mid;
    else hi = mid;
  }

  return (lo + hi) / 2;
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
      // Where in the step the value is at the window's edges, in order of time.
      const rise = key.value - before.value;
      const [a, b] = [(window.from - before.value) / rise, (window.to - before.value) / rise];
      const [y1, y2] = [unit(Math.min(a, b)), unit(Math.max(a, b))];

      if (y2 - y1 < EPSILON) {
        keys.push({ t: key.t, value: to, ease: ease.linear });
      } else {
        const [x1, x2] = [
          y1 <= EPSILON ? 0 : timeAt(curve, y1),
          y2 >= 1 - EPSILON ? 1 : timeAt(curve, y2),
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
