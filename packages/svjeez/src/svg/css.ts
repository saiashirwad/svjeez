import { formatValue, valueOf, type Channel, type ChannelValues } from "./channels";
import type { Canvas } from "./compile";
import { num } from "../model/format";
import { foldKeys, moving, type Key } from "./keys";
import { DEFAULT_EASE, ease, isHold, type Ease, type Seconds } from "../model/time";

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

const BASE_TIMING = timing(DEFAULT_EASE);

interface Stops {
  /** The percent of each key. */
  readonly at: readonly string[];
  /** For each key, the stop just before the next one when that segment is a hold, else undefined. */
  readonly before: readonly (string | undefined)[];
}

/** `down` rounds each stop to the tick at or before its time, so a step that lands at t is already in force at t. */
const percents = (keys: readonly Key[], period: Seconds, down = false): Stops => {
  for (const places of [3, 4]) {
    const at = keys.map((key) => (key.t / period) * 100);

    const out = at.map(
      (value) =>
        `${num(down ? Math.floor(value * 10 ** places + 1e-6) / 10 ** places : value, places)}%`,
    );

    if (new Set(out).size !== out.length) continue;
    const taken = new Set(out);
    const step = 10 ** -places;

    // A hold is written as the key's own stop up to one step before the next, so no steps(1) has to be said.
    const before = keys.map((_, index) => {
      if (!moving(keys, index) || !isHold(keys[index]!.ease)) return undefined;
      const stop = `${num(Number(num(at[index + 1]!, places)) - step, places)}%`;

      if (taken.has(stop) || Number.parseFloat(stop) <= Number.parseFloat(out[index]!))
        return undefined;
      taken.add(stop);

      return stop;
    });

    return { at: out, before };
  }

  throw new Error(
    `Two keys are too close to tell apart on a ${num(period)}s timeline: ${keys.map((key) => key.t).join(", ")}.`,
  );
};

interface Frames {
  /** Each stop group: its selectors, the timing it says for itself, and what it sets. */
  readonly blocks: readonly {
    readonly selectors: string;
    readonly suffix: string;
    readonly set: string;
  }[];
  readonly timing: string;
}

const frames = (
  lane: string,
  emit: Emit,
  all: readonly Key[],
  period: Seconds,
  holds: boolean,
): Frames => {
  const keys = emit === "value" ? foldKeys(lane, all) : all;
  const counts = new Map<string, number>();
  keys.forEach((key, index) => {
    if (moving(keys, index) && !(holds && isHold(key.ease)))
      counts.set(timing(key.ease), (counts.get(timing(key.ease)) ?? 0) + 1);
  });

  const [laneTiming] = [...counts].reduce<[string, number]>(
    (best, entry) => (entry[1] > best[1] ? entry : best),
    [BASE_TIMING, counts.get(BASE_TIMING) ?? 0],
  );

  const blocks = new Map<string, { selectors: string[]; suffix: string; set: string }>();
  const stops = percents(keys, period, emit === "visibility");
  const { at } = stops;
  const before = holds ? stops.before : stops.before.map(() => undefined);
  keys.forEach((key, index) => {
    const own = timing(key.ease);
    const held = before[index] !== undefined;

    const suffix =
      moving(keys, index) && !held && own !== laneTiming ? `animation-timing-function:${own}` : "";

    const set = cssDeclarations(lane, emit, key.values);
    const id = `${set};${suffix}`;
    const block = blocks.get(id) ?? { selectors: [], suffix, set };

    block.selectors.push(at[index]!, ...(held ? [before[index]!] : []));
    blocks.set(id, block);
  });

  return {
    blocks: [...blocks.values()].map(({ selectors, suffix, set }) => ({
      selectors: selectors.join(","),
      suffix,
      set,
    })),
    timing: laneTiming,
  };
};

/** The stops of one lane. A hold is written as a stop just before the next key, unless saying steps(1) once is shorter. */
export const cssFrames = (
  lane: string,
  emit: Emit,
  all: readonly Key[],
  period: Seconds,
): Frames => {
  const classic = frames(lane, emit, all, period, false);

  const said =
    classic.timing === timing(ease.hold)
      ? `animation-timing-function:${classic.timing};`.length
      : 0;

  // visibility interpolates to "visible" anywhere between a visible and a hidden stop, so a stop just before the next key
  // would show both values at the key's own instant: those lanes must step exactly.
  if (emit === "visibility") return classic;
  const exact = frames(lane, emit, all, period, true);

  return bodyOf(exact).length <= bodyOf(classic).length + said ? exact : classic;
};

const bodyOf = (frames: Frames): string =>
  frames.blocks
    .map(({ selectors, suffix, set }) => `${selectors}{${set}${suffix && `;${suffix}`}}`)
    .join("");

/** The keyframes one lane needs, written alone. */
export const cssKeyframes = (lane: string, emit: Emit, all: readonly Key[], period: Seconds) => {
  const frames = cssFrames(lane, emit, all, period);

  return { body: bodyOf(frames), timing: frames.timing };
};

/** What two lanes must share to run in one @keyframes: when each stop falls, how it eases, and the clock it runs on. */
const skeleton = (frames: Frames, lane: { readonly period: Seconds; readonly snapped: Seconds }) =>
  [
    frames.timing,
    lane.period,
    lane.snapped,
    ...frames.blocks.map(({ selectors, suffix }) => `${selectors}|${suffix}`),
  ].join("/");

export interface Group {
  readonly body: string;
  readonly timing: string;
  readonly snapped: Seconds;
}

/** An element's lanes with the same stops and clock become one @keyframes. */
export const cssGroups = (
  lanes: readonly {
    readonly key: string;
    readonly emit: Emit;
    readonly keys: readonly Key[];
    readonly period: Seconds;
    readonly snapped: Seconds;
  }[],
): Group[] => {
  const groups = new Map<string, { frames: Frames[]; snapped: Seconds }>();

  for (const lane of lanes) {
    const frames = cssFrames(lane.key, lane.emit, lane.keys, lane.period);
    const id = skeleton(frames, lane);
    const group = groups.get(id) ?? { frames: [], snapped: lane.snapped };

    group.frames.push(frames);
    groups.set(id, group);
  }

  return [...groups.values()].map(({ frames, snapped }) => ({
    body: bodyOf({
      timing: frames[0]!.timing,
      blocks: frames[0]!.blocks.map((block, index) => ({
        ...block,
        set: frames.map((each) => each.blocks[index]!.set).join(";"),
      })),
    }),
    timing: frames[0]!.timing,
    snapped,
  }));
};

/** A length in px, with no unit on zero. */
export const length = (value: number): string => {
  const text = formatValue(value);

  return text === "0" ? text : `${text}px`;
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
      return `translate:${length(values.x ?? 0)} ${length(values.y ?? 0)}`;
    case "rotate":
      return `rotate:${formatValue(values.rotate)}deg`;
    case "skew":
      return `transform:skewX(${formatValue(values.skew)}deg)`;
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
