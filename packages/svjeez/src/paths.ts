import { num } from "./format";
import { NUDGE, ease, motion, type Motion, type Seconds } from "./motion";

/** SVG path data, as a `<path d>` takes it. */
export type PathData = `M${string}` | `m${string}`;

type Vec = readonly [number, number];

/** A cubic from the previous end: two controls and an end. */
type Cubic = readonly [Vec, Vec, Vec];

interface Ring {
  readonly start: Vec;
  readonly curves: readonly Cubic[];
  readonly closed: boolean;
}

const NUMBER = /-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi;

const ARITY = new Map([
  ["M", 2],
  ["L", 2],
  ["H", 1],
  ["V", 1],
  ["C", 6],
  ["S", 4],
  ["Q", 4],
  ["T", 2],
  ["A", 7],
  ["Z", 0],
]);

const lerp = (a: Vec, b: Vec, u: number): Vec => [
  a[0] + (b[0] - a[0]) * u,
  a[1] + (b[1] - a[1]) * u,
];

const line = (a: Vec, b: Vec): Cubic => [lerp(a, b, 1 / 3), lerp(a, b, 2 / 3), b];

/** Arc to cubics, after the SVG implementation notes' endpoint-to-center conversion. */
const arc = (
  from: Vec,
  rx: number,
  ry: number,
  angle: number,
  large: boolean,
  sweep: boolean,
  to: Vec,
): Cubic[] => {
  if (rx === 0 || ry === 0 || (from[0] === to[0] && from[1] === to[1])) return [line(from, to)];
  const phi = (angle * Math.PI) / 180;
  const [cos, sin] = [Math.cos(phi), Math.sin(phi)];
  const dx = (from[0] - to[0]) / 2;
  const dy = (from[1] - to[1]) / 2;
  const x1 = cos * dx + sin * dy;
  const y1 = -sin * dx + cos * dy;
  let [a, b] = [Math.abs(rx), Math.abs(ry)];
  const grow = (x1 * x1) / (a * a) + (y1 * y1) / (b * b);

  if (grow > 1) [a, b] = [a * Math.sqrt(grow), b * Math.sqrt(grow)];
  const num2 = a * a * b * b - a * a * y1 * y1 - b * b * x1 * x1;
  const den = a * a * y1 * y1 + b * b * x1 * x1;
  const k = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, num2 / den));
  const cx1 = (k * a * y1) / b;
  const cy1 = (-k * b * x1) / a;
  const cx = cos * cx1 - sin * cy1 + (from[0] + to[0]) / 2;
  const cy = sin * cx1 + cos * cy1 + (from[1] + to[1]) / 2;

  const theta = (ux: number, uy: number, vx: number, vy: number) =>
    Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);

  const start = theta(1, 0, (x1 - cx1) / a, (y1 - cy1) / b);
  let delta = theta((x1 - cx1) / a, (y1 - cy1) / b, (-x1 - cx1) / a, (-y1 - cy1) / b);

  if (!sweep && delta > 0) delta -= 2 * Math.PI;

  if (sweep && delta < 0) delta += 2 * Math.PI;
  const pieces = Math.max(1, Math.ceil(Math.abs(delta) / (Math.PI / 2)));
  const step = delta / pieces;
  const t = (4 / 3) * Math.tan(step / 4);

  const at = (u: number): Vec => [
    cx + a * Math.cos(u) * cos - b * Math.sin(u) * sin,
    cy + a * Math.cos(u) * sin + b * Math.sin(u) * cos,
  ];

  const tangent = (u: number): Vec => [
    -a * Math.sin(u) * cos - b * Math.cos(u) * sin,
    -a * Math.sin(u) * sin + b * Math.cos(u) * cos,
  ];

  return Array.from({ length: pieces }, (_, i): Cubic => {
    const [u0, u1] = [start + i * step, start + (i + 1) * step];
    const [p0, p1] = [at(u0), at(u1)];
    const [d0, d1] = [tangent(u0), tangent(u1)];

    return [
      [p0[0] + t * d0[0], p0[1] + t * d0[1]],
      [p1[0] - t * d1[0], p1[1] - t * d1[1]],
      i === pieces - 1 ? to : p1,
    ];
  });
};

