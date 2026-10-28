export interface Point {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface Seat {
  readonly along: number;
  readonly around: number;
}

export type Surface = (seat: Seat) => Point;

const TAU = Math.PI * 2;
const GOLDEN = (Math.sqrt(5) - 1) / 2;

export const seat = (i: number, n: number): Seat => ({ along: (i + 0.5) / n, around: (i * GOLDEN) % 1 });

const add = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const times = (a: Point, k: number): Point => ({ x: a.x * k, y: a.y * k, z: a.z * k });
const dot = (a: Point, b: Point): number => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: Point, b: Point): Point => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const unit = (a: Point): Point => times(a, 1 / Math.hypot(a.x, a.y, a.z));

export const lerp = (a: Point, b: Point, t: number): Point => add(a, times(add(b, times(a, -1)), t));

export const height = (around: number): number => 1 - 4 * Math.abs(around - 0.5);

export const sphere = (radius: number): Surface => ({ along, around }) => {
  const lon = 2 * TAU * along;
  const y = radius * height(around);
  const ring = Math.sqrt(radius * radius - y * y);
  return { x: ring * Math.cos(lon), y, z: ring * Math.sin(lon) };
};

export interface Knot {
  readonly radius: number;
  readonly wobble: number;
  readonly thickness: number;
}

export const knot = ({ radius, wobble, thickness }: Knot): Surface => ({ along, around }) => {
  const spine = (s: number): Point => {
    const lon = 2 * TAU * s;
    const reach = radius + wobble * Math.cos(3 * TAU * s);
    return { x: reach * Math.cos(lon), y: wobble * Math.sin(3 * TAU * s), z: reach * Math.sin(lon) };
  };
  const center = spine(along);
  const tangent = unit(add(spine(along + 1e-4), times(spine(along - 1e-4), -1)));
  const outward = unit({ x: center.x, y: 0, z: center.z });
  const normal = unit(add(outward, times(tangent, -dot(outward, tangent))));
  const binormal = cross(tangent, normal);
  const v = TAU * around + Math.PI / 2;
  return add(center, times(add(times(normal, Math.cos(v)), times(binormal, Math.sin(v))), thickness));
};

export interface Camera {
  readonly pitch: number;
  readonly distance: number;
  readonly zoom: number;
}

export interface Projected {
  readonly x: number;
  readonly y: number;
  readonly depth: number;
  readonly size: number;
}

export const project = ({ pitch, distance, zoom }: Camera, yaw: number, p: Point): Projected => {
  const x = p.x * Math.cos(yaw) - p.z * Math.sin(yaw);
  const z = p.x * Math.sin(yaw) + p.z * Math.cos(yaw);
  const up = p.y * Math.cos(pitch) + z * Math.sin(pitch);
  const depth = z * Math.cos(pitch) - p.y * Math.sin(pitch);
  const size = distance / (distance + depth);
  return { x: x * zoom * size, y: -up * zoom * size, depth, size };
};
