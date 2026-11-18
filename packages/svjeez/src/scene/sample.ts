import { easeAt } from "../ease-at";
import { EPSILON, NUDGE, ease, type Ease, type Seconds } from "../time";
import { alongCurve, fitControls, hermiteControls, onCurve, type Controls } from "./curve";
import { portion } from "./fold";
import type { Animated, Key, Lane, Vec } from "./ir";
import { isLane } from "./lane";
import { fitted, fittedCurves, keyCost, type RunKey, type Sample } from "./spring";
import { same } from "./steps";

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
  const amount = easeAt(to.ease ?? ease.linear, (at - from.t) / (to.t - from.t));

  return onCurve(from, to, amount) ?? blend(from.value, to.value, amount);
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

/** How the lanes a value reads move between two neighbouring joins. */
type Between =
  | { readonly kind: "still" }
  | { readonly kind: "eased"; readonly curve: Ease }
  | { readonly kind: "other" };

const isHold = (curve: Ease): boolean => curve.kind === "steps" && curve.count === 1;

/**
 * Whether every lane that moves from `start` to `end` moves by one ease, the same in each: then a value that reads
 * only them is a fixed function of that ease's progress there. A cut, a steps ease, or two different eases is
 * `other`.
 */
const between = (
  lanes: readonly (readonly Key<unknown>[])[],
  start: Seconds,
  end: Seconds,
): Between => {
  let found: Ease | undefined;

  for (const keys of lanes) {
    const next = keys.findIndex((key) => key.t >= end - EPSILON);

    if (next <= 0) continue;
    const [from, to] = [keys[next - 1]!, keys[next]!];

    if (!to.via && same(from.value, to.value)) continue;
    const curve = to.ease ?? ease.linear;

    if (isHold(curve)) {
      if (Math.abs(to.t - end) <= EPSILON) return { kind: "other" };
      continue;
    }

    if (curve.kind === "steps") return { kind: "other" };
    const span = to.t - from.t;
    const part = portion(curve, (start - from.t) / span, (end - from.t) / span);

    if (found && JSON.stringify(found) !== JSON.stringify(part)) return { kind: "other" };
    found = part;
  }

  return found ? { kind: "eased", curve: found } : { kind: "still" };
};

/** Where in time `curve` reaches `progress`, as a part of its span; undefined when it turns back or overshoots. */
const timeOf = (curve: Ease): ((progress: number) => number) | undefined => {
  if (curve.kind === "linear") return (progress) => progress;

  if (curve.kind !== "bezier") return undefined;
  const [x1, y1, x2, y2] = curve.points;

  if (y1 < 0 || y1 > 1 || y2 < 0 || y2 > 1) return undefined;

  const at = (a: number, b: number, s: number) =>
    3 * a * s * (1 - s) ** 2 + 3 * b * s * s * (1 - s) + s ** 3;

  return (progress) => {
    let [lo, hi] = [0, 1];

    for (let i = 0; i < 50; i++) {
      const mid = (lo + hi) / 2;

      if (at(y1, y2, mid) < progress) lo = mid;
      else hi = mid;
    }

    return at(x1, x2, (lo + hi) / 2);
  };
};

const pointOf = (values: readonly number[]): Vec => [values[0]!, values[1]!];

/** Points of progress each eased stretch is read at, to place its keys. */
const GRID = 96;

/** How many times denser than `RATE` a stretch whose keys stray between samples may be sampled. */
const DENSER = 8;

/** Whether keys drawn at `t` are farther than `tolerance` from `want`; angles in `turns` compare a whole turn apart. */
const strayed = (
  keys: readonly RunKey[],
  t: Seconds,
  want: readonly number[],
  tolerance: number,
  turns: readonly number[],
): boolean => {
  const next = keys.findIndex((key) => key.t >= t);

  if (next <= 0) return false;
  const [a, b] = [keys[next - 1]!, keys[next]!];
  const p = easeAt(b.ease ?? ease.linear, (t - a.t) / (b.t - a.t));

  const drawn = b.via
    ? alongCurve(pointOf(a.values), b.via, pointOf(b.values), p)
    : a.values.map((value, c) => value + (b.values[c]! - value) * p);

  const off = drawn.map((value, c) => {
    const d = value - want[c]!;

    return turns.includes(c) ? d - 360 * Math.round(d / 360) : d;
  });

  return Math.hypot(...off) > tolerance;
};

/** An eased stretch with more keys than this is fitted from samples too, and the shorter kept. */
const SAMPLE_PAST = 8;

/** Keys closer than this in time are not worth the split: the stretch is sampled instead. */
const CLOSEST = 0.002;

