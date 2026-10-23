import type { Color } from "svg-motion";
import { project, type Camera, type Projected, type Vec3 } from "./space";

export const W = 960;
export const H = 640;
export const D = 28;

export const CAM: Camera = { yaw: 34, pitch: 27, unit: 42 };

/** Where the island's middle lands on the canvas. */
export const ORIGIN = { x: 486, y: 450 } as const;

/** World → canvas pixels. */
export const at = (p: Vec3): Projected => {
  const q = project(CAM, p);
  return { x: q.x + ORIGIN.x, y: q.y + ORIGIN.y, depth: q.depth };
};

/** The story, in seconds. */
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
  haze: "#a9c8b9",
  firefly: "#ffe9a6",
  pollen: "#ffdfae",
  shadow: "#0a1c22",
  ink: "#07181c",
  moon: "#e9f1df",
  star: "#e6f2df",
} as const;

export const MOSS = ["#1e3d31", "#2b5540", "#3a6f47", "#4f8a50", "#69a65b", "#8cc274", "#b0d68f"] as const;
export const ROCK = ["#1a292b", "#263a3a", "#354c49", "#49605a", "#61786f", "#7f9588", "#9eb2a2"] as const;
export const OAK = ["#16382d", "#204a36", "#2d633f", "#417f49", "#5c9d56", "#82ba68", "#b1d687"] as const;
export const BIRCH = ["#274436", "#345a42", "#486f4d", "#618c5c", "#84ab74", "#aac991"] as const;
export const BLOSSOM = ["#47272f", "#653a42", "#874e52", "#aa6667", "#cc8883", "#e8afa5", "#f7d4c6"] as const;
export const FERN = ["#163c30", "#22533d", "#326b47", "#478752", "#64a160", "#8bbb78"] as const;
export const GRASS = ["#1f4333", "#2d5b3f", "#407849", "#579656", "#76ae68", "#9ac985"] as const;
export const BARK = {
  oak: ["#2a1d17", "#3f2b1f", "#593e2a", "#755234", "#956d43", "#b38856"] as const,
  birch: ["#484b45", "#6b6e64", "#929482", "#bcbba3", "#ded9bd"] as const,
  blossom: ["#322428", "#4a3235", "#644642", "#826158", "#a07b6b"] as const,
};
export const STONE = ["#31413f", "#455754", "#5b6e68", "#74857b", "#91a192"] as const;
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

export const rgb = (color: string): readonly [number, number, number] => [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16)) as unknown as readonly [number, number, number];

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

/** A color from a ramp at 0..1. */
export const tone = (ramp: readonly string[], t: number): Color => ramp[Math.round(clamp(t) * (ramp.length - 1))] as Color;

/** How much a surface at this world depth fades into the haze. */
export const fog = (depth: number): number => clamp(0.02 + (depth + 12) * 0.012, 0, 0.2);
export const hazed = (color: string, depth: number): Color => mix(color, C.haze, fog(depth));
