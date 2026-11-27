import { easeAt, easeBetween } from "./ease-at";
import { DEFAULT_EASE, EPSILON, NUDGE, ease, isHold, type Ease, type Seconds } from "./time";
import { alongCurve, fitControls, hermiteControls, onCurve, type Controls } from "./curve";
import type { Animated, Key, Lane, Vec } from "./ir";
import { isLane } from "./lane";
import { fitted, fittedCurves, keyCost, type RunKey, type Sample } from "../author/spring";
import { same, type Mix } from "./steps";

export type Blend<T> = (a: T, b: T, amount: number) => T;

export const blendNumber: Blend<number> = (a, b, u) => a + (b - a) * u;

export const blendVec: Blend<Vec> = (a, b, u) => [
  a[0] + (b[0] - a[0]) * u,
  a[1] + (b[1] - a[1]) * u,
];

const local = (t: Seconds, period: Seconds | undefined): Seconds =>
  period === undefined ? t : t - period * Math.max(0, Math.ceil(t / period - EPSILON) - 1);

export interface Segment<T> {
  readonly from: Key<T>;
  readonly to: Key<T>;
  readonly amount: number;
}

export const segmentAt = <T>(lane: Lane<T>, t: Seconds): Segment<T> => {
  const { keys } = lane;
  const at = local(t, lane.period);
  const index = keys.findLastIndex((key) => key.t <= at + EPSILON);

  if (index < 0) return { from: keys[0], to: keys[0], amount: 0 };
  const [from, to] = [keys[index]!, keys[index + 1]];

  if (!to) return { from, to: from, amount: 0 };

  if (at - from.t <= EPSILON) return { from, to, amount: 0 };

  return { from, to, amount: easeAt(to.ease ?? DEFAULT_EASE, (at - from.t) / (to.t - from.t)) };
};

/** A value at `t`. A lane mixes the two keys around `t` with `mix`; `where` names the value in its errors. */
export const valueAt = <T>(value: Animated<T>, t: Seconds, mix: Mix<T>, where = "a lane"): T => {
  if (!isLane(value)) return value;
  const { from, to, amount } = segmentAt(value, t);

  if (from === to || amount === 0) return from.value;

  return onCurve(from, to, amount) ?? mix(from.value, to.value, amount, where);
};

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

type Between =
  | { readonly kind: "still" }
  | { readonly kind: "eased"; readonly curve: Ease }
  | { readonly kind: "other" };

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
    const curve = to.ease ?? DEFAULT_EASE;

    if (isHold(curve)) {
      if (Math.abs(to.t - end) <= EPSILON) return { kind: "other" };
      continue;
    }

    if (curve.kind === "steps") return { kind: "other" };
    const span = to.t - from.t;

    const part = easeBetween(
      curve,
      (start - from.t) / span,
      (end - from.t) / span,
      "a sampled lane",
    );

    if (found && JSON.stringify(found) !== JSON.stringify(part)) return { kind: "other" };
    found = part;
  }

  return found ? { kind: "eased", curve: found } : { kind: "still" };
};

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

const GRID = 96;

const DENSER = 8;

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
  const p = easeAt(b.ease ?? DEFAULT_EASE, (t - a.t) / (b.t - a.t));

  const drawn = b.via
    ? alongCurve(pointOf(a.values), b.via, pointOf(b.values), p)
    : a.values.map((value, c) => value + (b.values[c]! - value) * p);

  const off = drawn.map((value, c) => {
    const d = value - want[c]!;

    return turns.includes(c) ? d - 360 * Math.round(d / 360) : d;
  });

  return Math.hypot(...off) > tolerance;
};

const SAMPLE_PAST = 8;

const CLOSEST = 0.002;

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

  const pace = values.map((_, i) => {
    const [a, b] = [Math.max(0, i - 1), Math.min(GRID, i + 1)];

    return values[i]!.map(
      (_, c) => (values[b]![c]! - values[a]![c]!) / (progress[b]! - progress[a]!),
    );
  });

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
      ease: easeBetween(curve, share[from]!, share[reach]!, "a sampled lane"),
      ...(bend > line && { via: curveOf(from, reach).via }),
    });
    from = reach;
  }

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

/** A stretch of time whose values nobody sees, such as while the node they draw sits under an opacity of 0. */
export type Idle = readonly [from: Seconds, to: Seconds];

/**
 * The period every lane in `values` repeats with, when each lane loops and one period is a whole number of each:
 * anything read from them alone repeats with it too, so one period of samples says it all.
 */
