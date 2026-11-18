import type { Cubic, Key, Vec } from "./ir";

export type Controls = readonly [control1: Vec, control2: Vec];

export const lerpPoint = (a: Vec, b: Vec, u: number): Vec => [
  a[0] + (b[0] - a[0]) * u,
  a[1] + (b[1] - a[1]) * u,
];

export const lineCubic = (from: Vec, to: Vec): Cubic => [
  lerpPoint(from, to, 1 / 3),
  lerpPoint(from, to, 2 / 3),
  to,
];

export const quadraticCubic = (from: Vec, control: Vec, to: Vec): Cubic => [
  lerpPoint(from, control, 2 / 3),
  lerpPoint(to, control, 2 / 3),
  to,
];

const point = (p0: Vec, [p1, p2]: Controls, p3: Vec, s: number): Vec => {
  const r = 1 - s;
  const [a, b, c, d] = [r * r * r, 3 * r * r * s, 3 * r * s * s, s * s * s];

  return [
    a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
    a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1],
  ];
};

const STEPS = 256;

interface Table {
  readonly from: Vec;
  readonly to: Vec;
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

export const curveLength = (from: Vec, via: Controls, to: Vec): number =>
  tableOf(from, via, to).lengths[STEPS]!;

const paramAt = (from: Vec, via: Controls, to: Vec, share: number): number => {
  const { lengths } = tableOf(from, via, to);
  const goal = Math.min(1, Math.max(0, share)) * lengths[STEPS]!;
  let [lo, hi] = [0, STEPS];

  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;

    if (lengths[mid]! < goal) lo = mid;
    else hi = mid;
  }

  const span = lengths[hi]! - lengths[lo]!;

  return (lo + (span > 0 ? (goal - lengths[lo]!) / span : 0)) / STEPS;
};

export const alongCurve = (from: Vec, via: Controls, to: Vec, share: number): Vec =>
  point(from, via, to, paramAt(from, via, to, share));

export const splitCurve = (
  from: Vec,
  via: Controls,
  to: Vec,
  share: number,
): readonly [head: Controls, at: Vec, tail: Controls] => {
  const s = paramAt(from, via, to, share);
  const lerp = (a: Vec, b: Vec): Vec => lerpPoint(a, b, s);
  const [a, b, c] = [lerp(from, via[0]), lerp(via[0], via[1]), lerp(via[1], to)];
  const [d, e] = [lerp(a, b), lerp(b, c)];

  return [[a, d], lerp(d, e), [e, c]];
};

export const hermiteControls = (from: Vec, leave: Vec, arrive: Vec, to: Vec): Controls => [
  [from[0] + leave[0] / 3, from[1] + leave[1] / 3],
  [to[0] - arrive[0] / 3, to[1] - arrive[1] / 3],
];

export const onCurve = <T>(from: Key<T>, to: Key<T>, share: number): T | undefined => {
  if (!to.via) return undefined;
  // SAFETY: only a lane of points has a key with `via` (ir.ts), so both values are points and so is the result.
  const [a, b] = [from.value as Vec, to.value as Vec];

  // SAFETY: as above, T is Vec.
  return alongCurve(a, to.via, b, share) as T;
};

export const isCurved = (keys: readonly Key<unknown>[]): boolean =>
  keys.some((key) => key.via !== undefined);

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

  for (let round = 0; round < REFITS && found; round++) {
    const via = found;

    at = at.map((u, i) => nearest(from, via, to, points[i]!, u));
    found = handles(from, leave, arrive, to, points, at) ?? found;
  }

  return found;
};

const REFITS = 6;

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
