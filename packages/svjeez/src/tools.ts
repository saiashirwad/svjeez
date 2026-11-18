/**
 * What tools need from a scene and authors don't: the SVG backend, capability checks, the model check and
 * description, boxes and hit-testing for editors, text layout, and every type behind the authoring API.
 */

export { svg, type SvgOptions } from "./scene/svg";

export {
  diagnose,
  type Backend,
  type Diagnostic,
  type Feature,
  type Support,
} from "./scene/backend";

export type { SceneOptions } from "./scene/lower";

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
} from "./scene/nodes";

export type {
  ArcOptions,
  Color,
  Hex,
  PathBuilder,
  RectOptions,
  Theme,
  Token,
} from "./scene/values";

export type { LayerValues, Layers, Motion } from "./scene/track";

export type {
  DrawOptions,
  EnterOptions,
  ExitOptions,
  SampledMotionOptions,
  SampledOptions,
  ShakeAmplitude,
  ShakeOptions,
  WiggleOptions,
} from "./scene/recipes";

export type { PictureData } from "./picture";

export type { Font, FontFamily, FontOptions, FontStyle, FontValue } from "./font/font";

export type { Anchor, Edge, Place } from "./scene/refs";

export type { AnchorPlace, TextAnchorPlace } from "./scene/pin";

export type { AlignProps, Alignment, GridProps, StackProps } from "./scene/layout";

export type { ArrowProps } from "./scene/arrow";

export {
  layoutRuns,
  layoutText,
  type LaidLine,
  type LaidRun,
  type TextAlign,
  type TextLayout,
  type TextLayoutOptions,
  type TextPiece,
} from "./scene/text";

export type { Ease, Seconds } from "./time";

export type { Spring, SpringOptions } from "./scene/spring";

export type { OpenSpanned, Spanned, When } from "./scene/span";

export type { MoveOptions, Moves, Point, StrokeMoves, Timeline } from "./scene/timeline";

export type { Derived, MapOptions, Source, Together } from "./scene/derived";

export { isLane } from "./scene/lane";

export type {
  Gradient,
  LinearAcrossOptions,
  LinearOptions,
  RadialAcrossOptions,
  RadialOptions,
  Stops,
} from "./scene/paint";

export type { Effect, ShadowOptions } from "./scene/effects";

export type { MorphOptions } from "./scene/morph";

export { boxesOf, hitTest, placements, valueAt, type Matrix, type Placed } from "./scene/boxes";

export { isScene } from "./scene/is-scene";

export {
  inspect,
  RULES,
  type Code,
  type Finding,
  type InspectOptions,
  type Related,
  type Severity,
} from "./scene/inspect";

export {
  describe,
  type Description,
  type DescribedFrame,
  type DescribedNode,
  type NodeTimeline,
} from "./scene/describe";

export type * as Model from "./scene/ir";

export type { Scene } from "./scene/ir";
