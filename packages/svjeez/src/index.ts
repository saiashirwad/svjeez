export { scene } from "./author/lower";

export {
  Group,
  Picture,
  Run,
  Sequence,
  Series,
  Shape,
  Text,
  ref,
  type Bounds,
  type Child,
  type GroupProps,
  type SceneElement,
  type ShapeProps,
  type TextProps,
} from "./author/nodes";

export type { Ref } from "./author/refs";

export type { Origin } from "./author/settle";

export { component, type ComponentOptions, type Slots } from "./author/component";

export { Fragment, h, type HProps } from "./h";

export { context, durationOf, type Context } from "./author/expand";

export type { StandardJSONSchemaV1, StandardSchemaV1, JsonSchema } from "./author/standard";

export { Align, Center, Grid, spread, Stack, type StackAlignment } from "./author/layout";

export type { AnchorPlace, TextAnchorPlace } from "./author/pin";

export { Arrow } from "./author/arrow";

export {
  alpha,
  arc,
  circle,
  ellipse,
  line,
  mix,
  path,
  polygon,
  rect,
  tokens,
  type Color,
  type Geometry,
  type Paint,
} from "./author/values";

export { moved, subtract } from "./author/holes";

export { random } from "./author/random";

export {
  along,
  around,
  bounds,
  length,
  merge,
  mirrored,
  pointAt,
  reversed,
  rotated,
  scaled,
  spline,
  type AroundOptions,
  type PointAt,
  type SplineOptions,
} from "./author/geometry";

export {
  blob,
  brush,
  Limb,
  limb,
  scatter,
  type BlobOptions,
  type BrushOptions,
  type BrushPlace,
  type LimbOptions,
  type LimbPose,
  type LimbPoseProps,
  type LimbProps,
  type ScatterOptions,
} from "./author/draw";

export {
  linear,
  noise,
  none,
  pattern,
  radial,
  type Noise,
  type NoiseOptions,
  type None,
  type PaintLayer,
  type Paints,
  type Pattern,
  type PatternOptions,
  type RadialFit,
  type Stops,
} from "./author/paint";

export { adjust, blur, displace, emboss, shadow, type EmbossOptions } from "./author/effects";

export { keyframes, track, type Anim, type Goal, type Keyframe, type Track } from "./author/track";

export type { LoopOptions } from "./model/steps";

export { through, within, type Derived, type MapOptions } from "./author/derived";

export { timeAt } from "./author/window";

export { enter, exit, ride, sampled, wiggle } from "./author/recipes";

export { ease, type Curve } from "./author/spring";

export { span, type Interval, type PaceOptions, type Span, type When } from "./author/span";

export { clock, type Clock } from "./author/clock";

export { Slot, type SlotProps } from "./author/slot";

export { Shader, type ShaderInput, type ShaderInputs, type ShaderProps } from "./author/shader";

export { morph } from "./author/morph";

export {
  count,
  numeral,
  type Count,
  type CountOptions,
  type NumberFormat,
  type NumeralOptions,
} from "./author/count";

export {
  chars,
  typed,
  words,
  type Caret,
  type Split,
  type Typed,
  type TypedOptions,
} from "./author/typed";

export { defaults, param, parse, type Values } from "./params";

export { picture, type PictureData } from "./author/picture";

export {
  font,
  type Font,
  type FontFamily,
  type FontOptions,
  type FontSource,
  type FontValue,
  type MeasureOptions,
} from "./font/font";

export type { TextFitOptions } from "./author/text";

export type { Vec } from "./model/ir";
