import type { Color } from "../model/color";
import { num } from "../model/format";
import type { PathData } from "../model/paths";

const number: number = 0;

// SAFETY: a placeholder that only fixes the value type; the emitter reads just the typeof of a row value.
const color = "" as Color;

// SAFETY: the same kind of placeholder, fixing the value type to path data.
const pathData = "" as PathData;

interface Spec {
  readonly value: number | Color | PathData;
  /** Attributes the element needs for this channel to draw, such as a unit path length for a dash. */
  readonly pins?: Readonly<Record<string, string>>;
  /** Turns or scales around the element's own box, so it needs `transform-box` and `transform-origin`. */
  readonly pivot?: true;
}

/** Every value the emitter animates, by the name a lane's keys carry it under. */
const CHANNELS = {
  width: { value: number },
  height: { value: number },
  opacity: { value: number },
  x: { value: number },
  y: { value: number },
  scale: { value: number, pivot: true },
  /** The scale down, when it differs from `scale` across. It shares the scale lane, so both write one CSS `scale`. */
  scaleY: { value: number, pivot: true },
  rotate: { value: number, pivot: true },
  draw: { value: number, pins: { pathLength: "1", "stroke-dasharray": "1 2" } },
  /**
   * Where the stroked part starts, 0 to 1, with `draw` where it ends. Together they write the dash itself, so the
   * window can move; CSS animates `stroke-dasharray` in Chromium, Firefox and WebKit.
   */
  drawStart: { value: number, pins: { pathLength: "1", "stroke-dasharray": "1 2" } },
  strokeWidth: { value: number },
  d: { value: pathData },
  /**
   * How far along its `offset-path` an element is, as a percent of the path's length: the scene model's curved
   * motion. The path itself is a still style on the element.
   */
  offsetDistance: { value: number },
  fill: { value: color },
  /** How opaque the fill is: what fades one run of a text, since a `<tspan>` takes no `opacity`. */
  fillOpacity: { value: number },
  stroke: { value: color },
  stopColor: { value: color },
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

/** How a lane is animated: CSS keyframes, or SMIL where CSS would not do (`d`, `width`, `height`, filter primitives). */
export type Backend = "css" | "smil";

const isNumeric = (value: ChannelValues[Channel]): value is number => typeof value === "number";

export const formatValue = (value: ChannelValues[Channel]): string =>
  isNumeric(value) ? num(value) : String(value);
