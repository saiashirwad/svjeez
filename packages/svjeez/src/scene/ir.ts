import type { FontFamily } from "../font/font";
import type { Ease, Seconds } from "../motion";

/**
 * The scene model: what a scene means, with nothing of any one target in it. The authoring API lowers into it, and
 * every backend (SVG, Lottie, frames) reads only this. All of it is plain data, so it survives JSON.
 *
 * Authors place every node the same way, and lowering turns that into `at` below, so no backend sees it:
 *
 *   `at` puts the node's `anchor` point, the top-left of its box unless it says, at that point of its parent. The box
 *   is what the node paints, a stroke included. A group or an instance is a frame: without an `anchor`, its `at` is
 *   where its children's `[0, 0]` goes, and a line, polygon or path with no `at` stays where its coordinates are.
 *
 * These rules hold for every node, in every backend:
 *
 * 1. A node draws in a frame of its own, where its geometry's coordinates are: a rect from `[0, 0]`, a circle, an
 *    ellipse or an arc around it, a text with its box's top-left there. `box` is what it paints in that frame.
 * 2. `at` puts that frame's origin in the parent's frame. Then each layer, the outermost first, moves by its
 *    `offset`, rotates and scales, all around `origin`, a fixed point in the node's frame.
 * 3. Nothing is inherited. A node with no fill has no fill.
 * 4. A node is drawn in this order: its own content (a group's children, the first underneath), then cut to `clip`,
 *    then masked by `mask`, then each of `effects` in turn, and only then placed by `at` and the layers, whose
 *    opacities fade the whole result. Clip, mask, gradients and effects are all in the node's own frame, so they move,
 *    turn and scale with it, and an effect's lengths scale with it too.
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
  /**
   * The font files text runs name: each family with exactly the faces some run uses, each face once. A run's `face`
   * picks one by family, weight and style. The one member that is not plain data.
   */
  readonly fonts: Readonly<Record<string, FontFamily>>;
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
  /**
   * Only in a lane of points (`at` or a layer's `offset`), and never on a cut: the way from the key before to this
   * one is the cubic Bézier from that key's value through these two control points to this one, not a straight line.
   * The ease shapes the share of the curve's length covered, as it shapes the share of a straight line's, so the
   * point keeps to the curve. In a lane with a curve, every ease stays between 0 and 1, so no point leaves its own
   * key's curve. Lowering writes curves where they take fewer keys than lines; authors never do.
   */
  readonly via?: readonly [control1: Vec, control2: Vec];
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
  /** From 0 at the gradient's start to 1 at its end. Offsets never decrease from one stop to the next. */
  readonly offset: number;
  readonly color: Color;
}

/**
 * Gradient points are in the node's own frame, in the same units as its geometry. Colors blend in sRGB, and before the
 * first stop and after the last the end colors hold. In a lane every key is the same kind with as many stops, so a
 * backend only interpolates points, offsets and colors.
 */
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
  /** A miter whose tip is more than 4 widths from its corner is beveled, as SVG's default `stroke-miterlimit` does. */
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

/**
 * What a node's drawing goes through after its clip and mask, in order: each effect takes what the one before it made.
 * Blurs are Gaussian, `radius` and `blur` their standard deviation, as CSS `blur()` takes it, in the node's own
 * units. Effects blend colors in sRGB. An effect never changes the node's box.
 */
export type Effect =
  | { readonly kind: "blur"; readonly radius: Animated<number> }
  | {
      /** A copy of the drawing's alpha in `color`, moved by `offset`, blurred and laid under the drawing. */
      readonly kind: "shadow";
      readonly offset: Animated<Vec>;
      readonly blur: Animated<number>;
      readonly color: Color;
      /** Multiplies the color's own alpha, from 0 to 1. */
      readonly opacity: Animated<number>;
    };

/** Where a node was written, so an editor can go from the picture back to the code. */
export interface Source {
  /** Empty when the code had no file, as in an editor. */
  readonly file: string;
  readonly line: number;
  /** Absent when the JSX transform didn't say. */
  readonly column?: number;
}

interface Base {
  /** Unique in the scene and stable across edits: the keys from the root down, joined by `/`. */
  readonly key: string;
  readonly source?: Source;
  /**
   * What the node paints at rest, in its own frame, before `at` and the layers: a shape's stroke included, its caps
   * and its miters too. An arc's is its whole circle's, so it turns around the circle's center. A group's holds its
   * children's.
   */
  readonly box: Box;
  readonly at: Animated<Vec>;
  /** The point the layers turn and scale around, in the node's own frame. */
  readonly origin: Vec;
  /** The outermost first. The node's own `rotate`, `scale` and `opacity` are the last. A layer that changes nothing is left out. */
  readonly layers: readonly Layer[];
  /** Only what lies inside this outline is drawn, by its fill rule. The node's box stays its content's. */
  readonly clip?: Animated<Geometry>;
  /**
   * The node shows where this drawing is opaque, by its alpha: an alpha mask, so the mask's colors, and the scheme its
   * tokens follow, don't matter. It is drawn in the node's own frame, as a child would be, and is never shown itself.
   */
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

/** One face of a font: a family in `Scene.fonts`, and the weight and style of one of its files there. */
export interface Face {
  readonly family: string;
  /** 1 to 1000, as CSS writes it: 400 is regular, 700 bold. */
  readonly weight: number;
  readonly style: "normal" | "italic";
}

/**
 * Text in one face and one paint, on one line, already laid out: where each glyph sits is decided here, not by the
 * viewer. Kerning and ligatures apply inside a run, never across two.
 */
export interface TextRun {
  readonly text: string;
  /** Where the run's first glyph starts on the baseline, in the text's frame. */
  readonly at: Vec;
  /** How far each glyph moves the pen. They add up to the run's width. */
  readonly advances: readonly number[];
  readonly face: Face;
  readonly fill: Animated<Paint>;
  /** Multiplies the alpha of the run's fill, 0 to 1. Absent is 1. */
  readonly opacity?: Animated<number>;
  /** The same run as outlines, for a target with no fonts. Absent when the face's outlines can't be read. */
  readonly outline?: readonly Contour[];
}

/** One line of text: its runs from start to end. A line with no runs is an empty line, and still takes its place. */
export interface TextLine {
  /** Where the line's baseline starts, before its first run. */
  readonly at: Vec;
  readonly runs: readonly TextRun[];
}

/**
 * Text in one size, on lines of runs. Its box runs from the tallest ascent of its faces to the deepest descent, and its
 * frame's origin is the box's top-left, so the first baseline is that ascent below it.
 */
export interface TextNode extends Base {
  readonly kind: "text";
  readonly size: number;
  readonly lines: readonly TextLine[];
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
