import { SceneError } from "../model/scene-error";
import { ease as eases, type Ease, type Seconds } from "../model/time";
import {
  alongCurve,
  curveLength,
  fitControls,
  hermiteControls,
  type Controls,
} from "../model/curve";
import type { Vec } from "../model/ir";

export interface SpringOptions {
  readonly stiffness?: number;
  readonly damping?: number;
  readonly mass?: number;
}

const SETTLED = 1e-3;

const KEYED = 1e-3;

const MAX_SAMPLES = 20000;

const STEEP = 3;

const NEVER = 3600;

export type State = readonly [displacement: number, velocity: number];

export interface RunKey {
  readonly t: Seconds;
  readonly values: readonly number[];
  readonly ease?: Ease;
  readonly via?: Controls;
}

export interface Run {
  readonly keys: readonly RunKey[];
  readonly velocity: readonly number[];
  readonly settled: boolean;
  readonly needs: Seconds;
}

export interface Sample {
  readonly t: Seconds;
  readonly values: readonly number[];
  readonly velocity: readonly number[];
}

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

const pointOf = (values: readonly number[]): Vec => [values[0]!, values[1]!];

interface Bend {
  readonly via: Controls;
  readonly ease: Ease;
  readonly strays: number;
}

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

const straysCurved = (samples: readonly Sample[], a: number, b: number): number =>
  curving(samples, a, b)?.strays ?? Infinity;

const inside = (curve: Ease): boolean =>
  curve.kind !== "bezier" || curve.points.every((value) => value >= 0 && value <= 1);

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

export const keyCost = (keys: readonly RunKey[]): number =>
  keys.reduce((sum, key) => sum + (key.via ? 1.5 : 1), 0);

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
    const reach = reachOf(last, from, (to) => strays(samples, from, to), tolerance);
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
    throw new SceneError(`ease.spring() needs a positive, finite ${what}, got ${value}.`);

  return value;
};

export class Spring {
  readonly kind = "spring";
  readonly stiffness: number;
  readonly damping: number;
  readonly mass: number;
  readonly omega: number;
  readonly zeta: number;
  #settle: Seconds | undefined;

  constructor({ stiffness = 170, damping = 26, mass = 1 }: SpringOptions) {
    this.stiffness = finite(stiffness, "stiffness");
    this.damping = finite(damping, "damping");
    this.mass = finite(mass, "mass");
    this.omega = Math.sqrt(stiffness / mass);
    this.zeta = damping / (2 * Math.sqrt(stiffness * mass));
  }

  get settle(): Seconds {
    this.#settle ??= this.settleTime([1], [0]);

    return this.#settle;
  }

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

  #left(x0: readonly number[], v0: readonly number[], t: Seconds): number {
    return Math.hypot(
      ...x0.flatMap((x, i) => {
        const [at, speed] = this.state(x, v0[i]!, t);

        return [at, speed / this.omega];
      }),
    );
  }

  settleTime(x0: readonly number[], v0: readonly number[]): Seconds {
    const start = this.#left(x0, v0, 0);

    if (start === 0) return 0;
    const limit = start * SETTLED;
    let [lo, hi] = [0, 1 / this.omega];

    while (this.#left(x0, v0, hi) > limit) {
      [lo, hi] = [hi, hi * 2];

      if (hi > NEVER)
        throw new SceneError(
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

/** Your own easing: progress 0..1 in, how far along the move it is out (0 at 0, 1 at 1; it may overshoot between). Sampled into linear pieces when the scene builds, so the SVG carries no code. */
export type CurveFn = (progress: number) => number;

export type Curve = Ease | Spring | CurveFn;

export const isCurveFn = (curve: Curve): curve is CurveFn => curve instanceof Function;

export const isSpring = (curve: Curve): curve is Spring => curve instanceof Spring;

const SAMPLE_BASE = 16;
const SAMPLE_DEPTH = 6;
const SAMPLE_TOLERANCE = 5e-4;

/** The progress values to sample a CurveFn at: even, then halved wherever a straight piece misses the curve by more than a visible amount. Deterministic. */
export const sampleCurve = (fn: CurveFn): readonly (readonly [at: number, value: number])[] => {
  const at = (p: number): number => {
    const value = fn(p);

    if (!Number.isFinite(value))
      throw new SceneError(
        `A curve function returned ${value} for progress ${p}. It must return a finite number.`,
      );

    return value;
  };

  const [start, finish] = [at(0), at(1)];

  if (Math.abs(start) > 1e-6 || Math.abs(finish - 1) > 1e-6)
    throw new SceneError(
      `A curve function must return 0 at progress 0 and 1 at progress 1, got ${start} and ${finish}. Shape the way there, and let the track's values set where it starts and ends.`,
    );
  const out: (readonly [number, number])[] = [[0, 0]];

  const refine = (a: number, fa: number, b: number, fb: number, depth: number): void => {
    const mid = (a + b) / 2;
    const fm = at(mid);

    if (depth < SAMPLE_DEPTH && Math.abs(fm - (fa + fb) / 2) > SAMPLE_TOLERANCE) {
      refine(a, fa, mid, fm, depth + 1);
      refine(mid, fm, b, fb, depth + 1);
    } else {
      out.push([mid, fm], [b, fb]);
    }
  };

  let [prev, fprev] = [0, 0];

  for (let i = 1; i <= SAMPLE_BASE; i++) {
    const p = i / SAMPLE_BASE;
    const fp = i === SAMPLE_BASE ? 1 : at(p);

    refine(prev, fprev, p, fp, 0);
    [prev, fprev] = [p, fp];
  }

  return out;
};

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
        throw new SceneError(
          `ease.bezier(${curve.points.join(", ")}) ends moving infinitely fast, so a spring can't take its speed. Start the spring later, or end the ease with x2 below 1.`,
        );
      const [ddx, ddy] = [x1 - 2 * x2 + 1, y1 - 2 * y2 + 1];

      return Math.abs(ddx) > 1e-9 ? ddy / ddx : 1;
    }
  }
};

export const ease = {
  ...eases,
  spring: (options: SpringOptions = {}): Spring => new Spring(options),
} as const;
