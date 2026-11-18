import { ease as eases, type Ease, type Seconds } from "../time";
import { alongCurve, curveLength, fitControls, hermiteControls, type Controls } from "./curve";
import type { Vec } from "./ir";

/**
 * Real springs: a mass on a damped spring, simulated in seconds from where a value is and how fast it moves. A spring
 * is a step's curve, not an ease in the model: lowering writes it out as keys, so every backend only interpolates.
 */
export interface SpringOptions {
  /** How hard the spring pulls toward the target. Higher is faster. Default 170. */
  readonly stiffness?: number;
  /** How much each swing loses. Below critical damping it overshoots and bounces. Default 26, just short of critical. */
  readonly damping?: number;
  /** Default 1. Heavier is slower and bouncier. */
  readonly mass?: number;
}

/** A spring has settled when what is left of its motion, distance and speed together, is this part of where it started. */
const SETTLED = 1e-3;

/** How far a written key may be from the simulated path, as a part of where the spring started. */
const KEYED = 1e-3;

const MAX_SAMPLES = 20000;

/** A fitted ease steeper than this is a segment that barely moves while the value turns: it is split instead. */
const STEEP = 3;

const NEVER = 3600;

/** Displacement from the target and velocity, per second. */
export type State = readonly [displacement: number, velocity: number];

/** A spring's motion from one place and speed: what lowering writes as keys. */
export interface RunKey {
  /** Seconds from the start of the run. */
  readonly t: Seconds;
  /** Each component's value. */
  readonly values: readonly number[];
  /** Shapes the way from the key before. The first key has none. */
  readonly ease?: Ease;
  /** For a point: the controls of the curve from the key before, as `Key.via`. */
  readonly via?: Controls;
}

export interface Run {
  /** The first is the start, the last the end. */
  readonly keys: readonly RunKey[];
  /** The velocity of each component at the end: zero when it settled. */
  readonly velocity: readonly number[];
  /** Whether it settled inside the window. */
  readonly settled: boolean;
  /** How long it takes to settle from this start. */
  readonly needs: Seconds;
}

export interface Sample {
  readonly t: Seconds;
  readonly values: readonly number[];
  readonly velocity: readonly number[];
}

/**
 * The cubic ease from `a` to `b` that leaves and arrives at their velocities: with its time controls at a third and
 * two thirds, a CSS cubic-bezier is a cubic in time, so this is Hermite interpolation. Every component shares one
 * ease and keys are joined by straight lines, so the speeds are taken along the line from `a` to `b`, and
 * `fitted` checks how far the path strays from it.
 */
const hermite = (a: Sample, b: Sample): Ease => {
  const chord = a.values.map((value, c) => b.values[c]! - value);
  const length = chord.reduce((sum, d) => sum + d * d, 0);
  const scale = Math.max(...a.values.map(Math.abs), ...b.values.map(Math.abs), 1);

  if (Math.sqrt(length) < scale * 1e-9) return eases.linear;

  const along = (velocity: readonly number[]): number =>
    (velocity.reduce((sum, v, c) => sum + v * chord[c]!, 0) * (b.t - a.t)) / (3 * length);

  const [y1, y2] = [along(a.velocity), 1 - along(b.velocity)];

  return Math.abs(y1) > STEEP || Math.abs(y2) > STEEP
    ? eases.linear
    : eases.bezier(1 / 3, y1, 2 / 3, y2);
};

const progressOf = (curve: Ease, u: number): number => {
  if (curve.kind !== "bezier") return u;
  const [, y1, , y2] = curve.points;

  return 3 * y1 * u * (1 - u) ** 2 + 3 * y2 * u * u * (1 - u) + u ** 3;
};

/** How far the Hermite curve from sample `a` to sample `b` strays from the samples between, at the worst one. */
const strays = (samples: readonly Sample[], a: number, b: number): number => {
  const [from, to] = [samples[a]!, samples[b]!];
  const curve = b - a > 1 ? hermite(from, to) : eases.linear;
  let worst = 0;

  for (let i = a + 1; i < b; i++) {
    const p = progressOf(curve, (samples[i]!.t - from.t) / (to.t - from.t));

    worst = Math.max(
      worst,
      Math.hypot(
        ...samples[i]!.values.map(
          (value, c) => value - (from.values[c]! + (to.values[c]! - from.values[c]!) * p),
        ),
      ),
    );
  }

  return worst;
};

/** A sample's two values as a point. */
const pointOf = (values: readonly number[]): Vec => [values[0]!, values[1]!];

/** The curve and ease a curved key from sample `a` to sample `b` takes, or undefined when no ease within 0 and 1 fits. */
interface Bend {
  readonly via: Controls;
  readonly ease: Ease;
  /** How far it strays from the samples between, at the worst one. */
  readonly strays: number;
}

