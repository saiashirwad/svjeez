import { formatValue, valueOf, type Target, type TargetValues } from "./channels";
import type { Canvas } from "./compile";
import { num } from "./format";
import { moving, type Key } from "./keys";
import { ease, type Ease, type Seconds } from "./motion";
import { formatProperty, isProperty } from "./properties";

/** How a lane's keys become declarations: its own value, a visibility toggle for a hard 0/1 opacity cut, or only the dash offset of `draw`. */
export type Emit = "value" | "visibility" | "dash";

/** A scene-time length as the seconds CSS plays it in, after the canvas's playback rate. */
export const seconds = (canvas: Canvas, scene: Seconds): string => `${num(scene / canvas.playbackRate)}s`;

const short = (value: number): string => num(value).replace(/^(-?)0\./, "$1.");

export const timing = (curve: Ease): string => {
  switch (curve.kind) {
    case "linear":
      return "linear";
    case "bezier":
      return `cubic-bezier(${curve.points.map(short).join(",")})`;
    case "steps":
      return `steps(${curve.count})`;
  }
};

export const BASE_TIMING = timing(ease.out);

const percents = (keys: readonly Key[], period: Seconds): string[] => {
  for (const places of [3, 4]) {
    const out = keys.map((key) => `${num((key.t / period) * 100, places)}%`);
    if (new Set(out).size === out.length) return out;
  }
  throw new Error(`Two keys are too close to tell apart on a ${num(period)}s timeline: ${keys.map((key) => key.t).join(", ")}.`);
};

export const cssKeyframes = (lane: string, emit: Emit, keys: readonly Key[], period: Seconds): { body: string; timing: string } => {
  const counts = new Map<string, number>();
  keys.forEach((key, index) => {
    if (moving(keys, index)) counts.set(timing(key.ease), (counts.get(timing(key.ease)) ?? 0) + 1);
  });
  const [laneTiming] = [...counts].reduce<[string, number]>((best, entry) => (entry[1] > best[1] ? entry : best), [BASE_TIMING, counts.get(BASE_TIMING) ?? 0]);
  const blocks = new Map<string, string[]>();
  const at = percents(keys, period);
  keys.forEach((key, index) => {
    const own = timing(key.ease);
    const block = cssDeclarations(lane, emit, key.values) + (moving(keys, index) && own !== laneTiming ? `;animation-timing-function:${own}` : "");
    blocks.set(block, [...(blocks.get(block) ?? []), at[index]!]);
  });
  return { body: [...blocks].map(([block, list]) => `${list.join(",")}{${block}}`).join(""), timing: laneTiming };
};

export const cssDeclarations = (lane: string, emit: Emit, values: TargetValues): string => {
  if (emit === "visibility") return `visibility:${values.opacity === 0 ? "hidden" : "visible"}`;
  if (emit === "dash") return `stroke-dashoffset:${num(1 - (values.draw ?? 0))}`;
  switch (lane) {
    case "translate":
      return `translate:${formatValue(values.x ?? 0)}px ${formatValue(values.y ?? 0)}px`;
    case "width":
    case "height":
      return `${lane}:${formatValue(valueOf(values, lane))}px`;
    case "rotate":
      return `rotate:${formatValue(values.rotate)}deg`;
    case "draw": {
      const drawn = values.draw ?? 0;
      return `stroke-dashoffset:${num(1 - drawn)};visibility:${drawn > 0 ? "visible" : "hidden"}`;
    }
    default: {
      const [target] = Object.keys(values) as Target[];
      if (!target) throw new Error(`Lane ${lane} has no value.`);
      const value = valueOf(values, target)!;
      return `${lane}:${isProperty(target) ? formatProperty(target, value) : formatValue(value)}`;
    }
  }
};

/** The body of a motion class: its keyframes by name, plus the durations, repeat counts and timings that differ from the `.a` base. */
export const classBody = (canvas: Canvas, lanes: readonly { readonly snapped: Seconds }[], names: readonly string[], timings: readonly string[]): string => {
  const off = lanes.some((lane) => lane.snapped !== canvas.duration);
  return [
    `animation-name:${names.join(",")}`,
    off && `animation-duration:${lanes.map((lane) => seconds(canvas, lane.snapped)).join(",")}`,
    !canvas.loop && off && `animation-iteration-count:${lanes.map((lane) => Math.round(canvas.duration / lane.snapped)).join(",")}`,
    timings.some((entry) => entry !== BASE_TIMING) && `animation-timing-function:${timings.join(",")}`,
  ]
    .filter(Boolean)
    .join(";");
};

export const baseRule = (canvas: Canvas): string =>
  `.${canvas.prefix}a{animation-duration:${seconds(canvas, canvas.duration)};animation-iteration-count:${canvas.loop ? "infinite" : 1};animation-fill-mode:both;animation-timing-function:${BASE_TIMING};animation-delay:var(--t0,0s)}`;

/** Opens the block that holds the still frame under reduced motion, where `restyle` finds it. */
export const REDUCED_MOTION = "@media (prefers-reduced-motion:reduce){";

/** Under reduced motion, hold every CSS animation at `stillAt` and swap SMIL filters for their still twins. */
export const freezeRule = (canvas: Canvas, hasRules: boolean, stills: readonly string[]): string =>
  canvas.stillAt === undefined || (!hasRules && stills.length === 0)
    ? ""
    : `${REDUCED_MOTION}${hasRules ? `.${canvas.prefix}a{animation-delay:-${seconds(canvas, canvas.stillAt)}!important;animation-play-state:paused!important}` : ""}${stills.join("")}}`;