/** How far a straight key from `a` to `b` strays from the values between, at the worst one. */
const strayFromLine = (
  progress: readonly number[],
  values: readonly (readonly number[])[],
  a: number,
  b: number,
): number => {
  let worst = 0;

  for (let i = a + 1; i < b; i++) {
    const u = (progress[i]! - progress[a]!) / (progress[b]! - progress[a]!);

    worst = Math.max(
      worst,
      Math.hypot(
        ...values[i]!.map(
          (value, c) => value - (values[a]![c]! + (values[b]![c]! - values[a]![c]!) * u),
        ),
      ),
    );
  }

  return worst;
};

/**
 * A stretch moved by one ease, as keys that keep it: the value is read at even steps of the ease's progress, and each
 * key reaches as far as a straight line in that progress stays within `tolerance`. Each key's ease is the part of
 * `curve` it spans, cut exactly, so the keys run on the original ease and only the value's bends are approximated.
 * Undefined when that would not hold: an ease that turns back, keys too close, or a value that strays between them.
 */
const easedRun = (
  read: (t: Seconds) => readonly number[],
  start: Seconds,
  end: Seconds,
  curve: Ease,
  tolerance: number,
  bends: boolean,
): RunKey[] | undefined => {
  const time = timeOf(curve);

  if (!time) return undefined;
  const progress = Array.from({ length: GRID + 1 }, (_, i) => i / GRID);
  const share = progress.map(time);
  const values = share.map((u) => read(start + (end - start) * u));
  const keys: RunKey[] = [{ t: start, values: values[0]! }];

  // How fast the value moves with progress at each grid point, for a curved key's controls.
  const pace = values.map((_, i) => {
    const [a, b] = [Math.max(0, i - 1), Math.min(GRID, i + 1)];

    return values[i]!.map(
      (_, c) => (values[b]![c]! - values[a]![c]!) / (progress[b]! - progress[a]!),
    );
  });

  /** The curve from grid point `a` to `b` that strays least, and how far: Hermite handles, or fitted ones. */
  const curveOf = (a: number, b: number): { readonly via: Controls; readonly strays: number } => {
    const width = progress[b]! - progress[a]!;
    const [p, q] = [pointOf(values[a]!), pointOf(values[b]!)];
    const [leave, arrive] = [pace[a]!, pace[b]!];
    const shares = progress.slice(a + 1, b).map((e) => (e - progress[a]!) / width);
    const between = values.slice(a + 1, b).map(pointOf);

    const strays = (via: Controls): number =>
      between.reduce((worst, want, i) => {
        const at = alongCurve(p, via, q, shares[i]!);

        return Math.max(worst, Math.hypot(at[0] - want[0], at[1] - want[1]));
      }, 0);

    const hermite = hermiteControls(
      p,
      [leave[0]! * width, leave[1]! * width],
      [arrive[0]! * width, arrive[1]! * width],
      q,
    );

    const fit = fitControls(p, pointOf(leave), pointOf(arrive), q, between, shares);
    const [one, two] = [strays(hermite), fit ? strays(fit) : Infinity];

    return two < one ? { via: fit!, strays: two } : { via: hermite, strays: one };
  };

  const reachBy = (from: number, strays: (a: number, b: number) => number): number => {
    let [reach, beyond] = [from + 1, GRID + 1];

    if (strays(from, GRID) <= tolerance) return GRID;

    while (beyond - reach > 1) {
      const middle = Math.floor((reach + beyond) / 2);

      if (strays(from, middle) <= tolerance) reach = middle;
      else beyond = middle;
    }

    return reach;
  };

  let from = 0;

  while (from < GRID) {
    const line = reachBy(from, (a, b) => strayFromLine(progress, values, a, b));
    const bend = bends ? reachBy(from, (a, b) => (b - a > 1 ? curveOf(a, b).strays : Infinity)) : 0;
    const reach = Math.max(line, bend);
    const t = start + (end - start) * share[reach]!;

    if (t - keys.at(-1)!.t < CLOSEST) return undefined;
    keys.push({
      t,
      values: values[reach]!,
      ease: portion(curve, share[from]!, share[reach]!),
      ...(bend > line && { via: curveOf(from, reach).via }),
    });
    from = reach;
  }

  // The grid can step over a bend: every key is checked against the value between its grid points too.
  for (let k = 1; k < keys.length; k++) {
    const [a, b] = [keys[k - 1]!, keys[k]!];

    for (let i = 1; i < 8; i++) {
      const u = i / 8;
      const p = easeAt(b.ease!, u);
      const want = read(a.t + (b.t - a.t) * u);

      const drawn = b.via
        ? alongCurve(pointOf(a.values), b.via, pointOf(b.values), p)
        : a.values.map((value, c) => value + (b.values[c]! - value) * p);

      if (far(want, drawn, tolerance * 1.5)) return undefined;
    }
  }

  return keys;
};

