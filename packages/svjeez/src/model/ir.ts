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
  readonly root: GroupNode;
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

/** A color scheme: what `prefers-color-scheme` answers. */
export type Scheme = "light" | "dark";

export type Rgba = readonly [r: number, g: number, b: number, a: number];

export interface TokenValue {
  readonly light: Rgba;
  readonly dark: Rgba;
  /** A token made by mix(): `share` of `a` blended into `b`. */
  readonly mix?: { readonly a: Color; readonly b: Color; readonly share: number };
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
  | { readonly kind: "points"; readonly points: readonly Vec[]; readonly closed: boolean }
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

export interface Pattern {
  readonly kind: "pattern";
  readonly size: Vec;
  readonly offset: Animated<Vec>;
  readonly tile: GroupNode;
}

export type Paint = Color | Gradient | Pattern;

/** How a node composites onto what is drawn beneath it inside its group. Normal is the absence of one. */
export type Blend =
  | "multiply"
  | "screen"
  | "overlay"
  | "darken"
  | "lighten"
  | "color-dodge"
  | "color-burn"
  | "hard-light"
  | "soft-light"
  | "difference"
  | "exclusion"
  | "hue"
  | "saturation"
  | "color"
  | "luminosity";

export interface Stroke {
  readonly color: Animated<Paint>;
  readonly width: Animated<number>;
  readonly cap: "flat" | "round" | "square";
  readonly join: "sharp" | "round" | "flat";
  readonly dash?: readonly number[];
  readonly dashOffset?: Animated<number>;
  /** The stroke keeps its width when the node is scaled. */
  readonly fixedWidth: boolean;
  readonly under: boolean;
}

export interface Layer {
  readonly offset: Animated<Vec>;
  readonly rotate: Animated<number>;
  readonly scale: Animated<Vec>;
  /** Degrees of shear along x in the layer's own frame, applied before scale and rotate. */
  readonly skew: Animated<number>;
  readonly opacity: Animated<number>;
}

export type Effect =
  | { readonly kind: "blur"; readonly radius: Animated<number> }
  | {
      readonly kind: "adjust";
      readonly saturate: Animated<number>;
      readonly hue: Animated<number>;
      readonly brightness: Animated<number>;
      readonly contrast: Animated<number>;
    }
  | {
      readonly kind: "displace";
      readonly scale: Animated<number>;
      readonly frequency: Animated<number>;
      readonly seed: number;
      readonly octaves: number;
    }
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
  readonly blend?: Blend;
  /** The one color scheme it shows in; it shows in both without one. */
  readonly scheme?: Scheme;
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
  readonly italic: boolean;
}

export interface TextRun {
  readonly text: string;
  readonly at: Vec;
  readonly advances: readonly number[];
  /** Extra space after every glyph, already part of `advances`. */
  readonly letterSpacing?: number;
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
  /** Text set along an outline, from `start` (a fraction of its length), aligned to that point. */
  readonly along?: {
    readonly path: Geometry;
    readonly start: Animated<number>;
    readonly align: "start" | "center" | "end";
  };
}

export interface PictureNode extends Base {
  readonly kind: "picture";
  readonly size: Vec;
  readonly data: string;
}

export type SceneNode = GroupNode | ShapeNode | TextNode | PictureNode;
