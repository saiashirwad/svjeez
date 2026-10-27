import type { Color, Tag } from "./attributes";
import { num } from "./format";
import { declarationOf, formatProperty, isProperty, type Property, type PropertyValues } from "./properties";

const SHAPES = ["path", "line", "polyline", "polygon", "circle", "ellipse", "rect"] as const;
const GRAPHICS = ["g", "use", "text", "image", ...SHAPES] as const;
const PAINTED = ["g", "use", "text", "tspan", ...SHAPES] as const;

const number = 0 as number;
const color = "" as Color;

type Composition = "nest" | "replace";

interface Spec {
  readonly value: number | Color;
  readonly tags: readonly Tag[];
  readonly lane: string;
  readonly composition: Composition;
  readonly identity?: number | Color;
  readonly range?: readonly [number, number];
  readonly attr?: string;
  readonly pins?: Readonly<Record<string, string>>;
  readonly pivot?: true;
  readonly collidesWith?: readonly string[];
  /** Tags where this lane always lands on a wrapper (WebKit ignores fill-box on bare <text>). */
  readonly wrapsOn?: readonly Tag[];
}

export const CHANNELS = {
  width: { value: number, tags: ["rect", "image"], lane: "width", composition: "replace", attr: "width", range: [0, Infinity] },
  height: { value: number, tags: ["rect", "image"], lane: "height", composition: "replace", attr: "height", range: [0, Infinity] },
  opacity: { value: number, tags: GRAPHICS, lane: "opacity", composition: "nest", identity: 1, range: [0, 1], collidesWith: ["opacity"] },
  x: { value: number, tags: GRAPHICS, lane: "translate", composition: "nest", identity: 0 },
  y: { value: number, tags: GRAPHICS, lane: "translate", composition: "nest", identity: 0 },
  scale: { value: number, tags: GRAPHICS, lane: "scale", composition: "nest", identity: 1, pivot: true, collidesWith: ["transform"], wrapsOn: ["text"] },
  rotate: { value: number, tags: GRAPHICS, lane: "rotate", composition: "nest", identity: 0, pivot: true, collidesWith: ["transform"], wrapsOn: ["text"] },
  blur: { value: number, tags: GRAPHICS, lane: "blur", composition: "nest", identity: 0, range: [0, Infinity], collidesWith: ["filter"] },
  draw: { value: number, tags: SHAPES, lane: "draw", composition: "replace", range: [0, 1], pins: { pathLength: "1", "stroke-dasharray": "1" } },
  fill: { value: color, tags: PAINTED, lane: "fill", composition: "replace", attr: "fill" },
  stroke: { value: color, tags: PAINTED, lane: "stroke", composition: "replace", attr: "stroke" },
  color: { value: color, tags: ["g", "use", "text", ...SHAPES], lane: "color", composition: "replace", attr: "color" },
  stopColor: { value: color, tags: ["stop"], lane: "stop-color", composition: "replace", attr: "stop-color" },
  stopOpacity: { value: number, tags: ["stop"], lane: "stop-opacity", composition: "replace", attr: "stop-opacity" },
  floodColor: { value: color, tags: ["feFlood", "feDropShadow"], lane: "flood-color", composition: "replace", attr: "flood-color" },
  floodOpacity: { value: number, tags: ["feFlood", "feDropShadow"], lane: "flood-opacity", composition: "replace", attr: "flood-opacity" },
  stdDeviation: { value: number, tags: ["feGaussianBlur", "feDropShadow"], lane: "stdDeviation", composition: "replace", attr: "stdDeviation" },
  baseFrequency: { value: number, tags: ["feTurbulence"], lane: "baseFrequency", composition: "replace", attr: "baseFrequency" },
  seed: { value: number, tags: ["feTurbulence"], lane: "seed", composition: "replace", attr: "seed" },
  displace: { value: number, tags: ["feDisplacementMap"], lane: "displace", composition: "replace", attr: "scale" },
  dx: { value: number, tags: ["feOffset", "feDropShadow"], lane: "dx", composition: "replace", attr: "dx" },
  dy: { value: number, tags: ["feOffset", "feDropShadow"], lane: "dy", composition: "replace", attr: "dy" },
} as const satisfies Record<string, Spec>;

type Table = typeof CHANNELS;

export type Channel = keyof Table;
export type Values<K extends Channel = Channel> = { readonly [P in K]?: Table[P]["value"] };
export type NumericChannel = { [C in Channel]: Table[C]["value"] extends number ? C : never }[Channel];
export type RestChannel = { [C in Channel]: Table[C] extends { readonly identity: number } ? C : never }[Channel];
export type AnimatedTag = Table[Channel]["tags"][number];
export type Target = Channel | Property;
export type TargetValues = Values & PropertyValues;
export type TargetValue = number | Color;

export const valueOf = (values: TargetValues, target: Target): TargetValue | undefined =>
  (values as Partial<Record<Target, TargetValue>>)[target];

/** Filter primitives animate through SMIL, which cannot reach a custom property. */
type StyledTag = Exclude<AnimatedTag, `fe${string}`>;
export type TagChannels<T extends Tag> = { [C in Channel]: T extends Table[C]["tags"][number] ? C : never }[Channel] | (T extends StyledTag ? Property : never);

const STYLED = [...new Set(Object.values(CHANNELS).flatMap((row): readonly Tag[] => row.tags))].filter((tag) => !tag.startsWith("fe"));

export const spec = (target: Target): Spec => {
  if (!isProperty(target)) return CHANNELS[target];
  const { initial } = declarationOf(target);
  return { value: initial, tags: STYLED, lane: target, composition: "replace", identity: initial };
};

export const isChannel = (name: string): name is Channel => Object.hasOwn(CHANNELS, name);

/** Filter primitives cannot take CSS, so every fe* lane is a SMIL attribute lane. */
export type Backend = "css" | "smil" | "blur";

export const backendOf = (tag: string, channel: Target): Backend =>
  tag.startsWith("fe") ? "smil" : channel === "blur" ? "blur" : "css";

export const laneOf = (tag: string, channel: Target): string => {
  const row = spec(channel);
  return backendOf(tag, channel) === "smil" ? row.attr ?? channel : row.lane;
};

export const formatValue = (value: Values[Channel]): string => (typeof value === "number" ? num(value) : String(value));

export const cssDeclarations = (lane: string, values: TargetValues): string => {
  switch (lane) {
    case "translate":
      return `translate:${formatValue(values.x ?? 0)}px ${formatValue(values.y ?? 0)}px`;
    case "width":
    case "height":
      return `${lane}:${formatValue(valueOf(values, lane))}px`;
    case "rotate":
      return `rotate:${formatValue(values.rotate)}deg`;
    case "visibility":
      return `visibility:${values.opacity === 0 ? "hidden" : "visible"}`;
    case "dash":
      return `stroke-dashoffset:${num(1 - (values.draw ?? 0))}`;
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

export const clamp = (channel: Channel, value: number): number => {
  const range = spec(channel).range;
  return range ? Math.min(range[1], Math.max(range[0], value)) : value;
};
