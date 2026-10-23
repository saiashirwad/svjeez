import type { Color } from "svg-motion";
import { project, type Camera, type Projected, type Vec3 } from "./space";

export const W = 960;
export const H = 640;
export const D = 28;

export const CAM: Camera = { yaw: 34, pitch: 27, unit: 43 };

export const ORIGIN = { x: 486, y: 462 } as const;

export const at = (p: Vec3): Projected => {
  const q = project(CAM, p);
  return { x: q.x + ORIGIN.x, y: q.y + ORIGIN.y, depth: q.depth };
};

export const T = {
  seed: 0.7,
  grow: 1.2,
  rooted: 4.0,
  crown: 3.4,
  crowned: 7.4,
  under: 3.2,
  meadow: 8.6,
  bloom: 6.6,
  flowered: 9.8,
  golden: 15,
  dusk: 20.4,
  night: 23.4,
  fall: 23.8,
  gone: 26.2,
} as const;

export const C = {
  nightTop: "#06131c",
  nightMid: "#0c2430",
  nightBot: "#1a3944",
  dawnTop: "#173c4f",
  dawnMid: "#6f8e8c",
  dawnBot: "#f0bd84",
  dayTop: "#3c8793",
  dayMid: "#93c2b6",
  dayBot: "#e7e4c6",
  duskTop: "#2b3459",
  duskMid: "#8c6a80",
  duskBot: "#f0a070",
  sun: "#ffedbe",
  sunCore: "#fffbea",
  haze: "#7fa596",
  firefly: "#ffe9a6",
  pollen: "#ffdfae",
  shadow: "#081a20",
  ink: "#07181c",
  moon: "#e9f1df",
  star: "#e6f2df",
} as const;

export const MOSS = ["#143028", "#1c4230", "#275738", "#346d41", "#45834b", "#5b9c56", "#7ab66a"] as const;
export const ROCK = ["#111f22", "#182a2d", "#213738", "#2c4544", "#395450", "#4a6660", "#5d7971"] as const;
export const OAK = ["#0d241f", "#123128", "#193f2d", "#225236", "#2e6840", "#41814a", "#5d9c58", "#87bb70"] as const;
export const BIRCH = ["#1b352b", "#264834", "#35603f", "#497d4e", "#65a060", "#8cbd7b"] as const;
export const BLOSSOM = ["#3a1d24", "#552a32", "#743a3f", "#955154", "#b96d6a", "#d99289", "#f0b9aa", "#f8d8c6"] as const;
export const FERN = ["#103027", "#184232", "#23583c", "#316d46", "#448552", "#60a161"] as const;
export const GRASS = ["#183a2c", "#225038", "#306541", "#407d49", "#559756", "#73af68"] as const;
export const BARK = {
  oak: ["#1f1511", "#32231a", "#493224", "#614631", "#7c5b3d", "#98734d"] as const,
  birch: ["#3e403c", "#5f6259", "#858778", "#adae98", "#d0cdb2"] as const,
  blossom: ["#291c20", "#3f292c", "#573736", "#704840", "#8d5d4f"] as const,
};
export const STONE = ["#283534", "#394946", "#4d5f5a", "#64756b", "#7f9081"] as const;
export const CREAM = ["#fff6da", "#ffe9b6", "#f8d493"] as const;
export const BLUSH = ["#fbe2da", "#f3bbb4", "#e09096"] as const;
export const PERIWINKLE = ["#e3edfb", "#c1d4ef", "#97b4dc"] as const;
export const GOLD = ["#f7d488", "#f0b45e", "#dc9446"] as const;

export const random = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const clamp = (value: number, low = 0, high = 1): number => Math.min(high, Math.max(low, value));

export const rgb = (color: string): readonly [number, number, number] => {
  const hex = (i: number): number => parseInt(color.slice(i, i + 2), 16);
  return [hex(1), hex(3), hex(5)];
};

export const mix = (a: string, b: string, t: number): Color => {
  const [ar, ag, ab] = rgb(a);
  const [br, bg, bb] = rgb(b);
  const hex = (value: number) => Math.round(clamp(value, 0, 255)).toString(16).padStart(2, "0");
  return `#${hex(ar + (br - ar) * t)}${hex(ag + (bg - ag) * t)}${hex(ab + (bb - ab) * t)}`;
};

export const alpha = (color: string, a: number): Color => {
  const [r, g, b] = rgb(color);
  return `rgba(${r},${g},${b},${a})` as Color;
};

export const tone = (ramp: readonly string[], t: number): Color => ramp[Math.round(clamp(t) * (ramp.length - 1))] as Color;

export const fog = (depth: number): number => clamp(0.01 + (depth + 12) * 0.007, 0, 0.11);
export const hazed = (color: string, depth: number): Color => mix(color, C.haze, fog(depth));
