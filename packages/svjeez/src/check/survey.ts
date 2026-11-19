import { isHold, type Seconds } from "../model/time";
import { placements, type Matrix, type Placed } from "./boxes";
import type {
  Animated,
  Authored,
  Box,
  Color,
  Geometry,
  Key,
  Lane,
  Paint,
  Rgba,
  Scene,
  SceneNode,
  ShapeNode,
  Source,
  TextNode,
  Vec,
} from "../model/ir";
import { isLane, mapLane } from "../model/lane";
import { isColor } from "../model/painted";
import { breaksOf, segmentAt, unrolled } from "../model/sample";
import { same } from "../model/steps";
import { nodeName } from "../model/naming";
import { walkScene } from "../model/walk";

export interface Entry {
  readonly node: SceneNode;
  readonly ancestors: readonly SceneNode[];
  readonly order: number;
  readonly depth: number;
}

export const entriesOf = (scene: Scene): Entry[] => {
  const out: Entry[] = [];

  const visit = (node: SceneNode, ancestors: readonly SceneNode[]): void => {
    out.push({ node, ancestors, order: out.length, depth: ancestors.length });

    if (node.kind === "group")
      for (const child of node.children) visit(child, [...ancestors, node]);
  };

  visit(scene.root, []);

  return out;
};

export const countOf = (node: SceneNode): NonNullable<Authored["count"]> | undefined =>
  node.kind === "group" ? node.authored?.count : undefined;

export const inCount = (entry: Entry): boolean =>
  entry.ancestors.some((node) => countOf(node) !== undefined);

export const countAt = (count: NonNullable<Authored["count"]>, t: Seconds): string =>
  (count.ticks.findLast((tick) => tick.t <= t + 1e-9) ?? count.ticks[0]!).text;

export const sourcesOf = (scene: Scene): Map<string, Source> => {
  const out = new Map<string, Source>();

  walkScene(scene, (node) => {
    if (node.source) out.set(node.key, node.source);
  });

  return out;
};

export const namesOf = (scene: Scene): Map<string, string> => {
  const out = new Map<string, string>();

  walkScene(scene, (node) => {
    out.set(node.key, nodeName(node));
  });

  return out;
};

export type Named =
  | { readonly name: string; readonly kind: "number"; readonly value: Animated<number> }
  | { readonly name: string; readonly kind: "vec"; readonly value: Animated<Vec> }
  | { readonly name: string; readonly kind: "geometry"; readonly value: Animated<Geometry> }
  | { readonly name: string; readonly kind: "paint"; readonly value: Animated<Paint> };

export const valuesOf = (node: SceneNode): Named[] => {
  const out: Named[] = [{ name: "at", kind: "vec", value: node.at }];

  for (const layer of node.layers)
    out.push(
      { name: "offset", kind: "vec", value: layer.offset },
      { name: "rotate", kind: "number", value: layer.rotate },
      { name: "scale", kind: "vec", value: layer.scale },
      { name: "opacity", kind: "number", value: layer.opacity },
    );

  if (node.clip) out.push({ name: "clip", kind: "geometry", value: node.clip });

  for (const effect of node.effects)
    if (effect.kind === "blur") out.push({ name: "blur", kind: "number", value: effect.radius });
    else if (effect.kind === "adjust")
      out.push(
        { name: "adjust saturate", kind: "number", value: effect.saturate },
        { name: "adjust hue", kind: "number", value: effect.hue },
        { name: "adjust brightness", kind: "number", value: effect.brightness },
        { name: "adjust contrast", kind: "number", value: effect.contrast },
      );
    else if (effect.kind === "displace")
      out.push(
        { name: "displace scale", kind: "number", value: effect.scale },
        { name: "displace frequency", kind: "number", value: effect.frequency },
      );
    else
      out.push(
        { name: "shadow offset", kind: "vec", value: effect.offset },
        { name: "shadow blur", kind: "number", value: effect.blur },
        { name: "shadow opacity", kind: "number", value: effect.opacity },
      );

  if (node.kind === "shape") {
    out.push({ name: "geometry", kind: "geometry", value: node.geometry });

    if (node.fill !== undefined) out.push({ name: "fill", kind: "paint", value: node.fill });

    if (node.stroke)
      out.push(
        { name: "stroke color", kind: "paint", value: node.stroke.color },
        { name: "stroke width", kind: "number", value: node.stroke.width },
      );

    if (node.trim !== undefined) out.push({ name: "trim", kind: "vec", value: node.trim });
  }

  if (node.kind === "text")
    for (const run of runsOf(node)) {
      out.push({ name: "text fill", kind: "paint", value: run.fill });

      if (run.opacity !== undefined)
        out.push({ name: "text opacity", kind: "number", value: run.opacity });
    }

  return out;
};

