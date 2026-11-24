import type { Color } from "../model/color";
import { num } from "../model/format";
import type { PathData } from "../model/paths";
import { isNumber } from "../model/guards";

const number: number = 0;

// SAFETY: a placeholder that only fixes the value type; the emitter reads just the typeof of a row value.
const color = "" as Color;

// SAFETY: the same kind of placeholder, fixing the value type to path data.
const pathData = "" as PathData;

interface Spec {
  readonly value: number | Color | PathData;
  readonly pins?: Readonly<Record<string, string>>;
  readonly pivot?: true;
}

const CHANNELS = {
  width: { value: number },
  height: { value: number },
  opacity: { value: number },
  x: { value: number },
  y: { value: number },
  scale: { value: number, pivot: true },
  scaleY: { value: number, pivot: true },
  rotate: { value: number, pivot: true },
  skew: { value: number, pivot: true },
  draw: { value: number, pins: { pathLength: "1", "stroke-dasharray": "1 2" } },
  drawStart: { value: number, pins: { pathLength: "1", "stroke-dasharray": "1 2" } },
  strokeWidth: { value: number },
  dashOffset: { value: number },
  d: { value: pathData },
  offsetDistance: { value: number },
  startOffset: { value: number },
  fill: { value: color },
  fillOpacity: { value: number },
  stroke: { value: color },
  stopColor: { value: color },
  floodColor: { value: color },
  stdDeviation: { value: number },
  dx: { value: number },
  dy: { value: number },
} as const satisfies Record<string, Spec>;

type Table = typeof CHANNELS;

export type Channel = keyof Table;

export type ChannelValues<K extends Channel = Channel> = { readonly [P in K]?: Table[P]["value"] };

export type ChannelValue = number | Color | PathData;

export const valueOf = (values: ChannelValues, target: Channel): ChannelValue | undefined =>
  values[target];

export const spec = (target: Channel): Spec => CHANNELS[target];

export type Backend = "css" | "smil";

export const formatValue = (value: ChannelValues[Channel]): string =>
  isNumber(value) ? num(value) : String(value);