/** Every subpath of `d` as absolute cubics. */
const parse = (d: string): Ring[] => {
  const rings: Ring[] = [];
  let curves: Cubic[] = [];
  let start: Vec = [0, 0];
  let pen: Vec = [0, 0];
  let control: Vec | undefined;
  let quad: Vec | undefined;
  let open = false;

  const finish = (closed: boolean) => {
    if (open) rings.push({ start, curves, closed });
    curves = [];
    open = false;
  };

  for (const [, letter, body] of d.matchAll(/([A-Za-z])([^A-Za-z]*)/g)) {
    const upper = letter!.toUpperCase();
    const arity = ARITY.get(upper);

    if (arity === undefined)
      throw new Error(`matchPaths() cannot read the "${letter}" command in "${d}".`);
    const relative = letter !== upper;
    const n = (body!.match(NUMBER) ?? []).map(Number);

    if (upper === "Z") {
      if (open && (pen[0] !== start[0] || pen[1] !== start[1])) curves.push(line(pen, start));
      pen = start;
      finish(true);
      control = quad = undefined;
      continue;
    }

    if (n.length === 0 || n.length % arity !== 0)
      throw new Error(`matchPaths() found ${n.length} numbers after "${letter}" in "${d}".`);

    for (let i = 0; i < n.length; i += arity) {
      const v = n.slice(i, i + arity);
      const abs = (x: number, y: number): Vec => (relative ? [pen[0] + x, pen[1] + y] : [x, y]);
      let next: Vec;
      let lastControl: Vec | undefined;
      let lastQuad: Vec | undefined;

      if (upper === "M" && i === 0) {
        finish(false);
        start = pen = abs(v[0]!, v[1]!);
        open = true;
        control = quad = undefined;
        continue;
      }

      if (!open) {
        start = pen;
        open = true;
      }

      switch (upper) {
        case "M":
        case "L":
        case "T":
          next = abs(v[0]!, v[1]!);

          if (upper === "T") {
            const q: Vec = quad ? [2 * pen[0] - quad[0], 2 * pen[1] - quad[1]] : pen;
            curves.push([lerp(pen, q, 2 / 3), lerp(next, q, 2 / 3), next]);
            lastQuad = q;
          } else curves.push(line(pen, next));
          break;
        case "H":
          next = [relative ? pen[0] + v[0]! : v[0]!, pen[1]];
          curves.push(line(pen, next));
          break;
        case "V":
          next = [pen[0], relative ? pen[1] + v[0]! : v[0]!];
          curves.push(line(pen, next));
          break;
        case "C": {
          const c1 = abs(v[0]!, v[1]!);
          const c2 = abs(v[2]!, v[3]!);
          next = abs(v[4]!, v[5]!);
          curves.push([c1, c2, next]);
          lastControl = c2;
          break;
        }

        case "S": {
          const c1: Vec = control ? [2 * pen[0] - control[0], 2 * pen[1] - control[1]] : pen;
          const c2 = abs(v[0]!, v[1]!);
          next = abs(v[2]!, v[3]!);
          curves.push([c1, c2, next]);
          lastControl = c2;
          break;
        }

        case "Q": {
          const q = abs(v[0]!, v[1]!);
          next = abs(v[2]!, v[3]!);
          curves.push([lerp(pen, q, 2 / 3), lerp(next, q, 2 / 3), next]);
          lastQuad = q;
          break;
        }

        default:
          next = abs(v[5]!, v[6]!);
          curves.push(...arc(pen, v[0]!, v[1]!, v[2]!, v[3] !== 0, v[4] !== 0, next));
      }

      pen = next;
      control = lastControl;
      quad = lastQuad;
    }
  }

  finish(false);

  return rings;
};

/** The curve split at its middle, by de Casteljau. */
const halve = (from: Vec, [c1, c2, to]: Cubic): [Cubic, Cubic] => {
  const a = lerp(from, c1, 0.5);
  const b = lerp(c1, c2, 0.5);
  const c = lerp(c2, to, 0.5);
  const ab = lerp(a, b, 0.5);
  const bc = lerp(b, c, 0.5);
  const mid = lerp(ab, bc, 0.5);

  return [
    [a, ab, mid],
    [bc, c, to],
  ];
};

