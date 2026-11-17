import type { Attrs, Base16, Color, Drawn, Ease, Part, Point, Rect, Span, SvgNode } from "svjeez";

export type FontAttr = NonNullable<Attrs<"text">["fontFamily"]>;

export type Curve = "linear" | "monotone" | "step";

export interface BandX {
  readonly kind: "band";
  /** The categories, left to right. Each is one band. */
  readonly domain: readonly string[];
  /** Gap between bands as a fraction of a band, 0 to 1. Default 0.3. */
  readonly padding?: number;
  readonly format?: (key: string) => string;
}

export interface LinearX {
  readonly kind: "linear";
  /** `[min, max]`, widened to round numbers. Without it the scale fits `data`. */
  readonly domain?: readonly [number, number];
  /** About how many ticks. Default 6. */
  readonly ticks?: number;
  readonly format?: (value: number) => string;
}

export type XScale = BandX | LinearX;

export interface YScale {
  /** `[min, max]`, widened to round numbers. Without it the scale fits `data`. */
  readonly domain?: readonly [number, number];
  /** About how many ticks. Default 5. */
  readonly ticks?: number;
  /** Stretch the fitted domain to include 0, which bars need. Default true. An explicit `domain` is never stretched. */
  readonly zero?: boolean;
  readonly format?: (value: number) => string;
}

/** The x value a point carries: a category on a band scale, a number on a linear one. */
export type XValue<K extends XScale["kind"]> = K extends "band" ? string : number;

/** One point of a series, `[x, y]`. */
export type Datum<K extends XScale["kind"]> = readonly [x: XValue<K>, y: number];

export interface ChartOptions<X extends XScale = XScale> {
  /** The plot area in scene px. The axes draw outside it, so leave about 50px on the left and 30px at the bottom. */
  readonly frame: Rect;
  readonly x: X;
  readonly y?: YScale;
  /** Every point the chart will draw, so the scales fit them. Needed only for a domain left out. */
  readonly data?: readonly Datum<X["kind"]>[];
  /** Faint lines across the plot at the ticks. Default false. */
  readonly grid?: boolean;
  /** Axis lines use `comment`, labels `muted`, series take the accents in order. Default `defaultDark`. */
  readonly theme?: Base16;
  readonly fontSize?: number;
  readonly font?: FontAttr;
}

export interface SeriesOptions {
  /** Default: the next accent of the theme, in a fixed order. */
  readonly color?: Color;
}

export interface ChartBarsOptions extends SeriesOptions {
  /** Seconds between one bar's start and the next's. The last bar ends with the span, so each bar grows for `over - (bars - 1) * stagger`. Default 0.08, or less when the span is short. */
  readonly stagger?: number;
  /** How each bar grows. Default `ease.out`. */
  readonly ease?: Ease;
  /** Draw this series as bar `index` of `count` side by side in each band. */
  readonly group?: { readonly index: number; readonly count: number };
  /** Corner radius of the free end in px. Default 3. */
  readonly radius?: number;
  /** Write each value at the end of its bar. `true` uses the y axis format. */
  readonly values?: boolean | ((value: number) => string);
}

export interface ChartLineOptions extends SeriesOptions {
  readonly curve?: Curve;
  /** A dot on each point as the line reaches it. `true` is radius 4. */
  readonly dots?: boolean | number;
  readonly strokeWidth?: number;
  /** The series name, written past the last point in the series color. */
  readonly label?: string;
}

export interface ChartAreaOptions extends ChartLineOptions {
  /** The y value the fill reaches down to. Default 0, or the bottom of the plot when 0 is outside it. */
  readonly baseline?: number;
  /** Stroke the top edge too. Default true. */
  readonly line?: boolean;
}

/** A bar, by its category. `box` is where it rests and `span` its staggered window, from starting to grow to full height. */
export interface ChartBar extends Part {
  readonly value: number;
}

/** `span` is the span you passed: the last bar has grown at its end. `bounds` covers the bars. */
export type ChartBars = Drawn<ChartBar>;

/**
 * A point of a line or area, by its x value written as a string (`"Q3"`, `"2019"`). `box` is its dot, or has no
 * size without `dots`. `span` starts when the line reaches it and lasts while its dot pops in, no time without `dots`.
 */
export interface ChartPoint extends Part {
  /** Where the point is, in scene px. */
  readonly point: Point;
  readonly value: number;
}

/** `span` runs from `at` to when the line has drawn, with its label. `bounds` covers the points. */
export interface ChartLine extends Drawn<ChartPoint> {
  /** The path data of the line. */
  readonly d: string;
}

export interface ChartArea extends ChartLine {
  /** The path data of the filled shape. */
  readonly fill: string;
}

export interface Chart<K extends XScale["kind"] = XScale["kind"]> {
  /** The axes, ticks, labels and grid. They are drawn at once; wrap them in a motion to fade them in. */
  readonly node: SvgNode;
  readonly bounds: Rect;
  /** A band's center, or a linear value, in scene px. */
  x(value: XValue<K>): number;
  /** A y value in scene px. */
  y(value: number): number;
  /** The width of one band in px. 0 on a linear scale. */
  readonly bandwidth: number;
  /** Bars grow up from the baseline over `span`, a record of values or `[key, value]` pairs. Band scales only. */
  readonly bars: K extends "band"
    ? (
        span: Span,
        values: Readonly<Record<string, number>> | readonly Datum<"band">[],
        options?: ChartBarsOptions,
      ) => ChartBars
    : never;
  /** The line draws on over `span`. */
  line(span: Span, points: readonly Datum<K>[], options?: ChartLineOptions): ChartLine;
  /** The fill wipes in with the line over `span`. */
  area(span: Span, points: readonly Datum<K>[], options?: ChartAreaOptions): ChartArea;
}
