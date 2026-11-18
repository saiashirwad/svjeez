import type { Key, Vec } from "./ir";

/**
 * The curved keys of a lane of points (`Key.via`): a cubic Bézier from the key before to the key, walked by share of
 * its length. Every reader of a lane goes through `alongCurve`, so a backend, the editor's boxes and the fitter
 * that wrote the key all agree on where the point is.
 */
export type Controls = readonly [control1: Vec, control2: Vec];

const point = (p0: Vec, [p1, p2]: Controls, p3: Vec, s: number): Vec => {
  const r = 1 - s;
  const [a, b, c, d] = [r * r * r, 3 * r * r * s, 3 * r * s * s, s * s * s];

  return [
    a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
    a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1],
  ];
};

/** Steps of the parameter a curve's length is measured over: well under a thousandth of a pixel off on any key. */
const STEPS = 256;

interface Table {
  readonly from: Vec;
  readonly to: Vec;
  /** The length walked by each step of the parameter, from the start. */
  readonly lengths: Float64Array;
}

const tables = new WeakMap<Controls, Table>();

const tableOf = (from: Vec, via: Controls, to: Vec): Table => {
  const known = tables.get(via);

  if (
    known &&
    known.from[0] === from[0] &&
    known.from[1] === from[1] &&
    known.to[0] === to[0] &&
    known.to[1] === to[1]
  )
    return known;
  const lengths = new Float64Array(STEPS + 1);
  let last = from;

  for (let i = 1; i <= STEPS; i++) {
    const next = point(from, via, to, i / STEPS);

    lengths[i] = lengths[i - 1]! + Math.hypot(next[0] - last[0], next[1] - last[1]);
    last = next;
  }

  const table = { from, to, lengths };

  tables.set(via, table);

  return table;
};

/** How long the curve from `from` through `via` to `to` is. */
export const curveLength = (from: Vec, via: Controls, to: Vec): number =>
  tableOf(from, via, to).lengths[STEPS]!;

/** The point `share` (0 to 1) of the way along the curve, by length. */
export const alongCurve = (from: Vec, via: Controls, to: Vec, share: number): Vec => {
  const { lengths } = tableOf(from, via, to);
  const goal = Math.min(1, Math.max(0, share)) * lengths[STEPS]!;
  let [lo, hi] = [0, STEPS];

  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;

    if (lengths[mid]! < goal) lo = mid;
    else hi = mid;
  }

  const span = lengths[hi]! - lengths[lo]!;
  const s = (lo + (span > 0 ? (goal - lengths[lo]!) / span : 0)) / STEPS;

  return point(from, via, to, s);
};

/** The controls of the cubic from `from` to `to` that leaves and arrives at these speeds, per whole curve. */
export const hermiteControls = (from: Vec, leave: Vec, arrive: Vec, to: Vec): Controls => [
  [from[0] + leave[0] / 3, from[1] + leave[1] / 3],
  [to[0] - arrive[0] / 3, to[1] - arrive[1] / 3],
];

/**
 * Where a lane is `share` of the way from key `from` to key `to` when `to` is curved, and undefined when it is not:
 * readers blend a straight key their own way.
 */
export const onCurve = <T>(from: Key<T>, to: Key<T>, share: number): T | undefined => {
  if (!to.via) return undefined;
  // SAFETY: only a lane of points has a key with `via` (ir.ts), so both values are points and so is the result.
  const [a, b] = [from.value as Vec, to.value as Vec];

  // SAFETY: as above, T is Vec.
  return alongCurve(a, to.via, b, share) as T;
};

/** Whether a lane has a curved key. */
export const isCurved = (keys: readonly Key<unknown>[]): boolean =>
  keys.some((key) => key.via !== undefined);

/**
 * The controls of the cubic from `from` to `to` that leaves along `leave` and arrives along `arrive` (directions only)
 * and passes nearest `points`, each at its parameter in `params`: the least-squares fit of the two handle lengths
 * (Schneider's). Undefined when no positive pair fits.
 */
