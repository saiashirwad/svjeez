import type { Color, Tag } from "./attributes";
import { num } from "./format";
import { declarationOf, isProperty, type Property, type PropertyValues } from "./properties";
import type { PathData } from "./paths";

const GEOMETRY = ["path", "line", "polyline", "polygon", "circle", "ellipse", "rect"] as const;
const GRAPHICS = ["g", "use", "text", "image", ...GEOMETRY] as const;
const PAINTED = ["g", "use", "text", "tspan", ...GEOMETRY] as const;

const number: number = 0;

// SAFETY: a placeholder that only fixes the value type; compile.ts reads just the typeof of a row value.
const color = "" as Color;

// SAFETY: the same kind of placeholder, fixing the value type to path data.
const pathData = "" as PathData;

type Composition = "nest" | "replace";

interface Spec {
  readonly value: number | Color | PathData;
  readonly tags: readonly Tag[];
  readonly lane: string;
  readonly composition: Composition;
  readonly identity?: number | Color | PathData;
  readonly range?: readonly [number, number];
  readonly attr?: string;
  readonly pins?: Readonly<Record<string, string>>;
  readonly pivot?: true;
  readonly collidesWith?: readonly string[];
  /** Tags where this lane always lands on a wrapper (WebKit ignores fill-box on bare <text>). */
  readonly wrapsOn?: readonly Tag[];
  /** How the lane is animated when CSS would not do: `blur` through a filter, `d`, `width` and `height` through SMIL, since CSS `d` is not animated in Safari and CSS geometry is not applied in Firefox. */
  readonly backend?: "blur" | "smil";
  readonly toggles?: readonly string[];
}

export const CHANNELS = {
  width: {
    value: number,
    tags: ["rect", "image"],
    lane: "width",
    composition: "replace",
    attr: "width",
    range: [0, Infinity],
    backend: "smil",
  },
  height: {
    value: number,
    tags: ["rect", "image"],
    lane: "height",
    composition: "replace",
    attr: "height",
    range: [0, Infinity],
    backend: "smil",
  },
  opacity: {
    value: number,
    tags: GRAPHICS,
    lane: "opacity",
    composition: "nest",
    identity: 1,
    range: [0, 1],
    collidesWith: ["opacity"],
    toggles: ["opacity", "visibility", "style"],
  },
  x: { value: number, tags: GRAPHICS, lane: "translate", composition: "nest", identity: 0 },
  y: { value: number, tags: GRAPHICS, lane: "translate", composition: "nest", identity: 0 },
  scale: {
    value: number,
    tags: GRAPHICS,
    lane: "scale",
    composition: "nest",
    identity: 1,
    pivot: true,
    collidesWith: ["transform"],
    wrapsOn: ["text"],
  },
  /** The scale down, when it differs from `scale` across. It shares the scale lane, so both write one CSS `scale`. */
  scaleY: {
    value: number,
    tags: GRAPHICS,
    lane: "scale",
    composition: "nest",
    identity: 1,
    pivot: true,
    collidesWith: ["transform"],
    wrapsOn: ["text"],
  },
  rotate: {
    value: number,
    tags: GRAPHICS,
    lane: "rotate",
    composition: "nest",
    identity: 0,
    pivot: true,
    collidesWith: ["transform"],
    wrapsOn: ["text"],
  },
  blur: {
    value: number,
    tags: GRAPHICS,
    lane: "blur",
    composition: "nest",
    identity: 0,
    range: [0, Infinity],
    collidesWith: ["filter"],
    backend: "blur",
  },
  draw: {
    value: number,
    tags: GEOMETRY,
    lane: "draw",
    composition: "replace",
    range: [0, 1],
    pins: { pathLength: "1", "stroke-dasharray": "1 2" },
  },
  /**
   * Where the stroked part starts, 0 to 1, with `draw` where it ends. Together they write the dash itself, so the
   * window can move; CSS animates `stroke-dasharray` in Chromium, Firefox and WebKit.
   */
  drawStart: {
    value: number,
    tags: GEOMETRY,
    lane: "draw",
    composition: "replace",
    range: [0, 1],
    pins: { pathLength: "1", "stroke-dasharray": "1 2" },
  },
  strokeWidth: {
    value: number,
    tags: PAINTED,
    lane: "stroke-width",
    composition: "replace",
    attr: "stroke-width",
    range: [0, Infinity],
  },
  d: {
    value: pathData,
    tags: ["path"],
    lane: "d",
    composition: "replace",
    attr: "d",
    backend: "smil",
  },
  /**
   * How far along its `offset-path` an element is, as a percent of the path's length: the scene model's curved
   * motion. The path itself is a still style on the element.
   */
  offsetDistance: {
    value: number,
    tags: GRAPHICS,
    lane: "offset-distance",
    composition: "replace",
    range: [0, 100],
  },
  fill: { value: color, tags: PAINTED, lane: "fill", composition: "replace", attr: "fill" },
  /** How opaque the fill is: what fades one run of a text, since a `<tspan>` takes no `opacity`. */
  fillOpacity: {
    value: number,
    tags: PAINTED,
    lane: "fill-opacity",
    composition: "replace",
    attr: "fill-opacity",
    range: [0, 1],
  },
  stroke: { value: color, tags: PAINTED, lane: "stroke", composition: "replace", attr: "stroke" },
  color: {
    value: color,
    tags: ["g", "use", "text", ...GEOMETRY],
    lane: "color",
    composition: "replace",
    attr: "color",
  },
  stopColor: {
    value: color,
    tags: ["stop"],
    lane: "stop-color",
    composition: "replace",
    attr: "stop-color",
  },
  stopOpacity: {
    value: number,
    tags: ["stop"],
    lane: "stop-opacity",
    composition: "replace",
    attr: "stop-opacity",
  },
  floodColor: {
    value: color,
    tags: ["feFlood", "feDropShadow"],
    lane: "flood-color",
    composition: "replace",
    attr: "flood-color",
  },
  floodOpacity: {
    value: number,
    tags: ["feFlood", "feDropShadow"],
    lane: "flood-opacity",
    composition: "replace",
    attr: "flood-opacity",
  },
  stdDeviation: {
    value: number,
    tags: ["feGaussianBlur", "feDropShadow"],
    lane: "stdDeviation",
    composition: "replace",
    attr: "stdDeviation",
  },
  baseFrequency: {
    value: number,
    tags: ["feTurbulence"],
    lane: "baseFrequency",
    composition: "replace",
    attr: "baseFrequency",
  },
  seed: {
    value: number,
    tags: ["feTurbulence"],
    lane: "seed",
    composition: "replace",
    attr: "seed",
  },
  displace: {
    value: number,
    tags: ["feDisplacementMap"],
    lane: "displace",
    composition: "replace",
    attr: "scale",
  },
  dx: {
    value: number,
    tags: ["feOffset", "feDropShadow"],
    lane: "dx",
    composition: "replace",
    attr: "dx",
  },
  dy: {
    value: number,
    tags: ["feOffset", "feDropShadow"],
    lane: "dy",
    composition: "replace",
    attr: "dy",
  },
} as const satisfies Record<string, Spec>;

