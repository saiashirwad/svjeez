export type Vec3 = readonly [number, number, number];

export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const len = (a: Vec3): number => Math.hypot(a[0], a[1], a[2]);
export const unit = (a: Vec3): Vec3 => mul(a, 1 / (len(a) || 1));
export const mix3 = (a: Vec3, b: Vec3, t: number): Vec3 => add(a, mul(sub(b, a), t));

/** Turn `a` toward the side of `bias` by `angle` radians. */
export const bend = (a: Vec3, axis: Vec3, bias: Vec3, angle: number): Vec3 => {
  const side = unit(sub(bias, mul(axis, dot(bias, axis))));
  return unit(add(mul(unit(a), Math.cos(angle)), mul(side, Math.sin(angle))));
};

/** A unit vector perpendicular to `a`, picked deterministically from `hint`. */
export const perpendicular = (a: Vec3, hint: Vec3): Vec3 => unit(cross(a, Math.abs(dot(a, hint)) > 0.96 ? [0, 0, 1] : hint));

export interface Projected {
  /** Canvas pixels. */
  readonly x: number;
  readonly y: number;
  /** Larger is nearer the camera. Paint ascending. */
  readonly depth: number;
}

export interface Camera {
  readonly yaw: number;
  readonly pitch: number;
  /** Pixels per world unit. */
  readonly unit: number;
}

const TAU = Math.PI * 2;

/** Turn, tip and project. Orthographic, so faces stay parallel and painter sorting is stable. */
export const project = ({ yaw, pitch, unit: scale }: Camera, [x, y, z]: Vec3): Projected => {
  const turn = (yaw * Math.PI) / 180;
  const tilt = (pitch * Math.PI) / 180;
  const rx = x * Math.cos(turn) - z * Math.sin(turn);
  const rz = x * Math.sin(turn) + z * Math.cos(turn);
  return {
    x: rx * scale,
    y: (Math.sin(tilt) * rz - Math.cos(tilt) * y) * scale,
    depth: rz * Math.cos(tilt) + y * Math.sin(tilt),
  };
};

/** The sun: warm key light from the upper left and a little in front. */
export const LIGHT = unit([-0.55, 0.78, 0.32]);

export const lit = (normal: Vec3): number => Math.abs(dot(unit(normal), LIGHT));

export const polar = (radius: number, angle: number, y = 0): Vec3 => [Math.cos(angle) * radius, y, Math.sin(angle) * radius];

export { TAU };