export const commonPeriod = (values: readonly Animated<unknown>[]): Seconds | undefined => {
  const lanes = values.filter((value) => isLane(value));

  if (lanes.length === 0 || lanes.some((lane) => lane.period === undefined)) return undefined;
  const period = Math.max(...lanes.map((lane) => lane.period!));

  return lanes.every((lane) => {
    const times = period / lane.period!;

    return Math.abs(times - Math.round(times)) < 1e-6;
  })
    ? period
    : undefined;
};

/** `breaks` cut at the edges of every idle stretch and not inside one, so each idle stretch is one run. */
const breaksWith = (breaks: readonly Seconds[], idle: readonly Idle[]): Seconds[] => {
  if (idle.length === 0) return [...breaks];
  const [first, last] = [breaks[0]!, breaks.at(-1)!];

  const within = (t: Seconds): boolean => idle.some(([a, b]) => t > a + EPSILON && t < b - EPSILON);

  return [
    ...breaks.filter((t) => t === first || t === last || !within(t)),
    ...idle.flat().filter((t) => t > first + EPSILON && t < last - EPSILON),
  ]
    .sort((a, b) => a - b)
    .filter((t, index, all) => index === 0 || t - all[index - 1]! > EPSILON);
};

/**
 * Keys that follow `at` across `breaks` within `tolerance`. Through an `idle` stretch the keys hold the value at its
 * start and jump to the true one at its end, since nothing there is seen: a node shown for 5 s of a 100 s scene
 * samples its 5 s.
 */
export const follow = (
  at: (t: Seconds) => readonly number[],
  breaks: readonly Seconds[],
  tolerance: number,
  turns: readonly number[] = [],
  lanes: readonly Animated<unknown>[] = [],
  curves = false,
  idle: readonly Idle[] = [],
): RunKey[] => {
  const cut = breaksWith(breaks, idle);
  const straight = keysOf(at, cut, tolerance, turns, lanes, false, idle);

  if (!curves) return straight;
  const curved = keysOf(at, cut, tolerance, turns, lanes, true, idle);

  return curved.some((key) => key.via) && keyCost(curved) < keyCost(straight) ? curved : straight;
};

const keysOf = (
  at: (t: Seconds) => readonly number[],
  breaks: readonly Seconds[],
  tolerance: number,
  turns: readonly number[],
  lanes: readonly Animated<unknown>[],
  bends: boolean,
  idle: readonly Idle[],
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
    const unseen = idle.some(([a, b]) => start >= a - EPSILON && end <= b + EPSILON);
    const moves = written.length > 0 ? between(written, start, end) : { kind: "other" as const };
    const from = last;
    let run: RunKey[] | undefined;

    if (unseen) {
      const value = read(start);

      run = [
        { t: start, values: value },
        { t: end, values: value, ease: ease.linear },
      ];
    } else if (moves.kind === "eased") {
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

    if (!run || run.length > SAMPLE_PAST) {
      const kept = last;
      let sampled: RunKey[] = [];

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

  const timed = keys.reduce<RunKey[]>((kept, key) => {
    if (kept.length > 0 && key.t - kept.at(-1)!.t <= EPSILON)
      kept[kept.length - 1] = { ...key, t: kept.at(-1)!.t };
    else kept.push(key);

    return kept;
  }, []);

  return timed.filter((key, index) => {
    const [before, next] = [timed[index - 1], timed[index + 1]];

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
          ease: key.ease ?? DEFAULT_EASE,
          ...(key.via && { via: key.via }),
        },
  );

  if (!first || !second || keys.every((key) => !key.via && !far(key.values, keys[0]!.values, 1e-9)))
    return join(keys[0]!.values);

  const lane: Lane<T> = { kind: "lane", keys: [first, second, ...rest] };

  return lane;
};

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

/**
 * A looping lane's keys over `duration`, like `unrolled`, but with the jump back at each wrap kept: where a cycle ends
 * on one value and the next starts on another, a held key at the wrap says so. `unrolled` drops it, so a fade that
 * loops from 1 down to 0 would read as 0 from its first wrap on.
 */
export const wrapped = <T>(lane: Lane<T>, duration: Seconds): Key<T>[] => {
  if (lane.period === undefined) return [...lane.keys];
  const out: Key<T>[] = [];

  for (let start = 0; start < duration - EPSILON; start += lane.period)
    for (const key of lane.keys) {
      const t = start + key.t;
      const last = out.at(-1);

      if (t > duration + EPSILON) continue;

      if (last && t <= last.t + EPSILON) {
        if (key === lane.keys[0] && !same(last.value, key.value))
          out.push({ ...key, t: last.t, ease: ease.hold });
        continue;
      }

      out.push({ ...key, t });
    }

  return out;
};