const chord = (from: Vec, curve: Cubic) => Math.hypot(curve[2][0] - from[0], curve[2][1] - from[1]);

/** Split the longest curves in half until the ring has `count` of them. */
const split = (ring: Ring, count: number): Ring => {
  const curves = ring.curves.length > 0 ? [...ring.curves] : [line(ring.start, ring.start)];

  while (curves.length < count) {
    let longest = 0;
    let best = -1;

    curves.forEach((curve, i) => {
      const length = chord(i === 0 ? ring.start : curves[i - 1]![2], curve);

      if (length > best) [best, longest] = [length, i];
    });
    const from = longest === 0 ? ring.start : curves[longest - 1]![2];
    curves.splice(longest, 1, ...halve(from, curves[longest]!));
  }

  return { ...ring, curves };
};

/** The same closed ring, starting `by` curves later. */
const rotate = (ring: Ring, by: number): Ring => {
  if (by === 0) return ring;
  const curves = [...ring.curves.slice(by), ...ring.curves.slice(0, by)];

  return { ...ring, start: ring.curves[by - 1]![2], curves };
};

const ends = (ring: Ring): Vec[] => ring.curves.map((curve) => curve[2]);

/** Turn a closed ring to start where it lies closest to `target`, point for point. */
const align = (ring: Ring, target: Ring): Ring => {
  if (!ring.closed || !target.closed) return ring;
  const [a, b] = [ends(ring), ends(target)];
  let best = 0;
  let error = Infinity;

  for (let by = 0; by < a.length; by++) {
    let sum = 0;

    for (let i = 0; i < a.length && sum < error; i++) {
      const p = a[(i + by) % a.length]!;
      const q = b[i]!;
      sum += (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2;
    }

    if (sum < error) [error, best] = [sum, by];
  }

  return rotate(ring, best);
};

const middle = (ring: Ring): Vec => {
  const points = [ring.start, ...ends(ring)];
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);

  return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
};

const pt = ([x, y]: Vec, places: number) => `${num(x, places)} ${num(y, places)}`;

const write = (rings: readonly Ring[], places: number): PathData =>
  // SAFETY: every ring is written starting with M, so the joined string is path data.
  rings
    .map(
      (ring) =>
        `M${pt(ring.start, places)}C${ring.curves.map((c) => c.map((p) => pt(p, places)).join(" ")).join(" ")}${ring.closed ? "Z" : ""}`,
    )
    .join("") as PathData;

export interface MatchOptions {
  /** Decimal places in the output. Default 2. */
  readonly precision?: number;
}

/**
 * The same shapes rewritten so each has the same commands, ready for `motion({ d })`. Subpaths pair by order, and a
 * shape with fewer grows its missing ones from a point. Each closed ring starts where it lies closest to the
 * ring before it, so a morph doesn't twist.
 */
export function matchPaths(paths: readonly string[], options: MatchOptions = {}): PathData[] {
  const places = options.precision ?? 2;

  if (paths.length === 0) return [];

  const parsed = paths.map((d) => {
    const rings = parse(d);

    if (rings.length === 0) throw new Error(`matchPaths() found no shape in "${d}".`);

    return rings;
  });

  const count = Math.max(...parsed.map((rings) => rings.length));

  const filled = parsed.map((rings, v) =>
    Array.from({ length: count }, (_, r): Ring => {
      const own = rings[r];

      if (own) return own;

      const donor = [...parsed.slice(0, v).reverse(), ...parsed.slice(v + 1)].find(
        (other) => other[r],
      );

      const at = middle(donor![r]!);

      return { start: at, curves: [], closed: donor![r]!.closed };
    }),
  );

  const sizes = Array.from({ length: count }, (_, r) =>
    Math.max(1, ...filled.map((rings) => rings[r]!.curves.length)),
  );

  const even = filled.map((rings) => rings.map((ring, r) => split(ring, sizes[r]!)));

  for (let v = 1; v < even.length; v++)
    even[v] = even[v]!.map((ring, r) => align(ring, even[v - 1]![r]!));

  return even.map((rings) => write(rings, places));
}

