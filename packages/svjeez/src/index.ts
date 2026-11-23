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

export { context, type Context } from "./author/expand";

export type { StandardJSONSchemaV1, StandardSchemaV1, JsonSchema } from "./author/standard";

export { Align, Center, Grid, spread, Stack, type StackAlignment } from "./author/layout";

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
  random,
  rect,
  tokens,
  type Color,
  type Geometry,
  type Paint,
} from "./author/values";

export { moved, subtract } from "./author/holes";

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
  linear,
  pattern,
  radial,
  type Pattern,
  type PatternOptions,
  type RadialFit,
} from "./author/paint";

export { adjust, blur, displace, shadow } from "./author/effects";

export { track, type Anim, type Track } from "./author/track";

export type { LoopOptions } from "./model/steps";

export { through, within } from "./author/derived";

export { timeAt } from "./author/window";

export { enter, exit, sampled, wiggle } from "./author/recipes";

export { ease, type Curve } from "./author/spring";

export { span, type PaceOptions, type Span } from "./author/span";

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