export const fitControls = (
  from: Vec,
  leave: Vec,
  arrive: Vec,
  to: Vec,
  points: readonly Vec[],
  params: readonly number[],
): Controls | undefined => {
  let found = handles(from, leave, arrive, to, points, params);
  let at = params;

  // Each point's parameter is moved to where the curve passes nearest it, and the handles fitted again (a Newton step
  // each time): the parameters given are only a first guess at where the curve is.
  for (let round = 0; round < REFITS && found; round++) {
    const via = found;

    at = at.map((u, i) => nearest(from, via, to, points[i]!, u));
    found = handles(from, leave, arrive, to, points, at) ?? found;
  }

  return found;
};

/** Rounds of moving the parameters and fitting again. */
const REFITS = 6;

/** The parameter near `u` where the curve passes nearest `target`, by one Newton step. */
const nearest = (from: Vec, [c1, c2]: Controls, to: Vec, target: Vec, u: number): number => {
  const r = 1 - u;
  const at = point(from, [c1, c2], to, u);

  const d1 = [0, 1].map(
    (c) =>
      3 * (r * r * (c1[c]! - from[c]!) + 2 * r * u * (c2[c]! - c1[c]!) + u * u * (to[c]! - c2[c]!)),
  );

  const d2 = [0, 1].map(
    (c) => 6 * (r * (c2[c]! - 2 * c1[c]! + from[c]!) + u * (to[c]! - 2 * c2[c]! + c1[c]!)),
  );

  const off = [at[0] - target[0], at[1] - target[1]];
  const top = off[0]! * d1[0]! + off[1]! * d1[1]!;
  const bottom = d1[0]! ** 2 + d1[1]! ** 2 + off[0]! * d2[0]! + off[1]! * d2[1]!;

  return Math.abs(bottom) < 1e-12 ? u : Math.min(1, Math.max(0, u - top / bottom));
};

const handles = (
  from: Vec,
  leave: Vec,
  arrive: Vec,
  to: Vec,
  points: readonly Vec[],
  params: readonly number[],
): Controls | undefined => {
  const unit = ([x, y]: Vec): Vec | undefined => {
    const length = Math.hypot(x, y);

    return length > 1e-12 ? [x / length, y / length] : undefined;
  };

  const [t1, t2] = [unit(leave), unit(arrive)];

  if (!t1 || !t2) return undefined;
  let [c11, c12, c22, x1, x2] = [0, 0, 0, 0, 0];

  points.forEach((point, i) => {
    const u = params[i]!;
    const r = 1 - u;
    const [b0, b1, b2, b3] = [r * r * r, 3 * u * r * r, 3 * u * u * r, u * u * u];
    const a1: Vec = [t1[0] * b1, t1[1] * b1];
    const a2: Vec = [-t2[0] * b2, -t2[1] * b2];

    const rest: Vec = [
      point[0] - from[0] * (b0 + b1) - to[0] * (b2 + b3),
      point[1] - from[1] * (b0 + b1) - to[1] * (b2 + b3),
    ];

    c11 += a1[0] * a1[0] + a1[1] * a1[1];
    c12 += a1[0] * a2[0] + a1[1] * a2[1];
    c22 += a2[0] * a2[0] + a2[1] * a2[1];
    x1 += a1[0] * rest[0] + a1[1] * rest[1];
    x2 += a2[0] * rest[0] + a2[1] * rest[1];
  });

  const det = c11 * c22 - c12 * c12;

  if (Math.abs(det) < 1e-12) return undefined;
  const [alpha, beta] = [(x1 * c22 - x2 * c12) / det, (c11 * x2 - c12 * x1) / det];

  if (!(alpha > 0 && beta > 0)) return undefined;

  return [
    [from[0] + t1[0] * alpha, from[1] + t1[1] * alpha],
    [to[0] - t2[0] * beta, to[1] - t2[1] * beta],
  ];
};