/**
 * The curved key from sample `a` to sample `b` that strays least: Hermite handles from the velocities, or handles
 * fitted to the samples between, each with the Hermite ease of its length. Undefined when no ease within 0 and 1
 * fits.
 */
const curving = (samples: readonly Sample[], a: number, b: number): Bend | undefined => {
  const [from, to] = [samples[a]!, samples[b]!];
  const span = to.t - from.t;
  const [p, q] = [pointOf(from.values), pointOf(to.values)];
  const leave: Vec = [from.velocity[0]! * span, from.velocity[1]! * span];
  const arrive: Vec = [to.velocity[0]! * span, to.velocity[1]! * span];
  const between = samples.slice(a + 1, b).map((sample) => pointOf(sample.values));
  const walked = [0];

  [...between, q].forEach((point, i) => {
    const before = i === 0 ? p : between[i - 1]!;

    walked.push(walked[i]! + Math.hypot(point[0] - before[0], point[1] - before[1]));
  });

  const shares = walked.slice(1, -1).map((length) => length / Math.max(walked.at(-1)!, 1e-12));

  const tried = [
    hermiteControls(p, leave, arrive, q),
    fitControls(p, leave, arrive, q, between, shares),
  ].flatMap((via): Bend[] => {
    if (!via) return [];
    const length = curveLength(p, via, q);

    if (length < 1e-9) return [];

    const [y1, y2] = [
      Math.hypot(...leave) / (3 * length),
      1 - Math.hypot(...arrive) / (3 * length),
    ];

    if (y1 > 1 || y2 < 0) return [];
    const curve = eases.bezier(1 / 3, y1, 2 / 3, y2);

    const strays = between.reduce((worst, want, i) => {
      const at = alongCurve(p, via, q, progressOf(curve, (samples[a + 1 + i]!.t - from.t) / span));

      return Math.max(worst, Math.hypot(at[0] - want[0], at[1] - want[1]));
    }, 0);

    return [{ via, ease: curve, strays }];
  });

  return tried.reduce<Bend | undefined>(
    (best, one) => (!best || one.strays < best.strays ? one : best),
    undefined,
  );
};

/** How far a curved key from sample `a` to sample `b` strays from the samples between. */
const straysCurved = (samples: readonly Sample[], a: number, b: number): number =>
  curving(samples, a, b)?.strays ?? Infinity;

/** A straight Hermite ease within 0 and 1, as a lane with curves needs. */
const inside = (curve: Ease): boolean =>
  curve.kind !== "bezier" || curve.points.every((value) => value >= 0 && value <= 1);

/** How far the farthest sample a key from `from` can reach, by bisection, while `strays` stays within `tolerance`. */
const reachOf = (
  last: number,
  from: number,
  strays: (b: number) => number,
  tolerance: number,
): number => {
  let [reach, beyond] = [from + 1, last + 1];

  if (strays(last) <= tolerance) return last;

  while (beyond - reach > 1) {
    const middle = Math.floor((reach + beyond) / 2);

    if (strays(middle) <= tolerance) reach = middle;
    else beyond = middle;
  }

  return reach;
};

/**
 * Keys for a point that may curve: each reaches as far as a straight key or a curved one (`Key.via`) can, whichever
 * is farther, and every ease stays within 0 and 1, as a lane with curves needs. A cubic in time from 0 to 1 whose two
 * middle values are within 0 and 1 never turns back, so the point never backs along its curve, and a key cut at any
 * moment is two keys of the same kind (steps.ts).
 */
export const fittedCurves = (samples: readonly Sample[], tolerance: number): RunKey[] => {
  const keys: RunKey[] = [{ t: samples[0]!.t, values: samples[0]!.values }];
  const last = samples.length - 1;
  let from = 0;

  while (from < last) {
    const line = reachOf(
      last,
      from,
      (b) =>
        b - from > 1 && !inside(hermite(samples[from]!, samples[b]!))
          ? Infinity
          : strays(samples, from, b),
      tolerance,
    );

    const bend = reachOf(
      last,
      from,
      (b) => (b - from > 1 ? straysCurved(samples, from, b) : Infinity),
      tolerance,
    );

    const curve = bend > line ? curving(samples, from, bend) : undefined;
    const reach = curve ? bend : line;
    const to = samples[reach]!;

    keys.push({
      t: to.t,
      values: to.values,
      ...(curve
        ? { ease: curve.ease, via: curve.via }
        : { ease: reach - from > 1 ? hermite(samples[from]!, to) : eases.linear }),
    });
    from = reach;
  }

  return keys;
};

