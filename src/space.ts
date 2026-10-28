import type { Point } from "./layout/box";

export type Degrees = number;

/** World coordinates in blocks, y up. */
export type Vec3 = readonly [x: number, y: number, z: number];

export interface CameraOptions {
  /** Turn about y. 45 looks from +x +z. */
  readonly yaw: Degrees;
  /** Tilt down toward the ground, above 0 and below 90. 30 is the 2:1 pixel-art look, 35.264 is true isometric. */
  readonly pitch: Degrees;
  /** Screen pixels per block edge. */
  readonly unit: number;
}

/** A fixed orthographic camera. Linear, so it maps paths, faces and offsets exactly. */
export interface Camera extends CameraOptions {
  /** Screen position of a world point, keyed like the `x`/`y` channels so it feeds `sampled()` directly. */
  project(p: Vec3): Point;
}

export type Facing = readonly [-1 | 0 | 1, -1 | 0 | 1, -1 | 0 | 1];

const EDGE_ON = 1e-9;

const sign = (value: number): -1 | 0 | 1 => (Math.abs(value) < EDGE_ON ? 0 : value > 0 ? 1 : -1);

export const facingOf = ({ yaw }: CameraOptions): Facing => {
  const turn = (yaw * Math.PI) / 180;
  return [sign(Math.sin(turn)), 1, sign(Math.cos(turn))];
};

export const camera = (options: CameraOptions): Camera => {
  const { yaw, pitch, unit } = options;
  if (!Number.isFinite(yaw)) throw new Error(`camera() needs a finite yaw, got ${yaw}.`);
  if (!(pitch > 0 && pitch < 90)) throw new Error(`camera() needs a pitch between 0 and 90 degrees, got ${pitch}.`);
  if (!(unit > 0)) throw new Error(`camera() needs a positive unit, got ${unit}.`);
  const [turn, tilt] = [(yaw * Math.PI) / 180, (pitch * Math.PI) / 180];
  const right: Vec3 = [Math.cos(turn), 0, -Math.sin(turn)];
  const up: Vec3 = [-Math.sin(turn) * Math.sin(tilt), Math.cos(tilt), -Math.cos(turn) * Math.sin(tilt)];
  const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  return { ...options, project: (p) => ({ x: unit * dot(right, p), y: -unit * dot(up, p) }) };
};
