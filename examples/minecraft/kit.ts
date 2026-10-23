import { voxel } from "svg-motion";

export const W = 960;
export const H = 600;
export const D = 60;

export const CAMERA = voxel.camera({ yaw: 45, pitch: 30, unit: 26 });

/** Cells per island side. */
export const GRID = 14;

/** Where the world's origin lands on the canvas, so the island's middle sits a little below center. */
export const ORIGIN = (() => {
  const mid = CAMERA.project([GRID / 2, 2, GRID / 2]);
  return { x: W / 2 - mid.x, y: 350 - mid.y };
})();

/** The story, in seconds. Everything else is timed against these. */
export const BEAT = {
  rise: 0.8,
  risen: 9.2,
  lake: 8.2,
  trees: [10.2, 13.2, 16.2],
  flowers: 18.4,
  flowersEnd: 21.6,
  hut: 22.4,
  hutEnd: 29.6,
  dusk: 30,
  dim: 34,
  moonRise: 36,
  sunset: 38,
  night: 40,
  lights: 34,
  lightsOut: 49.5,
  snow: 44,
  freeze: 45.4,
  snowed: 49,
  sunRise: 47,
  dawn: 48,
  day: 52,
  fall: 52.4,
  void: 53.2,
  voided: 58.6,
} as const;

export const C = {
  sun: "#ffe566",
  sunCore: "#fff6b8",
  moon: "#dfe8f5",
  moonShade: "#b4c2d9",
  star: "#ffffff",
  lamp: "#ffc457",
} as const;

export const random = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const clamp = (value: number, low = 0, high = 1): number => Math.min(high, Math.max(low, value));

/** Times land on a tenth of a second, so blocks that share a beat share their keyframes. */
export const tenth = (t: number): number => Math.round(t * 10) / 10;
