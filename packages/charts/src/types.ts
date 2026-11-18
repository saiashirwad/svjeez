import type { Paint, Span, Vec } from "svjeez";
import type { Child, Ease, FontValue } from "svjeez/tools";

export type LineCurve = "linear" | "monotone" | "step";

export interface BandX {
  readonly kind: "band";
  readonly domain: readonly string[];
  readonly padding?: number;
  readonly format?: (key: string) => string;
}

export interface LinearX {
  readonly kind: "linear";
  readonly domain?: readonly [number, number];
  readonly ticks?: number;
  readonly format?: (value: number) => string;
}

export type XScale = BandX | LinearX;

export interface YScale {
  readonly domain?: readonly [number, number];
  readonly ticks?: number;
  readonly zero?: boolean;
  readonly format?: (value: number) => string;
}

export type Datum<X extends string | number = string | number> = readonly [x: X, y: number];

export interface SeriesOptions {
  readonly color: Paint;
  readonly name?: string;
  readonly span?: Span;
}

export interface BarsOptions extends SeriesOptions {
  readonly stagger?: number;
  readonly ease?: Ease;
  readonly radius?: number;
  readonly values?: boolean | ((value: number) => string);
}

export interface LineOptions extends SeriesOptions {
  readonly curve?: LineCurve;
  readonly dots?: boolean | number;
  readonly width?: number;
  readonly label?: string;
}

export interface AreaOptions extends LineOptions {
  readonly baseline?: number;
  readonly line?: boolean;
}

export type Series =
  | {
      readonly kind: "bars";
      readonly data: readonly Datum<string>[];
      readonly options: BarsOptions;
    }
  | { readonly kind: "line"; readonly data: readonly Datum[]; readonly options: LineOptions }
  | { readonly kind: "area"; readonly data: readonly Datum[]; readonly options: AreaOptions };

export interface Plot {
  readonly size: Vec;
  readonly bandwidth: number;
  x(value: string | number): number;
  y(value: number): number;
}

export interface ChartProps {
  readonly size: Vec;
  readonly x: XScale;
  readonly series: readonly Series[];
  readonly font: FontValue;
  readonly axis: Paint;
  readonly label: Paint;
  readonly y?: YScale;
  readonly at?: Vec;
  readonly grid?: boolean;
  readonly fontSize?: number;
  readonly axesIn?: Span;
  readonly key?: string;
  readonly children?: (plot: Plot) => Child;
}