export const runsOf = (node: TextNode): TextNode["lines"][number]["runs"][number][] =>
  node.lines.flatMap((line) => line.runs);

export const textOf = (node: TextNode): string =>
  node.lines
    .map((line) => line.runs.map((run) => run.text).join(""))
    .join(" ")
    .trim();

const keysOver = <T>(lane: Lane<T>, duration: Seconds): readonly Key<T>[] =>
  lane.period === undefined ? lane.keys : unrolled(lane, duration);

export type Stretch = readonly [from: Seconds, to: Seconds];

export const changesOf = (value: Animated<unknown>, duration: Seconds): Stretch[] => {
  if (!isLane(value)) return [];
  const keys = keysOver(value, duration);
  const out: Stretch[] = [];

  for (let i = 1; i < keys.length; i++) {
    const [a, b] = [keys[i - 1]!, keys[i]!];

    if (!b.via && same(a.value, b.value)) continue;
    out.push(isCut(b) ? [b.t, b.t] : [a.t, b.t]);
  }

  return out;
};

export const isCut = (key: Key<unknown>): boolean => isHold(key.ease);

export const merged = (stretches: readonly Stretch[]): Stretch[] => {
  const sorted = [...stretches].sort((a, b) => a[0] - b[0]);
  const out: [Seconds, Seconds][] = [];

  for (const [from, to] of sorted) {
    const last = out.at(-1);

    if (last && from <= last[1] + 1e-6) last[1] = Math.max(last[1], to);
    else out.push([from, to]);
  }

  return out;
};

export const covers = (stretches: readonly Stretch[], from: Seconds, to: Seconds): boolean =>
  merged(stretches).some(([a, b]) => a <= from + 1e-6 && b >= to - 1e-6);

export const inside = (stretches: readonly Stretch[], t: Seconds): boolean =>
  stretches.some(([a, b]) => t >= a - 1e-6 && t <= b + 1e-6);

export const zerosOf = (value: Animated<number>, duration: Seconds): Stretch[] => {
  if (!isLane(value)) return value === 0 ? [[0, duration]] : [];
  const keys = keysOver(value, duration);
  const out: Stretch[] = [];
  const [first, last] = [keys[0]!, keys.at(-1)!];

  if (first.value === 0) out.push([Math.min(0, first.t), first.t]);

  for (let i = 1; i < keys.length; i++) {
    const [a, b] = [keys[i - 1]!, keys[i]!];

    if (a.value === 0 && (b.value === 0 || isCut(b))) out.push([a.t, b.t]);
  }

  if (last.value === 0) out.push([last.t, Math.max(duration, last.t)]);

  return merged(out);
};

const axis = (value: Animated<Vec>, index: 0 | 1): Animated<number> =>
  isLane(value) ? mapLane(value, (v) => v[index]) : value[index];

export const ownHidden = (node: SceneNode, duration: Seconds): Stretch[] =>
  merged(
    node.layers.flatMap((layer) => [
      ...zerosOf(layer.opacity, duration),
      ...zerosOf(axis(layer.scale, 0), duration),
      ...zerosOf(axis(layer.scale, 1), duration),
    ]),
  );

export const hiddenOf = (entry: Entry, duration: Seconds): Stretch[] =>
  merged([...entry.ancestors, entry.node].flatMap((node) => ownHidden(node, duration)));

export const shownOf = (hidden: readonly Stretch[], duration: Seconds): Stretch[] => {
  const out: Stretch[] = [];
  let from = 0;

  for (const [a, b] of merged(hidden)) {
    if (a > from + 1e-6) out.push([from, Math.min(a, duration)]);
    from = Math.max(from, b);
  }

  if (from < duration - 1e-6 || (duration <= 0 && !covers(hidden, 0, 0)))
    out.push([from, duration]);

  return out;
};

const lanesOf = (scene: Scene): Lane<unknown>[] => {
  const out: Lane<unknown>[] = [];

  walkScene(scene, (node) => {
    for (const { value } of valuesOf(node)) if (isLane(value)) out.push(value);
  });

  return out;
};

const MOMENTS = 160;

export const momentsOf = (scene: Scene, extra: readonly Seconds[] = []): Seconds[] => {
  const { duration } = scene;

  if (duration <= 0) return [0];
  const breaks = breaksOf(lanesOf(scene), duration);
  const halves = breaks.slice(1).map((t, i) => (t + breaks[i]!) / 2);

  const all = [...breaks, ...halves]
    .sort((a, b) => a - b)
    .filter((t, i, list) => i === 0 || t - list[i - 1]! > 1e-6);

  const thinned =
    all.length <= MOMENTS
      ? all
      : Array.from(
          { length: MOMENTS },
          (_, i) => all[Math.round((i * (all.length - 1)) / (MOMENTS - 1))]!,
        );

  return [...new Set([...thinned, ...extra.filter((t) => t >= 0 && t <= duration)])].sort(
    (a, b) => a - b,
  );
};

