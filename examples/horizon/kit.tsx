import { def, ease, el, motion, type Channel, type Color, type Motion, type Ref, type Values } from "svg-motion";

export const W = 960;
export const H = 540;
export const D = 12;

/** The acts, in order. Everything else is timed against these. */
export const T = {
  accrete: 0.5,
  open: 1.8,
  lens: 2.2,
  hud: 3.0,
  ignite: 4.2,
  title: 5.0,
  collapse: 8.8,
  fall: 9.3,
  black: 10.4,
  dawn: 10.8,
} as const;

/** The disk plane: tipped toward us and rolled slightly, in the world's coordinates. */
export const TILT = "rotate(-12) scale(1 0.22)";

/** Pivot on the local origin instead of the element's own box. */
export const pivot = { transformBox: "view-box", transformOrigin: "0 0" } as const;

export const C = {
  void: "#020208",
  ink: "#05050F",
  hud: "#8FA3C7",
  hudDim: "#4C5A78",
  star: "#E8EEFF",
  white: "#FFF6E6",
  jet: "#9DB8FF",
  violet: "#6A5CFF",
} as const;

export const random = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const rgb = (color: string) => [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));

const mix = (a: string, b: string, t: number): Color =>
  `#${rgb(a)
    .map((channel, i) => Math.round(channel + (rgb(b)[i]! - channel) * t).toString(16).padStart(2, "0"))
    .join("")}`;

const HEAT: readonly (readonly [number, string])[] = [
  [0, "#FFFBEA"],
  [0.15, "#FFE3A3"],
  [0.35, "#FFB25C"],
  [0.6, "#FF6A3D"],
  [0.8, "#C72E4F"],
  [1, "#4B1638"],
];

/** Blackbody-ish ramp from the hot inner edge (0) to the cold rim (1). */
export const heat = (t: number): Color => {
  const upper = HEAT.findIndex(([at]) => at >= t);
  if (upper <= 0) return HEAT[0]![1] as Color;
  const [a, from] = HEAT[upper - 1]!;
  const [b, to] = HEAT[upper]!;
  return mix(from, to, (t - a) / (b - a));
};

/**
 * Bloom for world-space layers, whose origin is the canvas center. The region is `reach` around that
 * origin: blur cost scales with its area, so keep it to what the layer can actually cover.
 */
export const glow = (blur: number, strength: number, reach: { readonly x: number; readonly y: number }): Ref<"filter"> =>
  def.filter({ filterUnits: "userSpaceOnUse", x: -reach.x, y: -reach.y, width: 2 * reach.x, height: 2 * reach.y }, (
    <>
      <feGaussianBlur stdDeviation={blur} result="blur" />
      <feMerge>
        {Array.from({ length: strength }, () => el.feMergeNode({ in: "blur" }))}
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </>
  ));

/** Hold until `at`, cut on. */
export const on = (at: number): Motion<"opacity"> => motion({ opacity: 0 }).at(at).set({ opacity: 1 });

/** Fade in over `over`, hold, fade out at `off`. */
export const envelope = (at: number, off: number, over = 0.4): Motion<"opacity"> =>
  motion({ opacity: 0 }).at(at).to({ opacity: 1 }, over).at(off).to({ opacity: 0 }, over, ease.in);

/**
 * A loop that starts `offset` seconds into its own cycle, so copies of one motion run out of step.
 * `at(u)` gives the values at progress u ∈ [0, 1]; it is sampled into `pieces` linear segments with a
 * cut where the cycle wraps.
 */
export const phased = <K extends Channel>(period: number, offset: number, at: (u: number) => Values<K>, pieces = 8): Motion<K> => {
  const shift = ((offset % period) + period) % period;
  const progress = (t: number) => ((t + shift) % period) / period;
  const wrap = period - shift;
  const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;
  const grid = Array.from({ length: pieces + 1 }, (_, j) => (j * period) / pieces).filter((t) => !near(t, wrap));
  const times = [...grid, wrap].sort((a, b) => a - b);
  let track: Motion = motion(at(progress(0)) as Values);
  for (let j = 1; j < times.length; j++) {
    const [from, to] = [times[j - 1]!, times[j]!];
    const cut = to === wrap;
    track = track.at(from).to(at(cut ? 1 : progress(to)) as Values, to - from, ease.linear);
    if (cut && wrap < period) track = track.set(at(0) as Values);
  }
  return track.loop(period) as Motion<K>;
};
