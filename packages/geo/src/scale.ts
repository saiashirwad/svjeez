import { el, type Color, type Font, type FontFamily, type SvgNode } from "svjeez";

/** A hex color such as `#1f77b4`. */
export type Hex = `#${string}`;

/** A color scale that maps numbers to a few classes of color, so a map can group regions that share one. */
export interface ColorScale {
  /** The class color for `value`. A value outside the domain takes the nearest end, and NaN takes `empty`. */
  (value: number): Hex;
  /** `[low, high]`, or `[low, middle, high]` for a diverging scale. */
  readonly domain: readonly number[];
  /** The color of each class, from low to high. */
  readonly colors: readonly Hex[];
  /** The `colors.length + 1` values where one class ends and the next begins. */
  readonly edges: readonly number[];
  /** The color for a region with no value. */
  readonly empty: Hex;
  /** Which class `value` falls in, from 0, or -1 for NaN. */
  index(value: number): number;
}

export interface ScaleOptions {
  /** How many classes the colors are cut into. Default 9. */
  readonly steps?: number;
  /** The color for a region with no value. Default `#8a919b`. */
  readonly empty?: Hex;
}

export interface SequentialOptions extends ScaleOptions {
  /** `[low, high]`: the values that take the first and last color. */
  readonly domain: readonly [number, number];
}

export interface DivergingOptions extends ScaleOptions {
  /** `[low, middle, high]`: the values that take the first, central and last color. */
  readonly domain: readonly [number, number, number];
}

/** Ramps to pass to `sequential()` and `diverging()`, as stops that are blended in OKLab. */
export const palettes = {
  /** Dark purple to yellow. Reads well on a dark background and in greyscale. */
  viridis: ["#440154", "#3b528b", "#21918c", "#5ec962", "#fde725"],
  /** Black through purple and orange to pale yellow. */
  magma: ["#000004", "#51127c", "#b73779", "#fc8961", "#fcfdbf"],
  /** Pale to deep blue. */
  blues: ["#eff3ff", "#bdd7e7", "#6baed6", "#3182bd", "#08519c"],
  /** Red through near-white to blue, for a diverging scale. */
  redBlue: ["#b2182b", "#ef8a62", "#f7f7f7", "#67a9cf", "#2166ac"],
  /** Brown through near-white to teal, for a diverging scale. */
  brownTeal: ["#8c510a", "#d8b365", "#f5f5f5", "#5ab4ac", "#01665e"],
} as const satisfies Record<string, readonly Hex[]>;

type Lab = readonly [l: number, a: number, b: number];

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

const linear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const gamma = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);

const toLab = (hex: Hex): Lab => {
  if (!HEX.test(hex))
    throw new Error(
      `A color scale needs hex colors such as "#1f77b4", got ${JSON.stringify(hex)}. Names and CSS variables can't be blended at compile time.`,
    );
  const h = hex.length === 4 ? [...hex.slice(1)].map((c) => c + c).join("") : hex.slice(1);
  const [r, g, b] = [0, 2, 4].map((i) => linear(parseInt(h.slice(i, i + 2), 16) / 255)) as [
    number,
    number,
    number,
  ];

  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
};

