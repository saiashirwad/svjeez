import type { FontValue } from "../font/font";
import type { Ease, Seconds } from "../motion";

/**
 * The scene model: what a scene means, with nothing of any one target in it. The authoring API lowers into it, and
 * every backend (SVG, Lottie, frames) reads only this. All of it is plain data, so it survives JSON.
 *
 * Three rules hold for every node, in every backend:
 *
 * 1. A node draws in a frame of its own. A rect's frame starts at its top-left corner, a circle's, an ellipse's and an
 *    arc's at the center, a path's and a group's wherever its coordinates say, and a text's on its baseline. An arc's
 *    box is its whole circle's, so it turns around the circle's center.
 * 2. `at` puts that frame's origin in the parent's frame. Then each layer, the outermost first, moves by its
 *    `offset`, rotates and scales, all around `origin`, a fixed point in the node's frame.
 * 3. Nothing is inherited. A node with no fill has no fill.
 */
export interface Scene {
  readonly size: Vec;
  readonly duration: Seconds;
  readonly title: string;
  readonly desc?: string;
  /** Whether the scene plays again when it ends. */
  readonly loop: boolean;
  /** The time a viewer who asked for reduced motion sees, held still. */
  readonly still?: Seconds;
  /** Every color token the scene uses, with both of its values. */
  readonly tokens: Readonly<Record<string, TokenValue>>;
  /** The font files text nodes name, by family. The one member that is not plain data. */
  readonly fonts: Readonly<Record<string, FontValue>>;
  /** What `instance` nodes draw, by name. Their lanes are on the scene's clock, shared by every instance. */
  readonly symbols: Readonly<Record<string, SceneNode>>;
  readonly root: GroupNode;
}

export type { Ease, Seconds };

export type Vec = readonly [x: number, y: number];

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Red, green, blue and alpha, each from 0 to 1. */
export type Rgba = readonly [r: number, g: number, b: number, a: number];

export interface TokenValue {
  readonly light: Rgba;
  readonly dark: Rgba;
}

/** A color by name. SVG writes a CSS variable that follows the viewer; a backend with one scheme bakes that one. */
export interface Token {
  readonly kind: "token";
  readonly name: string;
}

export type Color = Rgba | Token;

/**
 * One value over time, on the scene's clock: clip offsets, repeats, rewinds and springs are already written out.
 * Times strictly increase. The value holds before the first key and after the last.
 */
export interface Lane<T> {
  readonly kind: "lane";
  readonly keys: readonly [Key<T>, Key<T>, ...Key<T>[]];
  /** The keys repeat every `period` seconds, forever. It divides the scene's duration. */
  readonly period?: Seconds;
}

export interface Key<T> {
  readonly t: Seconds;
  readonly value: T;
  /** Shapes the way from the key before to this one. `ease.hold` is a cut at `t`. The first key has none. */
  readonly ease?: Ease;
}

export type Animated<T> = T | Lane<T>;

export type Cubic = readonly [control1: Vec, control2: Vec, to: Vec];

export interface Contour {
  readonly start: Vec;
  readonly curves: readonly Cubic[];
  readonly closed: boolean;
}

/**
 * A shape's outline. Angles are degrees, clockwise from three o'clock. In a lane every key is the same kind, and
 * path keys have the same contours and curve counts: lowering matches the points, so a backend only interpolates.
 */
export type Geometry =
  | {
      readonly kind: "rect";
      readonly size: Vec;
      /** Top-left, top-right, bottom-right, bottom-left. */
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

/** Gradient points are in the node's own frame, in the same units as its geometry. */
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
  /** The width stays the same on screen whatever scales the node. */
  readonly nonScaling: boolean;
}

/** One step of a node's placement. Layers nest, so two can move the same thing without colliding. */
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
      readonly offset: Vec;
      readonly blur: number;
      readonly color: Color;
    };

/** Where a node was written, so an editor can go from the picture back to the code. */
export interface Source {
  readonly file: string;
  readonly line: number;
  readonly column: number;
}

interface Base {
  /** Unique in the scene and stable across edits: the keys from the root down, joined by `/`. */
  readonly key: string;
  readonly source?: Source;
  /** What the node covers at rest, in its own frame, before `at` and the layers. */
  readonly box: Box;
  readonly at: Animated<Vec>;
  /** The point the layers turn and scale around, in the node's own frame. */
  readonly origin: Vec;
  /** The outermost first. The node's own `rotate`, `scale` and `opacity` are the last. A layer that changes nothing is left out. */
  readonly layers: readonly Layer[];
  readonly clip?: Geometry;
  readonly mask?: SceneNode;
  readonly effects: readonly Effect[];
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
  /**
   * The part of the stroke that is drawn, as two fractions of the outline's length, from and to. The fill is never
   * trimmed. A trim with no length draws no stroke, whatever its cap.
   */
  readonly trim?: Animated<Vec>;
}

/** One line of text, already laid out: where each glyph sits is decided here, not by the viewer. */
export interface TextLine {
  readonly text: string;
  /** Where the line's baseline starts. */
  readonly at: Vec;
  /** How far each glyph moves the pen. */
  readonly advances: readonly number[];
  /** The same line as outlines, for a target with no fonts. Absent when the font's outlines can't be read. */
  readonly outline?: readonly Contour[];
}

export interface TextNode extends Base {
  readonly kind: "text";
  readonly family: string;
  readonly size: number;
  readonly lines: readonly TextLine[];
  readonly fill?: Animated<Paint>;
}

export interface ImageNode extends Base {
  readonly kind: "image";
  readonly size: Vec;
  /** A data URL. */
  readonly data: string;
}

export interface InstanceNode extends Base {
  readonly kind: "instance";
  /** A name in the scene's `symbols`. */
  readonly symbol: string;
}

export type SceneNode = GroupNode | ShapeNode | TextNode | ImageNode | InstanceNode;