export interface SampledFrame {
  readonly t: Seconds;
  readonly frame: ReadonlyMap<string, Placed>;
}

export const frameAt = (scene: Scene, t: Seconds): SampledFrame["frame"] =>
  new Map(placements(scene, t).map((placed) => [placed.key, placed]));

export const framesOf = (scene: Scene, times: readonly Seconds[]): SampledFrame[] =>
  times.map((t) => ({ t, frame: frameAt(scene, t) }));

export const scaleOf = (m: Matrix): number => Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]));

export const isUpright = (m: Matrix): boolean => Math.abs(m[1]) < 1e-9 && Math.abs(m[2]) < 1e-9;

export interface Between<T> {
  readonly from: T;
  readonly to: T;
  readonly amount: number;
}

export const between = <T>(value: Animated<T>, t: Seconds): Between<T> => {
  if (!isLane(value)) return { from: value, to: value, amount: 0 };
  const { from, to, amount } = segmentAt(value, t);

  return { from: from.value, to: to.value, amount };
};

export const movingAt = (value: Animated<unknown>, t: Seconds): boolean => {
  if (!isLane(value)) return false;
  const { from, to, amount } = between(value, t);

  return amount > 1e-6 && amount < 1 - 1e-6 && !same(from, to);
};

export type Scheme = "light" | "dark";

export const SCHEMES: readonly Scheme[] = ["light", "dark"];

const isRgba = (color: Color): color is Rgba => Array.isArray(color);

export const rgbaIn = (scene: Scene, color: Color, scheme: Scheme): Rgba =>
  isRgba(color) ? color : (scene.tokens[color.name]?.[scheme] ?? [0, 0, 0, 0]);

export const colorAt = (
  scene: Scene,
  paint: Animated<Paint>,
  t: Seconds,
  scheme: Scheme,
): Rgba | undefined => {
  const { from, to, amount } = between(paint, t);

  if (!isColor(from) || !isColor(to)) return undefined;
  const [a, b] = [rgbaIn(scene, from, scheme), rgbaIn(scene, to, scheme)];

  const mix = (i: 0 | 1 | 2 | 3): number => a[i] + (b[i] - a[i]) * amount;

  return [mix(0), mix(1), mix(2), mix(3)];
};

const isClear = (scene: Scene, paint: Paint): boolean =>
  isColor(paint)
    ? SCHEMES.every((scheme) => rgbaIn(scene, paint, scheme)[3] <= 0)
    : "stops" in paint &&
      paint.stops.every((stop) =>
        SCHEMES.every((scheme) => rgbaIn(scene, stop.color, scheme)[3] <= 0),
      );

export const clearThroughout = (scene: Scene, paint: Animated<Paint> | undefined): boolean =>
  paint === undefined ||
  (isLane(paint) ? paint.keys.every((key) => isClear(scene, key.value)) : isClear(scene, paint));

const hex = (n: number): string =>
  Math.round(Math.min(1, Math.max(0, n)) * 255)
    .toString(16)
    .padStart(2, "0")
    .toUpperCase();

const colorName = (color: Color): string =>
  isRgba(color)
    ? `#${hex(color[0])}${hex(color[1])}${hex(color[2])}${color[3] < 1 ? hex(color[3]) : ""}`
    : color.name;

export const paintName = (paint: Paint): string =>
  isColor(paint)
    ? colorName(paint)
    : paint.kind === "pattern"
      ? "pattern"
      : `${paint.kind} gradient`;

export const strokeReachAt = (node: ShapeNode, placed: Placed, t: Seconds): number => {
  if (!node.stroke) return 0;
  const { from, to, amount } = between(node.stroke.width, t);
  const width = Math.max(0, from + (to - from) * amount);

  return (width / 2) * (node.stroke.fixedWidth ? 1 : scaleOf(placed.matrix));
};

export const area = (box: Box): number => Math.max(0, box.width) * Math.max(0, box.height);

export const sharedArea = (a: Box, b: Box): number =>
  Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
  Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));

export const seconds = (t: Seconds): string => `${Number(t.toFixed(3))}s`;

export const units = (n: number): string => {
  const rounded = Math.abs(n) >= 10 ? Math.round(n) : Number(n.toFixed(1));

  return String(Object.is(rounded, -0) ? 0 : rounded);
};