const toHex = ([L, a, b]: Lab): Hex => {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;

  const rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];

  return `#${rgb
    .map((c) =>
      Math.round(255 * Math.min(1, Math.max(0, gamma(Math.min(1, Math.max(0, c))))))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
};

/** The color `t` (0 to 1) of the way along `stops`, blended in OKLab. */
const along = (stops: readonly Lab[], t: number): Hex => {
  const x = Math.min(1, Math.max(0, t)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x));
  const [a, b] = [stops[i]!, stops[i + 1]!];
  const u = x - i;

  return toHex([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u]);
};

/** Builds a scale from `ramp`, with `position(v)` giving where in 0 to 1 a value sits and `valueAt(t)` its inverse. */
function build(
  ramp: readonly Hex[],
  position: (value: number) => number,
  valueAt: (t: number) => number,
  domain: readonly number[],
  { steps = 9, empty = "#8a919b" }: ScaleOptions,
  what: string,
): ColorScale {
  if (ramp.length < 2) throw new Error(`${what} needs at least two colors, got ${ramp.length}.`);

  if (!(Number.isInteger(steps) && steps >= 2))
    throw new Error(`${what} needs a whole number of steps of at least 2, got ${steps}.`);
  const stops = ramp.map(toLab);
  const colors = Array.from({ length: steps }, (_, i) => along(stops, (i + 0.5) / steps));

  const index = (value: number) =>
    Number.isNaN(value)
      ? -1
      : Math.min(steps - 1, Math.max(0, Math.floor(position(value) * steps)));

  return Object.assign((value: number) => colors[index(value)] ?? empty, {
    domain,
    colors,
    edges: Array.from({ length: steps + 1 }, (_, i) => valueAt(i / steps)),
    empty,
    index,
  });
}

/** Colors from low to high along `colors`, cut into `steps` classes. */
export function sequential(colors: readonly Hex[], options: SequentialOptions): ColorScale {
  const [low, high] = options.domain;

  if (!(high > low))
    throw new Error(`sequential() needs a domain that rises, got [${options.domain.join(", ")}].`);

  return build(
    colors,
    (v) => (v - low) / (high - low),
    (t) => low + t * (high - low),
    options.domain,
    options,
    "sequential()",
  );
}

/** Like `sequential()`, with the middle of `colors` at the domain's middle value: above and below it run in opposite directions. */
export function diverging(colors: readonly Hex[], options: DivergingOptions): ColorScale {
  const [low, mid, high] = options.domain;

  if (!(low < mid && mid < high))
    throw new Error(
      `diverging() needs a domain of [low, middle, high] that rises, got [${options.domain.join(", ")}].`,
    );

  return build(
    colors,
    (v) => (v < mid ? (0.5 * (v - low)) / (mid - low) : 0.5 + (0.5 * (v - mid)) / (high - mid)),
    (t) => (t < 0.5 ? low + 2 * t * (mid - low) : mid + (2 * t - 1) * (high - mid)),
    options.domain,
    options,
    "diverging()",
  );
}

export interface LegendOptions {
  readonly x: number;
  readonly y: number;
  /** Px across all the classes. Default 240. */
  readonly width?: number;
  /** Px tall. Default 10. */
  readonly height?: number;
  /** A line above the bar. */
  readonly title?: string;
  /** Label every n-th class edge. Default as many as fit, about one per 48px. */
  readonly every?: number;
  /** Turns an edge value into its label. Default the number to at most two decimals. */
  readonly format?: (value: number) => string;
  /** Adds a swatch after the bar for regions with no value, labelled with this text. */
  readonly empty?: string;
  readonly fontSize?: number;
  readonly font?: Font | FontFamily | string;
  /** Text color. Default `#c9d1d9`. */
  readonly ink?: Color;
  readonly class?: string;
}

/** The scale as a bar of its classes, labelled at the class edges. A map's key. */
export function legend(scale: ColorScale, options: LegendOptions): SvgNode {
  const {
    x,
    y,
    width = 240,
    height = 10,
    fontSize = 11,
    ink = "#c9d1d9",
    format = (v: number) => String(+v.toFixed(2)),
  } = options;
  const count = scale.colors.length;
  const every =
    options.every ?? Math.max(1, Math.ceil(count / Math.max(1, Math.floor(width / 48))));
  const step = width / count;
  const top = y + (options.title ? fontSize + 6 : 0);
  const text = { fontSize, fontFamily: options.font, fill: ink };

  return el.g({ class: options.class }, [
    options.title && el.text({ x, y: y + fontSize - 2, fontWeight: 600, ...text }, options.title),
    scale.colors.map((fill, i) =>
      el.rect({ x: x + i * step, y: top, width: step + 0.5, height, fill }),
    ),
    scale.edges.flatMap((value, i) =>
      i % every === 0 || i === count
        ? [
            el.line({
              x1: x + i * step,
              x2: x + i * step,
              y1: top + height,
              y2: top + height + 3,
              stroke: ink,
              strokeWidth: 1,
            }),
            el.text(
              { x: x + i * step, y: top + height + 5 + fontSize, textAnchor: "middle", ...text },
              format(value),
            ),
          ]
        : [],
    ),
    options.empty !== undefined && [
      el.rect({
        x: x + width + 26,
        y: top,
        width: height,
        height,
        fill: scale.empty,
      }),
      el.text(
        {
          x: x + width + 26 + height / 2,
          y: top + height + 5 + fontSize,
          textAnchor: "middle",
          ...text,
        },
        options.empty,
      ),
    ],
  ]);
}