type Table = typeof CHANNELS;

export type Channel = keyof Table;

export type ChannelValues<K extends Channel = Channel> = { readonly [P in K]?: Table[P]["value"] };

export type NumericChannel = {
  [C in Channel]: Table[C]["value"] extends number ? C : never;
}[Channel];

export type RestChannel = {
  [C in Channel]: Table[C] extends { readonly identity: number } ? C : never;
}[Channel];

export type AnimatedTag = Table[Channel]["tags"][number];

export type Target = Channel | Property;

export type TargetValues = ChannelValues & PropertyValues;

export type TargetValue = number | Color | PathData;

export const valueOf = (values: TargetValues, target: Target): TargetValue | undefined =>
  values[target];

type StyledTag = Exclude<AnimatedTag, `fe${string}`>;

export type TagChannels<T extends Tag> =
  | { [C in Channel]: T extends Table[C]["tags"][number] ? C : never }[Channel]
  | (T extends StyledTag ? Property : never);

const STYLED = [
  ...new Set(Object.values(CHANNELS).flatMap((row): readonly Tag[] => row.tags)),
].filter((tag) => !tag.startsWith("fe"));

export const spec = (target: Target): Spec => {
  if (!isProperty(target)) return CHANNELS[target];
  const { initial } = declarationOf(target);

  return { value: initial, tags: STYLED, lane: target, composition: "replace", identity: initial };
};

export const isChannel = (name: string): name is Channel => Object.hasOwn(CHANNELS, name);

export type Backend = "css" | "smil" | "blur";

export const backendOf = (tag: string, channel: Target): Backend =>
  tag.startsWith("fe") ? "smil" : (spec(channel).backend ?? "css");

export const laneOf = (tag: string, channel: Target): string => {
  const row = spec(channel);

  return backendOf(tag, channel) === "smil" ? (row.attr ?? channel) : row.lane;
};

const isNumeric = (value: ChannelValues[Channel]): value is number => typeof value === "number";

export const formatValue = (value: ChannelValues[Channel]): string =>
  isNumeric(value) ? num(value) : String(value);

export const clamp = (channel: Channel, value: number): number => {
  const range = spec(channel).range;

  return range ? Math.min(range[1], Math.max(range[0], value)) : value;
};
