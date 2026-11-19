import { formatValue, valueOf, type Channel, type ChannelValues } from "./channels";
import type { Canvas } from "./compile";
import { num } from "../model/format";
import { foldKeys, moving, type Key } from "./keys";
import { DEFAULT_EASE, type Ease, type Seconds } from "../model/time";

export type Emit = "value" | "visibility" | "dash";

export const seconds = (canvas: Canvas, scene: Seconds): string =>
  `${num(scene / canvas.playbackRate)}s`;

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

export const BASE_TIMING = timing(DEFAULT_EASE);

const percents = (keys: readonly Key[], period: Seconds): string[] => {
  for (const places of [3, 4]) {
    const out = keys.map((key) => `${num((key.t / period) * 100, places)}%`);

    if (new Set(out).size === out.length) return out;
  }

  throw new Error(
    `Two keys are too close to tell apart on a ${num(period)}s timeline: ${keys.map((key) => key.t).join(", ")}.`,
  );
};

export const cssKeyframes = (lane: string, emit: Emit, all: readonly Key[], period: Seconds) => {
  const keys = emit === "value" ? foldKeys(lane, all) : all;
  const counts = new Map<string, number>();
  keys.forEach((key, index) => {
    if (moving(keys, index)) counts.set(timing(key.ease), (counts.get(timing(key.ease)) ?? 0) + 1);
  });

  const [laneTiming] = [...counts].reduce<[string, number]>(
    (best, entry) => (entry[1] > best[1] ? entry : best),
    [BASE_TIMING, counts.get(BASE_TIMING) ?? 0],
  );

  const blocks = new Map<string, string[]>();
  const at = percents(keys, period);
  keys.forEach((key, index) => {
    const own = timing(key.ease);

    const block =
      cssDeclarations(lane, emit, key.values) +
      (moving(keys, index) && own !== laneTiming ? `;animation-timing-function:${own}` : "");

    blocks.set(block, [...(blocks.get(block) ?? []), at[index]!]);
  });

  return {
    body: [...blocks].map(([block, list]) => `${list.join(",")}{${block}}`).join(""),
    timing: laneTiming,
  };
};

export const cssDeclarations = (lane: string, emit: Emit, values: ChannelValues): string => {
  if (emit === "visibility") return `visibility:${values.opacity === 0 ? "hidden" : "visible"}`;

  if (values.drawStart !== undefined) {
    const from = values.drawStart;
    const length = Math.max(0, (values.draw ?? 0) - from);
    const dash = `stroke-dasharray:${num(length)} 2;stroke-dashoffset:${num(-from)}`;

    return emit === "dash" ? dash : `${dash};visibility:${length > 0 ? "visible" : "hidden"}`;
  }

  if (emit === "dash") return `stroke-dashoffset:${num(1 - (values.draw ?? 0))}`;

  switch (lane) {
    case "translate":
      return `translate:${formatValue(values.x ?? 0)}px ${formatValue(values.y ?? 0)}px`;
    case "rotate":
      return `rotate:${formatValue(values.rotate)}deg`;
    case "offset-distance":
      return `offset-distance:${formatValue(values.offsetDistance)}%`;
    case "scale":
      if (values.scaleY === undefined) return `scale:${formatValue(values.scale)}`;

      return `scale:${formatValue(values.scale ?? 1)} ${formatValue(values.scaleY)}`;
    case "draw": {
      const drawn = values.draw ?? 0;

      return `stroke-dashoffset:${num(1 - drawn)};visibility:${drawn > 0 ? "visible" : "hidden"}`;
    }

    default: {
      // SAFETY: values is a ChannelValues, keyed by Channel names, so its first key is a Channel.
      const [target] = Object.keys(values) as Channel[];

      if (!target) throw new Error(`Lane ${lane} has no value.`);
      const value = valueOf(values, target)!;

      return `${lane}:${formatValue(value)}`;
    }
  }
};

export const classBody = (
  canvas: Canvas,
  lanes: readonly { readonly snapped: Seconds }[],
  names: readonly string[],
  timings: readonly string[],
): string => {
  const off = lanes.some((lane) => lane.snapped !== canvas.duration);

  return [
    `animation-name:${names.join(",")}`,
    off && `animation-duration:${lanes.map((lane) => seconds(canvas, lane.snapped)).join(",")}`,
    !canvas.loop &&
      off &&
      `animation-iteration-count:${lanes.map((lane) => Math.round(canvas.duration / lane.snapped)).join(",")}`,
    timings.some((entry) => entry !== BASE_TIMING) &&
      `animation-timing-function:${timings.join(",")}`,
  ]
    .filter(Boolean)
    .join(";");
};

export const baseRule = (canvas: Canvas): string =>
  `.${canvas.prefix}a{animation-duration:${seconds(canvas, canvas.duration)};animation-iteration-count:${canvas.loop ? "infinite" : 1};animation-fill-mode:both;animation-timing-function:${BASE_TIMING};animation-delay:var(--t0,0s)}`;

export const REDUCED_MOTION = "@media (prefers-reduced-motion:reduce){";

export const freezeRule = (canvas: Canvas, hasRules: boolean, stills: readonly string[]): string =>
  canvas.stillAt === undefined || (!hasRules && stills.length === 0)
    ? ""
    : `${REDUCED_MOTION}${hasRules ? `.${canvas.prefix}a{animation-delay:-${seconds(canvas, canvas.stillAt)}!important;animation-play-state:paused!important}` : ""}${stills.join("")}}`;
