export { scene, type SceneOptions } from "./lower";

export { svg, type SvgOptions } from "./svg";

export { diagnose, type Backend, type Diagnostic, type Feature, type Support } from "./backend";

export {
  Group,
  Sequence,
  Shape,
  Text,
  canvas,
  ref,
  type Child,
  type Common,
  type Ref,
  type SceneElement,
  type SequenceProps,
  type ShapeProps,
  type StrokeProps,
  type TextProps,
} from "./nodes";

export {
  arc,
  circle,
  ellipse,
  line,
  path,
  polygon,
  polyline,
  rect,
  svgPath,
  tokens,
  type ArcOptions,
  type Color,
  type Geometry,
  type Hex,
  type Paint,
  type PathBuilder,
  type RectOptions,
  type Theme,
  type Token,
} from "./values";

export {
  motion,
  track,
  type Anim,
  type LayerValues,
  type Motion,
  type Stack,
  type Track,
} from "./track";

export { draw, enter, exit, show, spin, wiggle, type WiggleOptions } from "./recipes";

export type { Ease, Seconds } from "../motion";

export { ease, type Curve, type Spring, type SpringOptions } from "./spring";

export { span, chain, stagger, type Span, type Spanned, type When } from "../span";

export { isLane } from "./lane";

export type * as Model from "./ir";

export type { Scene, Vec } from "./ir";
