import type { FontFamily } from "../font/font";
import type { Ease, Seconds } from "./time";

export interface Scene {
  readonly size: Vec;
  readonly duration: Seconds;
  readonly title: string;
  readonly desc?: string;
  readonly loop: boolean;
  readonly still?: Seconds;
  readonly tokens: Readonly<Record<string, TokenValue>>;
  readonly fonts: Readonly<Record<string, FontFamily>>;
  readonly symbols: Readonly<Record<string, SceneNode>>;
  readonly root: GroupNode;
  readonly authored?: SceneAuthored;
}

export interface SceneAuthored {
  readonly refs: readonly { readonly key: string; readonly attached: boolean }[];
}

export interface Authored {
  readonly layout?: {
    readonly container: "stack" | "grid" | "center" | "align";
    readonly direction?: "row" | "column";
    readonly gap?: Vec;
  };
  readonly wrap?: { readonly width: number; readonly cuts: readonly number[] };
  readonly backdrop?: true;
  readonly ends?: readonly string[];
  readonly count?: { readonly ticks: readonly { readonly t: Seconds; readonly text: string }[] };
}

export type { Ease, Seconds };

export type Vec = readonly [x: number, y: number];

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export type Rgba = readonly [r: number, g: number, b: number, a: number];

export interface TokenValue {
  readonly light: Rgba;
  readonly dark: Rgba;
}

export interface Token {
  readonly kind: "token";
  readonly name: string;
}

export type Color = Rgba | Token;

export interface Lane<T> {
  readonly kind: "lane";
  readonly keys: readonly [Key<T>, Key<T>, ...Key<T>[]];
  readonly period?: Seconds;
}

export interface Key<T> {
  readonly t: Seconds;
  readonly value: T;
  readonly ease?: Ease;
  readonly via?: readonly [control1: Vec, control2: Vec];
}

export type Animated<T> = T | Lane<T>;

export type Cubic = readonly [control1: Vec, control2: Vec, to: Vec];

export interface Contour {
  readonly start: Vec;
  readonly curves: readonly Cubic[];
  readonly closed: boolean;
}

export type Geometry =
  | {
      readonly kind: "rect";
      readonly size: Vec;
      readonly radius: readonly [number, number, number, number];
    }
  | { readonly kind: "ellipse"; readonly radius: Vec }
  | {
      readonly kind: "arc";
      readonly radius: number;
      readonly start: number;
      readonly sweep: number;
    }
  | { readonly kind: "line"; readonly from: Vec; readonly to: Vec }
  | { readonly kind: "polygon"; readonly points: readonly Vec[]; readonly closed: boolean }
  | {
      readonly kind: "path";
      readonly contours: readonly Contour[];
      readonly rule: "nonzero" | "evenodd";
    };

export interface Stop {
  readonly offset: number;
  readonly color: Color;
}

export type Gradient =
  | {
      readonly kind: "linear";
      readonly from: Vec;
      readonly to: Vec;
      readonly stops: readonly Stop[];
    }
  | {
      readonly kind: "radial";
      readonly center: Vec;
      readonly radius: number;
      readonly stops: readonly Stop[];
    };

export type Paint = Color | Gradient;

export interface Stroke {
  readonly color: Animated<Paint>;
  readonly width: Animated<number>;
  readonly cap: "butt" | "round" | "square";
  readonly join: "miter" | "round" | "bevel";
  readonly dash?: readonly number[];
  readonly nonScaling: boolean;
  readonly under: boolean;
}

export interface Layer {
  readonly offset: Animated<Vec>;
  readonly rotate: Animated<number>;
  readonly scale: Animated<Vec>;
  readonly opacity: Animated<number>;
}

export type Effect =
  | { readonly kind: "blur"; readonly radius: Animated<number> }
  | {
      readonly kind: "shadow";
      readonly offset: Animated<Vec>;
      readonly blur: Animated<number>;
      readonly color: Animated<Color>;
      readonly opacity: Animated<number>;
    };

export interface Source {
  readonly file: string;
  readonly line: number;
  readonly column?: number;
}

interface Base {
  readonly key: string;
  readonly name?: string;
  readonly source?: Source;
  readonly box: Box;
  readonly at: Animated<Vec>;
  readonly origin: Vec;
  readonly layers: readonly Layer[];
  readonly clip?: Animated<Geometry>;
  readonly mask?: SceneNode;
  readonly effects: readonly Effect[];
  readonly authored?: Authored;
}

export interface GroupNode extends Base {
  readonly kind: "group";
  readonly children: readonly SceneNode[];
}

export interface ShapeNode extends Base {
  readonly kind: "shape";
  readonly geometry: Animated<Geometry>;
  readonly fill?: Animated<Paint>;
  readonly stroke?: Stroke;
  readonly trim?: Animated<Vec>;
}

export interface Face {
  readonly family: string;
  readonly weight: number;
  readonly style: "normal" | "italic";
}

export interface TextRun {
  readonly text: string;
  readonly at: Vec;
  readonly advances: readonly number[];
  readonly face: Face;
  readonly fill: Animated<Paint>;
  readonly opacity?: Animated<number>;
  readonly outline?: readonly Contour[];
}

export interface TextLine {
  readonly at: Vec;
  readonly runs: readonly TextRun[];
}

export interface TextNode extends Base {
  readonly kind: "text";
  readonly size: number;
  readonly stroke?: Stroke;
  readonly lines: readonly TextLine[];
}

export interface ImageNode extends Base {
  readonly kind: "image";
  readonly size: Vec;
  readonly data: string;
}

export interface InstanceNode extends Base {
  readonly kind: "instance";
  readonly symbol: string;
}

export type SceneNode = GroupNode | ShapeNode | TextNode | ImageNode | InstanceNode;
