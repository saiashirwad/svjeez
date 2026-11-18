/**
 * What tools need from a scene and authors don't: the SVG backend, capability checks, the model check and
 * description, boxes and hit-testing for editors, text layout, and every type behind the authoring API.
 */

export { svg, type SvgOptions } from "./svg";

export { diagnose, type Backend, type Diagnostic, type Feature, type Support } from "./backend";

export type { SceneOptions } from "./lower";

export type {
  Child,
  Common,
  ImageProps,
  InstanceProps,
  RunProps,
  RunStyle,
  SceneSymbol,
  SequenceProps,
  ShapeProps,
  StrokeProps,
  TextChild,
  TextProps,
} from "./nodes";

export type { ArcOptions, Color, Hex, PathBuilder, RectOptions, Theme, Token } from "./values";

export type { LayerValues, Layers, Motion } from "./track";

export type {
  DrawOptions,
  EnterOptions,
  ExitOptions,
  SampledMotionOptions,
  SampledOptions,
  ShakeAmplitude,
  ShakeOptions,
  WiggleOptions,
} from "./recipes";

export type { PictureData } from "../picture";

export type { FontValue } from "../font/font";

export type { Anchor, Edge, Place } from "./refs";

export type { AlignProps, Alignment, GridProps, StackProps } from "./layout";

export type { ArrowProps } from "./arrow";

export {
  layoutRuns,
  layoutText,
  type LaidLine,
  type LaidRun,
  type TextAlign,
  type TextLayout,
  type TextLayoutOptions,
  type TextPiece,
} from "./text";

export type { Ease, Seconds } from "../motion";

export type { Spring, SpringOptions } from "./spring";

export type { OpenSpanned, Spanned, When } from "./span";

export type { MoveOptions, Moves, Point, StrokeMoves, Timeline } from "./timeline";

export type { Derived, MapOptions, Source, Together } from "./derived";

export { isLane } from "./lane";

export type {
  Gradient,
  LinearAcrossOptions,
  LinearOptions,
  RadialAcrossOptions,
  RadialOptions,
  Stops,
} from "./paint";

export type { Effect, ShadowOptions } from "./effects";

export type { MorphOptions } from "./morph";

export { boxesOf, hitTest, placements, valueAt, type Matrix, type Placed } from "./boxes";

export { isScene } from "./is-scene";

export {
  inspect,
  RULES,
  type Code,
  type Finding,
  type InspectOptions,
  type Related,
  type Severity,
} from "./inspect";

export {
  describe,
  type Description,
  type DescribedFrame,
  type DescribedNode,
  type NodeTimeline,
} from "./describe";

export type * as Model from "./ir";

export type { Scene } from "./ir";