/**
 * A value known only at each moment, written as keys over the whole scene that stay within `tolerance` of it.
 * Components listed in `turns` are angles in degrees, kept continuous rather than wrapped. When `lanes` are the
 * lanes the value reads, a stretch where they all move by one ease keeps that ease, cut into parts at the value's
 * bends (see `easedRun`); anything else between two joins is sampled densely and fitted with eases. At a join where
 * it jumps, the keys cut. With `curves`, the value is a point and its keys may be curved (`Key.via`), when that takes
 * fewer.
 */
export const follow = (
  at: (t: Seconds) => readonly number[],
  breaks: readonly Seconds[],
  tolerance: number,
  turns: readonly number[] = [],
  lanes: readonly Animated<unknown>[] = [],
  curves = false,
): RunKey[] => {
  const straight = keysOf(at, breaks, tolerance, turns, lanes, false);

  if (!curves) return straight;
  const curved = keysOf(at, breaks, tolerance, turns, lanes, true);

  return curved.some((key) => key.via) && keyCost(curved) < keyCost(straight) ? curved : straight;
};

const keysOf = (
  at: (t: Seconds) => readonly number[],
  breaks: readonly Seconds[],
  tolerance: number,
  turns: readonly number[],
  lanes: readonly Animated<unknown>[],
  bends: boolean,
): RunKey[] => {
  const duration = breaks.at(-1)!;
  const nudge = duration * NUDGE;
  const written = lanes.flatMap((lane) => (isLane(lane) ? [unrolled(lane, duration)] : []));
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
    const final = index + 2 === breaks.length;
    const moves = written.length > 0 ? between(written, start, end) : { kind: "other" as const };
    const from = last;
    let run: RunKey[] | undefined;

    if (moves.kind === "eased") {
      // The value just before a join, so a jump there cuts rather than slides.
      const inside = (t: Seconds) => read(!final && t >= end - EPSILON ? end - nudge : t);

      run = easedRun(inside, start, end, moves.curve, tolerance, bends);

      if (run) {
        run[run.length - 1] = { ...run.at(-1)!, t: end };
        last = run.at(-1)!.values;
      } else last = from;
    } else if (moves.kind === "still") {
      const value = read(start);

      run = [
        { t: start, values: value },
        { t: end, values: final ? read(end) : read(end - nudge), ease: ease.linear },
      ];
    }

    // Cut eases keep the motion's timing exactly, but a value that bends all the way needs a key at every bend: then
    // fitting fresh eases to samples can take fewer.
    if (!run || run.length > SAMPLE_PAST) {
      const kept = last;
      let sampled: RunKey[] = [];

      // Keys are checked at the samples only, so a fast bend can stray between two: the run is read back halfway
      // between each pair, and sampled twice as densely while it strays there.
      for (let rate = RATE; rate <= RATE * DENSER; rate *= 2) {
        last = from;
        const count = Math.max(2, Math.ceil((end - start) * rate));

        const times = Array.from(
          { length: count + 1 },
          (_, i) => start + ((end - start) * i) / count,
        );

        const values = times.map((t, i) => read(i === count && !final ? end - nudge : t));
        const samples = withVelocity(times, values);

        sampled = bends ? fittedCurves(samples, tolerance) : fitted(samples, tolerance);

        const halfway = times.slice(1).map((t, i) => (t + times[i]!) / 2);

        if (halfway.every((t) => !strayed(sampled, t, read(t), tolerance * 1.5, turns))) break;
      }

      if (!run || keyCost(sampled) < keyCost(run)) run = sampled;
      else last = kept;
    }

    const after = final ? run.at(-1)!.values : read(end);
    const jumps = far(run.at(-1)!.values, after, tolerance);

    if (jumps) run[run.length - 1] = { ...run.at(-1)!, t: end - nudge };
    else run[run.length - 1] = { ...run.at(-1)!, values: after };
    last = after;

    const before = keys.at(-1);

    if (before && before.t < start - EPSILON)
      keys.push({ t: start, values: run[0]!.values, ease: ease.hold });

    keys.push(...(before ? run.slice(1) : run));
  });

  return keys.filter((key, index) => {
    const [before, next] = [keys[index - 1], keys[index + 1]];

    return (
      !before ||
      !next ||
      key.via !== undefined ||
      next.via !== undefined ||
      far(before.values, key.values, 1e-9) ||
      far(key.values, next.values, 1e-9)
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
      : {
          t: key.t,
          value: join(key.values),
          ease: key.ease ?? ease.linear,
          ...(key.via && { via: key.via }),
        },
  );

  if (!first || !second || keys.every((key) => !key.via && !far(key.values, keys[0]!.values, 1e-9)))
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