/** A curved key carries two more points than a straight one, so it counts as one and a half when the two are weighed. */
export const keyCost = (keys: readonly RunKey[]): number =>
  keys.reduce((sum, key) => sum + (key.via ? 1.5 : 1), 0);

/**
 * Few keys whose eases stay within `tolerance` of every sample: each key reaches as far along the samples as a Hermite
 * curve from the key before can, found by bisection. Reaching forward needs about a third fewer keys than splitting at
 * the worst sample, the way `sampled()`'s Ramer-Douglas-Peucker does, for the same tolerance.
 */
export const fitted = (samples: readonly Sample[], tolerance: number, curves = false): RunKey[] => {
  const straight = straightKeys(samples, tolerance);

  if (!curves || samples[0]!.values.length !== 2) return straight;
  const curved = fittedCurves(samples, tolerance);

  return curved.some((key) => key.via) && keyCost(curved) < keyCost(straight) ? curved : straight;
};

const straightKeys = (samples: readonly Sample[], tolerance: number): RunKey[] => {
  const keys: RunKey[] = [{ t: samples[0]!.t, values: samples[0]!.values }];
  const last = samples.length - 1;
  let from = 0;

  while (from < last) {
    let [reach, beyond] = [from + 1, last + 1];

    if (strays(samples, from, last) <= tolerance) reach = last;
    else
      while (beyond - reach > 1) {
        const middle = Math.floor((reach + beyond) / 2);

        if (strays(samples, from, middle) <= tolerance) reach = middle;
        else beyond = middle;
      }

    const to = samples[reach]!;

    keys.push({
      t: to.t,
      values: to.values,
      ease: reach - from > 1 ? hermite(samples[from]!, to) : eases.linear,
    });
    from = reach;
  }

  return keys;
};

const finite = (value: number, what: string): number => {
  if (!(value > 0 && Number.isFinite(value)))
    throw new Error(`ease.spring() needs a positive, finite ${what}, got ${value}.`);

  return value;
};

export class Spring {
  readonly kind = "spring";
  readonly stiffness: number;
  readonly damping: number;
  readonly mass: number;
  /** The natural frequency, in radians per second. */
  readonly omega: number;
  /** The damping ratio: below 1 it bounces, 1 is critical, above 1 it creeps. */
  readonly zeta: number;
  #settle: Seconds | undefined;

  constructor({ stiffness = 170, damping = 26, mass = 1 }: SpringOptions) {
    this.stiffness = finite(stiffness, "stiffness");
    this.damping = finite(damping, "damping");
    this.mass = finite(mass, "mass");
    this.omega = Math.sqrt(stiffness / mass);
    this.zeta = damping / (2 * Math.sqrt(stiffness * mass));
  }

  /**
   * How long it takes to settle from rest, whatever the distance: a span this long holds the whole motion. A spring
   * that starts moving (from a handoff) can need more, and the error that says so gives the time.
   */
  get settle(): Seconds {
    this.#settle ??= this.settleTime([1], [0]);

    return this.#settle;
  }

  /** Where a spring released `x0` from its target at speed `v0` is `t` seconds later: the closed-form solution. */
  state(x0: number, v0: number, t: Seconds): State {
    const { omega: w, zeta: z } = this;

    if (z < 1 - 1e-6) {
      const wd = w * Math.sqrt(1 - z * z);
      const b = (v0 + z * w * x0) / wd;
      const decay = Math.exp(-z * w * t);
      const [c, s] = [Math.cos(wd * t), Math.sin(wd * t)];

      return [
        decay * (x0 * c + b * s),
        decay * ((b * wd - z * w * x0) * c - (x0 * wd + z * w * b) * s),
      ];
    }

    if (z <= 1 + 1e-6) {
      const b = v0 + w * x0;
      const decay = Math.exp(-w * t);

      return [decay * (x0 + b * t), decay * (b - w * (x0 + b * t))];
    }

    const root = w * Math.sqrt(z * z - 1);
    const [r1, r2] = [-z * w + root, -z * w - root];
    const c2 = (v0 - r1 * x0) / (r2 - r1);
    const c1 = x0 - c2;
    const [e1, e2] = [Math.exp(r1 * t), Math.exp(r2 * t)];

    return [c1 * e1 + c2 * e2, c1 * r1 * e1 + c2 * r2 * e2];
  }

