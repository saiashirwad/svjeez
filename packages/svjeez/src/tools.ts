export { durationOf, expand, propsOf } from "./author/expand";

export { svg, type SvgOptions } from "./svg/svg";

export { loadTypeGpu, type LoadTypeGpuOptions } from "./load-typegpu";

export type { Backend, Diagnostic, Feature, LaneReport, Support } from "./model/backend";

export type { SceneOptions } from "./author/lower";

export type {
  Child,
  Common,
  PictureProps,
  RunProps,
  RunStyle,
  SequenceProps,
  SeriesProps,
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

export type { Layer, LayerValues, Layers } from "./author/track";

export type { TextContent } from "./author/count";

export type { EnterOptions, ExitOptions, SampledOptions, WiggleOptions } from "./author/recipes";

export type { PictureData } from "./author/picture";

export type { Font, FontFamily, FontOptions, FontValue } from "./font/font";

export type { Anchor, Edge, Place } from "./author/refs";

export type { AnchorPlace, TextAnchorPlace } from "./author/pin";

export type {
  AlignProps,
  Alignment,
  Distribute,
  GridProps,
  Justify,
  StackProps,
} from "./author/layout";

export type { ArrowProps } from "./author/arrow";

export type { TextAlign, TextFitOptions } from "./author/text";

export type { Ease, Seconds } from "./model/time";

export type { Spring, SpringOptions } from "./author/spring";

export type { OpenSpan, When } from "./author/span";

export type { Derived, MapOptions, Source, Together } from "./author/derived";

export { isLane } from "./model/lane";

export type {
  Gradient,
  LinearAcrossOptions,
  LinearOptions,
  Pattern,
  PatternOptions,
  RadialAcrossOptions,
  RadialFit,
  RadialOptions,
  Stops,
} from "./author/paint";

export type { AdjustOptions, DisplaceOptions, Effect, ShadowOptions } from "./author/effects";

export type { MorphOptions } from "./author/morph";

export { boxesOf, hitTest, placements, type Matrix, type Placed } from "./check/boxes";

export { valueAt } from "./model/sample";

export { isScene } from "./model/is-scene";

export { SceneError, type Where } from "./model/scene-error";

export {
  RULES,
  type Code,
  type Problem,
  type Related,
  type Severity,
} from "./check/inspect-context";

export { check, type Check, type CheckOptions } from "./check/report";

export { setHost, type Host } from "./host";

export {
  describe,
  type Description,
  type DescribedFrame,
  type DescribedNode,
  type NodeTimeline,
} from "./check/describe";

export type * as Model from "./model/ir";

export type { Scene } from "./model/ir";

export {
  defaults,
  parse,
  type ChoiceParam,
  type ColorParam,
  type EasingParam,
  type Extras,
  type Fields,
  type Handles,
  type ItemValue,
  type Json,
  type JsonObject,
  type ListParam,
  type NumberParam,
  type Param,
  type Range,
  type ScalarParam,
  type Schema,
  type TextParam,
  type Values,
} from "./params";

export { componentMeta, isComponent, type ComponentMeta } from "./author/component";

export { isStandardJsonSchema } from "./author/standard";
