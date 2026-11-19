import { path, type Geometry, type Vec } from "svjeez";
import { SceneError } from "svjeez/tools";

const DEG = Math.PI / 180;

const fail = (problem: string, fix?: string): never => {
  throw new SceneError(problem, fix);
};

const show = (p: Vec): string => `[${p.map((n) => Math.round(n * 100) / 100).join(", ")}]`;

const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1]];

const add = (a: Vec, b: Vec): Vec => [a[0] + b[0], a[1] + b[1]];

const times = (a: Vec, k: number): Vec => [a[0] * k, a[1] * k];

const cross = (a: Vec, b: Vec): number => a[0] * b[1] - a[1] * b[0];

const unit = (a: Vec, what: string): Vec => {
  const length = Math.hypot(a[0], a[1]);

  return length > 1e-9 ? times(a, 1 / length) : fail(`${what} needs two different points.`);
};

const angleOf = ([x, y]: Vec): number => Math.atan2(y, x) / DEG;

export const distance = (a: Vec, b: Vec): number => Math.hypot(b[0] - a[0], b[1] - a[1]);

export const midpoint = (a: Vec, b: Vec): Vec => times(add(a, b), 0.5);

export const extend = (from: Vec, through: Vec, by: number): Vec =>
  add(through, times(unit(sub(through, from), "extend()"), by));

export const meet = (a: readonly [Vec, Vec], b: readonly [Vec, Vec]): Vec => {
  const [p, r] = [a[0], sub(a[1], a[0])];
  const [q, s] = [b[0], sub(b[1], b[0])];
  const denominator = cross(r, s);

  if (Math.abs(denominator) < 1e-9)
    fail(
      `meet() found no point: the line through ${show(a[0])} and ${show(a[1])} runs parallel to the one through ${show(b[0])} and ${show(b[1])}.`,
    );

  return add(p, times(r, cross(sub(q, p), s) / denominator));
};

export interface Circle {
  readonly center: Vec;
  readonly radius: number;
}

const isCircle = (value: Circle | readonly [Vec, Vec]): value is Circle => "center" in value;

export const crossings = (a: Circle, b: Circle | readonly [Vec, Vec]): Vec[] => {
  if (!isCircle(b)) {
    const [p, q] = b;
    const d = unit(sub(q, p), "crossings()");
    const f = sub(p, a.center);
    const along = -(f[0] * d[0] + f[1] * d[1]);
    const gap = a.radius ** 2 - (f[0] ** 2 + f[1] ** 2 - along ** 2);

    if (gap < -1e-9) return [];
    const half = Math.sqrt(Math.max(0, gap));

    return [add(p, times(d, along - half)), add(p, times(d, along + half))];
  }

  const other = b;
  const apart = distance(a.center, other.center);

  if (
    apart < 1e-9 ||
    apart > a.radius + other.radius + 1e-9 ||
    apart < Math.abs(a.radius - other.radius) - 1e-9
  )
    return [];
  const along = (a.radius ** 2 - other.radius ** 2 + apart ** 2) / (2 * apart);
  const half = Math.sqrt(Math.max(0, a.radius ** 2 - along ** 2));
  const d = times(sub(other.center, a.center), 1 / apart);
  const base = add(a.center, times(d, along));
  const n: Vec = [-d[1], d[0]];

  return [add(base, times(n, -half)), add(base, times(n, half))];
};

export const bisect = (from: Vec, vertex: Vec, to: Vec): Vec => {
  const [u, v] = [unit(sub(from, vertex), "bisect()"), unit(sub(to, vertex), "bisect()")];
  const sum = add(u, v);

  return add(vertex, Math.hypot(...sum) < 1e-9 ? [-u[1], u[0]] : unit(sum, "bisect()"));
};

export const foot = (point: Vec, a: Vec, b: Vec): Vec => {
  const d = unit(sub(b, a), "foot()");
  const along = (point[0] - a[0]) * d[0] + (point[1] - a[1]) * d[1];

  return add(a, times(d, along));
};

const arcPath = (center: Vec, radius: number, start: number, sweep: number): Geometry => {
  const pieces = Math.max(1, Math.ceil(Math.abs(sweep) / 90));
  const step = (sweep / pieces) * DEG;
  const k = (4 / 3) * Math.tan(step / 4);

  const at = (angle: number): Vec => [
    center[0] + radius * Math.cos(angle),
    center[1] + radius * Math.sin(angle),
  ];

  const tangent = (angle: number): Vec => [
    -Math.sin(angle) * radius * k,
    Math.cos(angle) * radius * k,
  ];

  let built = path().moveTo(at(start * DEG));

  for (let i = 0; i < pieces; i++) {
    const [a, b] = [start * DEG + i * step, start * DEG + (i + 1) * step];

    built = built.curveTo(add(at(a), tangent(a)), sub(at(b), tangent(b)), at(b));
  }

  return built;
};

export const compass = (
  center: Vec,
  through: Vec,
  { sweep = 360 }: { readonly sweep?: number } = {},
): Geometry => {
  const radius = distance(center, through);

  if (!(radius > 0))
    fail(`compass() needs a point away from its center, got ${show(through)} for both.`);

  return arcPath(center, radius, angleOf(sub(through, center)), sweep);
};

export const angle = (
  from: Vec,
  vertex: Vec,
  to: Vec,
  { radius = 24 }: { readonly radius?: number } = {},
): Geometry => {
  const start = angleOf(sub(from, vertex));
  let sweep = angleOf(sub(to, vertex)) - start;

  while (sweep > 180) sweep -= 360;

  while (sweep < -180) sweep += 360;

  return arcPath(vertex, radius, start, sweep);
};

export const rightAngle = (
  from: Vec,
  vertex: Vec,
  to: Vec,
  { size = 12 }: { readonly size?: number } = {},
): Geometry => {
  const [u, v] = [
    times(unit(sub(from, vertex), "rightAngle()"), size),
    times(unit(sub(to, vertex), "rightAngle()"), size),
  ];

  return path()
    .moveTo(add(vertex, u))
    .lineTo(add(add(vertex, u), v))
    .lineTo(add(vertex, v));
};

export const ticks = (
  a: Vec,
  b: Vec,
  {
    count = 1,
    length = 10,
    gap = 4,
  }: { readonly count?: number; readonly length?: number; readonly gap?: number } = {},
): Geometry => {
  const d = unit(sub(b, a), "ticks()");
  const n: Vec = [-d[1] * (length / 2), d[0] * (length / 2)];
  const middle = midpoint(a, b);

  return Array.from({ length: count }, (_, i) =>
    add(middle, times(d, (i - (count - 1) / 2) * gap)),
  ).reduce((built, at) => built.moveTo(sub(at, n)).lineTo(add(at, n)), path());
};

export const brace = (
  width: number,
  { height = 10 }: { readonly height?: number } = {},
): Geometry => {
  if (!(width > 0 && height > 0))
    fail(`brace() needs a width and height above 0, got ${width} and ${height}.`);
  const [w, h] = [width, height];
  const r = Math.min(h / 2, w / 4);
  const mid = h / 2;

  return path()
    .moveTo([0, 0])
    .quadTo([0, mid], [r, mid])
    .lineTo([w / 2 - r, mid])
    .quadTo([w / 2, mid], [w / 2, h])
    .quadTo([w / 2, mid], [w / 2 + r, mid])
    .lineTo([w - r, mid])
    .quadTo([w, mid], [w, 0]);
};