/** The commands of a path with every number taken out, so two paths can be checked for a smooth morph. */
export const commandsOf = (d: string): string => d.replace(NUMBER, "#").replace(/[\s,]+/g, "");

const numbers = (d: string): number[] => (d.match(NUMBER) ?? []).map(Number);

export interface SampledPathOptions {
  readonly duration: Seconds;
  /** Seconds between samples before simplifying. Default 0.05. */
  readonly step?: Seconds;
  /** How far, in px, any point of the replay may stray from the samples. */
  readonly tolerance: number;
  /** Decimal places in the output. Default 1. */
  readonly precision?: number;
  /**
   * Px beyond `tolerance` that a point may stray, given where it sits in a sample, for points nobody sees, such as
   * the hidden side of a globe folded out past its clip. Numbers are read in pairs as points. Default none.
   */
  readonly slack?: (x: number, y: number) => number;
}

/**
 * Sample `(t) => d` densely, then keep only the keys the shape needs. Every sample must have the same commands,
 * as `matchPaths()` writes them.
 */
export function sampledPath(
  sample: (t: Seconds) => string,
  options: SampledPathOptions,
): Motion<"d"> {
  const { duration, step = 0.05, tolerance } = options;
  const places = options.precision ?? 1;

  if (!Number.isFinite(duration) || duration <= 0)
    throw new Error(`sampledPath() needs a positive duration, got ${duration}.`);

  if (!Number.isFinite(step) || step <= 0)
    throw new Error(`sampledPath() needs a positive step, got ${step}.`);

  if (!(tolerance >= 0))
    throw new Error(`sampledPath() needs a non-negative tolerance, got ${tolerance}.`);
  const edge = duration * NUDGE;

  const times = Array.from(
    { length: Math.ceil((duration - edge) / step) },
    (_, i) => i * step,
  ).concat(duration);

  const frames = times.map(sample);
  const commands = commandsOf(frames[0]!);
  frames.forEach((d, i) => {
    if (commandsOf(d) !== commands)
      throw new Error(
        `sampledPath() returned a path with different commands at t=${num(times[i]!)} than at t=0. Write every sample through matchPaths() or with the same points.`,
      );
  });
  const values = frames.map(numbers);
  const { slack } = options;

  const room = slack
    ? values.map((v) =>
        Float64Array.from({ length: v.length >> 1 }, (_, k) => slack(v[2 * k]!, v[2 * k + 1]!)),
      )
    : undefined;

  /** The worst point distance between frame i and the straight blend of frames a and b, less the slack it has. */
  const miss = (a: number, b: number, i: number) => {
    const u = (times[i]! - times[a]!) / (times[b]! - times[a]!);
    let worst = 0;

    for (let k = 0; k + 1 < values[i]!.length; k += 2) {
      const x = values[a]![k]! + (values[b]![k]! - values[a]![k]!) * u - values[i]![k]!;

      const y =
        values[a]![k + 1]! + (values[b]![k + 1]! - values[a]![k + 1]!) * u - values[i]![k + 1]!;

      worst = room
        ? Math.max(worst, Math.hypot(x, y) - room[i]![k >> 1]!)
        : Math.max(worst, x * x + y * y);
    }

    return room ? worst : Math.sqrt(worst);
  };

  const kept = [0, frames.length - 1];

  const divide = (a: number, b: number): void => {
    let worst = -1;
    let error = tolerance;

    for (let i = a + 1; i < b; i++) {
      const m = miss(a, b, i);

      if (m > error) [worst, error] = [i, m];
    }

    if (worst < 0) return;
    kept.push(worst);
    divide(a, worst);
    divide(worst, b);
  };

  divide(0, frames.length - 1);
  kept.sort((a, b) => a - b);

  const rounded = (i: number) => {
    let k = 0;

    // SAFETY: the replacement keeps every command letter, so the result is path data like the sample.
    return frames[i]!.replace(NUMBER, () => num(values[i]![k++]!, places)) as PathData;
  };

  let track: Motion<"d"> = motion({ d: rounded(0) });

  for (let j = 1; j < kept.length; j++) {
    const [from, to] = [kept[j - 1]!, kept[j]!];
    track = track.at(times[from]!).to({ d: rounded(to) }, times[to]! - times[from]!, ease.linear);
  }

  return track;
}
