export { svg, type SvgOptions } from "./svg/svg";

export { diagnose, type Backend, type Diagnostic, type Feature, type Support } from "./svg/backend";

export type { SceneOptions } from "./author/lower";

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
} from "./author/nodes";

export type {
  ArcOptions,
  Color,
  Hex,
  PathBuilder,
  RectOptions,
  Theme,
  Token,
} from "./author/values";

export type { LayerValues, Layers, Motion } from "./author/track";

export type {
  DrawOptions,
  EnterOptions,
  ExitOptions,
  SampledMotionOptions,
  SampledOptions,
  ShakeAmplitude,
  ShakeOptions,
  WiggleOptions,
} from "./author/recipes";

export type { PictureData } from "./author/picture";

export type { Font, FontFamily, FontOptions, FontStyle, FontValue } from "./font/font";

export type { Anchor, Edge, Place } from "./author/refs";

export type { AnchorPlace, TextAnchorPlace } from "./author/pin";

export type { AlignProps, Alignment, GridProps, StackProps } from "./author/layout";

export type { ArrowProps } from "./author/arrow";

export {
  layoutRuns,
  layoutText,
  type LaidLine,
  type LaidRun,
  type TextAlign,
  type TextLayout,
  type TextLayoutOptions,
  type TextPiece,
} from "./author/text";

export type { Ease, Seconds } from "./model/time";

export type { Spring, SpringOptions } from "./author/spring";

export type { OpenSpanned, Spanned, When } from "./author/span";

export type { MoveOptions, Moves, Point, StrokeMoves, Timeline } from "./author/timeline";

export type { Derived, MapOptions, Source, Together } from "./author/derived";

export { isLane } from "./model/lane";

export type {
  Gradient,
  LinearAcrossOptions,
  LinearOptions,
  RadialAcrossOptions,
  RadialOptions,
  Stops,
} from "./author/paint";

export type { Effect, ShadowOptions } from "./author/effects";

export type { MorphOptions } from "./author/morph";

export { boxesOf, hitTest, placements, valueAt, type Matrix, type Placed } from "./check/boxes";

export { isScene } from "./model/is-scene";

export {
  inspect,
  RULES,
  type Code,
  type Finding,
  type InspectOptions,
  type Related,
  type Severity,
} from "./check/inspect";

export {
  describe,
  type Description,
  type DescribedFrame,
  type DescribedNode,
  type NodeTimeline,
} from "./check/describe";

export type * as Model from "./model/ir";

export type { Scene } from "./model/ir";