  /** What is left of the motion: distance and speed in one measure, which never grows while the spring is damped. */
  #left(x0: readonly number[], v0: readonly number[], t: Seconds): number {
    return Math.hypot(
      ...x0.flatMap((x, i) => {
        const [at, speed] = this.state(x, v0[i]!, t);

        return [at, speed / this.omega];
      }),
    );
  }

  /** Seconds until the motion from `x0` at `v0` (one entry per component) has settled. */
  settleTime(x0: readonly number[], v0: readonly number[]): Seconds {
    const start = this.#left(x0, v0, 0);

    if (start === 0) return 0;
    const limit = start * SETTLED;
    let [lo, hi] = [0, 1 / this.omega];

    while (this.#left(x0, v0, hi) > limit) {
      [lo, hi] = [hi, hi * 2];

      if (hi > NEVER)
        throw new Error(
          `ease.spring({ stiffness: ${this.stiffness}, damping: ${this.damping} }) takes more than an hour to settle. Give it more damping.`,
        );
    }

    for (let i = 0; i < 50; i++) {
      const mid = (lo + hi) / 2;

      if (this.#left(x0, v0, mid) > limit) lo = mid;
      else hi = mid;
    }

    return hi;
  }

  /**
   * The motion from `from` toward `to` starting at `velocity`, one entry per component, for at most `window`
   * seconds: sampled densely, then cut down to the keys that stay within a small part of the distance. With `curves`,
   * a point's keys may be curved (`Key.via`), and every ease stays within 0 and 1, as a lane with a curve needs: an
   * overshoot is the path going past the target and back, never an ease past 1. Whether that is smaller is the
   * lane's to weigh, since one curve puts the whole lane under that rule.
   */
  run(
    from: readonly number[],
    to: readonly number[],
    velocity: readonly number[],
    window: Seconds,
    curves = false,
  ): Run {
    const x0 = from.map((value, i) => value - to[i]!);
    const needs = this.settleTime(x0, velocity);
    const settled = needs <= window + 1e-6;
    const end = Math.min(window, needs);
    const size = this.#left(x0, velocity, 0);

    if (size === 0 || end === 0)
      return { keys: [{ t: 0, values: from }], velocity, settled: true, needs: 0 };

    const fastest =
      this.zeta > 1 ? this.omega * (this.zeta + Math.sqrt(this.zeta * this.zeta - 1)) : this.omega;

    const step = Math.min(1 / 240, (2 * Math.PI) / fastest / 48);
    const count = Math.min(MAX_SAMPLES, Math.max(2, Math.ceil(end / step)));

    const samples = Array.from({ length: count + 1 }, (_, i): Sample => {
      const t = (end * i) / count;
      const states = x0.map((x, c) => this.state(x, velocity[c]!, t));

      return i === count && settled
        ? { t, values: to, velocity: to.map(() => 0) }
        : {
            t,
            values: states.map(([x], c) => to[c]! + x),
            velocity: states.map(([, v]) => v),
          };
    });

    return {
      keys:
        curves && from.length === 2
          ? fittedCurves(samples, size * KEYED)
          : fitted(samples, size * KEYED),
      velocity: settled
        ? velocity.map(() => 0)
        : x0.map((x, c) => this.state(x, velocity[c]!, end)[1]),
      settled,
      needs,
    };
  }
}

/** A step's curve: an ease that shapes a fixed span, or a spring that moves in real seconds inside it. */
export type Curve = Ease | Spring;

export const isSpring = (curve: Curve): curve is Spring => curve instanceof Spring;

/**
 * How fast `curve` is moving as it ends, in progress per unit of progress: what a spring that starts right after it
 * inherits. `ease.out` arrives at rest, `ease.linear` at full speed.
 */
export const endSlope = (curve: Ease): number => {
  switch (curve.kind) {
    case "linear":
      return 1;
    case "steps":
      return 0;
    case "bezier": {
      const [x1, y1, x2, y2] = curve.points;
      const [dx, dy] = [1 - x2, 1 - y2];

      if (Math.abs(dx) > 1e-9) return dy / dx;

      if (Math.abs(dy) > 1e-9)
        throw new Error(
          `ease.bezier(${curve.points.join(", ")}) ends moving infinitely fast, so a spring can't take its speed. Start the spring later, or end the ease with x2 below 1.`,
        );
      const [ddx, ddy] = [x1 - 2 * x2 + 1, y1 - 2 * y2 + 1];

      return Math.abs(ddx) > 1e-9 ? ddy / ddx : 1;
    }
  }
};

/**
 * The scene's eases: every one of `svjeez`'s, and `spring`. A spring starts from where the value is and how fast
 * it moves, so one that cuts in while another is moving carries its speed on.
 */
export const ease = {
  ...eases,
  /**
   * A damped spring toward the step's value. The span is the window it has: it must settle inside it unless a later
   * step cuts in. `ease.spring(options).settle` is how long it needs from rest.
   */
  spring: (options: SpringOptions = {}): Spring => new Spring(options),
} as const;
