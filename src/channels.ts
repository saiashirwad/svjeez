import type { Color, Tag } from "./attributes";
import { num } from "./format";

const SHAPES = ["path", "line", "polyline", "polygon", "circle", "ellipse", "rect"] as const;
const GRAPHICS = ["g", "use", "text", "image", ...SHAPES] as const;
const PAINTED = ["g", "use", "text", "tspan", ...SHAPES] as const;

const number = 0 as number;
const color = "" as Color;

/** How a lane stacks: `nest` composes like a wrapper <g> would; `replace` lives on the element itself. */
type Composition = "nest" | "replace";

interface Spec {
  readonly value: number | Color;
  readonly tags: readonly Tag[];
  /** One lane is one @keyframes or one <animate>. x and y share `translate`. On fe* tags the lane is `attr`. */
  readonly lane: string;
  readonly composition: Composition;
  /** The at-rest value. Channels without one start from motion(initial) or the element's own attribute. */
  readonly identity?: number;
  readonly range?: readonly [number, number];
  /** Serialized attribute this channel reads its rest value from, and animates via SMIL on fe* tags. */
  readonly attr?: string;
  /** Hard requirements: the element must carry exactly these attributes. */
  readonly pins?: Readonly<Record<string, string>>;
  /** Soft requirement: pivot on the element's own center unless its style says otherwise. */
  readonly pivot?: true;
  /** Static attributes that force this lane onto a wrapper. */
  readonly collidesWith?: readonly string[];
  /** Tags where this lane always lands on a wrapper (WebKit ignores fill-box on bare <text>). */
  readonly wrapsOn?: readonly Tag[];
}

export const CHANNELS = {
  opacity: { value: number, tags: GRAPHICS, lane: "opacity", composition: "nest", identity: 1, range: [0, 1], collidesWith: ["opacity"] },
  x: { value: number, tags: GRAPHICS, lane: "translate", composition: "nest", identity: 0 },
  y: { value: number, tags: GRAPHICS, lane: "translate", composition: "nest", identity: 0 },
  scale: {
    value: number,
    tags: [...GRAPHICS, "feDisplacementMap"],
    lane: "scale",
    composition: "nest",
    identity: 1,
    attr: "scale",
    pivot: true,
    collidesWith: ["transform"],
    wrapsOn: ["text"],
  },
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
  dx: { value: number, tags: ["feOffset", "feDropShadow"], lane: "dx", composition: "replace", attr: "dx" },
  dy: { value: number, tags: ["feOffset", "feDropShadow"], lane: "dy", composition: "replace", attr: "dy" },
} as const satisfies Record<string, Spec>;

type Table = typeof CHANNELS;

export type Channel = keyof Table;
export type Values<K extends Channel = Channel> = { readonly [P in K]?: Table[P]["value"] };
export type NumericChannel = { [C in Channel]: Table[C]["value"] extends number ? C : never }[Channel];
/** Channels with an at-rest value: what enter, exit, shake and wiggle move. */
export type RestChannel = { [C in Channel]: Table[C] extends { readonly identity: number } ? C : never }[Channel];
export type AnimatedTag = Table[Channel]["tags"][number];
/** Which channels a tag may animate, derived from the table. */
export type TagChannels<T extends Tag> = { [C in Channel]: T extends Table[C]["tags"][number] ? C : never }[Channel];

export const spec = (channel: Channel): Spec => CHANNELS[channel];

export const isChannel = (name: string): name is Channel => Object.hasOwn(CHANNELS, name);

/** Filter primitives cannot take CSS, so every fe* lane is a SMIL attribute lane. */
export type Backend = "css" | "smil" | "blur";

export const backendOf = (tag: string, channel: Channel): Backend =>
  tag.startsWith("fe") ? "smil" : channel === "blur" ? "blur" : "css";

export const laneOf = (tag: string, channel: Channel): string => {
  const row = spec(channel);
  return backendOf(tag, channel) === "smil" ? row.attr ?? channel : row.lane;
};

/** A channel value as CSS or SVG text. */
export const formatValue = (value: Values[Channel]): string => (typeof value === "number" ? num(value) : String(value));

/** CSS declarations for one key of a lane. `translate` packs x and y. */
export const cssDeclarations = (lane: string, values: Values): string => {
  switch (lane) {
    case "translate":
      return `translate:${formatValue(values.x ?? 0)}px ${formatValue(values.y ?? 0)}px`;
    case "rotate":
      return `rotate:${formatValue(values.rotate)}deg`;
    case "draw": {
      const drawn = values.draw ?? 0;
      return `stroke-dashoffset:${num(1 - drawn)};visibility:${drawn > 0 ? "visible" : "hidden"}`;
    }
    default: {
      const [channel] = Object.keys(values) as Channel[];
      if (!channel) throw new Error(`Lane ${lane} has no value.`);
      return `${lane}:${formatValue(values[channel])}`;
    }
  }
};

export const clamp = (channel: Channel, value: number): number => {
  const range = spec(channel).range;
  return range ? Math.min(range[1], Math.max(range[0], value)) : value;
};
