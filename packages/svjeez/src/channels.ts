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
  /** How the lane is animated when CSS would not do: `blur` through a filter, `d` through SMIL, which Safari animates and CSS `d` does not. */
  readonly backend?: "blur" | "smil";
  /** A hard 0/1 cut compiles to `visibility` when the element sets none of these attributes. */
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
  },
  height: {
    value: number,
    tags: ["rect", "image"],
    lane: "height",
    composition: "replace",
    attr: "height",
    range: [0, Infinity],
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
    pins: { pathLength: "1", "stroke-dasharray": "1" },
  },
  d: {
    value: pathData,
    tags: ["path"],
    lane: "d",
    composition: "replace",
    attr: "d",
    backend: "smil",
  },
  fill: { value: color, tags: PAINTED, lane: "fill", composition: "replace", attr: "fill" },
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

export type Values<K extends Channel = Channel> = { readonly [P in K]?: Table[P]["value"] };

export type NumericChannel = {
  [C in Channel]: Table[C]["value"] extends number ? C : never;
}[Channel];

export type RestChannel = {
  [C in Channel]: Table[C] extends { readonly identity: number } ? C : never;
}[Channel];

export type AnimatedTag = Table[Channel]["tags"][number];

export type Target = Channel | Property;

export type TargetValues = Values & PropertyValues;

export type TargetValue = number | Color | PathData;

export const valueOf = (values: TargetValues, target: Target): TargetValue | undefined =>
  values[target];

/** Filter primitives animate through SMIL, which cannot reach a custom property. */
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

/** Filter primitives cannot take CSS, so every fe* lane is a SMIL attribute lane. */
export type Backend = "css" | "smil" | "blur";

export const backendOf = (tag: string, channel: Target): Backend =>
  tag.startsWith("fe") ? "smil" : (spec(channel).backend ?? "css");

export const laneOf = (tag: string, channel: Target): string => {
  const row = spec(channel);

  return backendOf(tag, channel) === "smil" ? (row.attr ?? channel) : row.lane;
};

const isNumeric = (value: Values[Channel]): value is number => typeof value === "number";

export const formatValue = (value: Values[Channel]): string =>
  isNumeric(value) ? num(value) : String(value);

export const clamp = (channel: Channel, value: number): number => {
  const range = spec(channel).range;

  return range ? Math.min(range[1], Math.max(range[0], value)) : value;
};
