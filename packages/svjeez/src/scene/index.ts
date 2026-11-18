export { scene, type SceneOptions } from "./lower";

export { svg, type SvgOptions } from "./svg";

export { diagnose, type Backend, type Diagnostic, type Feature, type Support } from "./backend";

export {
  Group,
  Image,
  Instance,
  Ref,
  Sequence,
  Shape,
  Span,
  Text,
  canvas,
  ref,
  symbol,
  type Child,
  type Common,
  type ImageProps,
  type InstanceProps,
  type SceneSymbol,
  type SceneElement,
  type SequenceProps,
  type RunStyle,
  type ShapeProps,
  type SpanProps,
  type StrokeProps,
  type TextChild,
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
  type Stack as MotionStack,
  type Track,
} from "./track";

export {
  draw,
  enter,
  exit,
  sampled,
  shake,
  show,
  spin,
  wiggle,
  type SampledMotionOptions,
  type SampledOptions,
  type ShakeAmplitude,
  type WiggleOptions,
} from "./recipes";

export { picture, type PictureData } from "../picture";

export { font, type FontValue } from "../font/font";

export { Anchor, type Edge, type Place } from "./refs";

export {
  Align,
  Grid,
  Stack,
  type AlignProps,
  type Alignment,
  type GridProps,
  type StackProps,
} from "./layout";

export { Arrow, Line, type ArrowProps, type LineProps } from "./arrow";

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

export { ease, type Curve, type Spring, type SpringOptions } from "./spring";

export { span, chain, type Spanned, type When } from "../span";

export {
  Action,
  Timeline,
  par,
  seq,
  stagger,
  timeline,
  wait,
  type MoveToOptions,
  type Moves,
  type Point,
} from "./timeline";

export { derive, type DeriveOptions, type Derived, type Source } from "./derived";

export { isLane } from "./lane";

export {
  linear,
  radial,
  type Gradient,
  type LinearAcrossOptions,
  type LinearOptions,
  type RadialAcrossOptions,
  type RadialOptions,
  type Stops,
} from "./paint";

export { blur, shadow, type Effect, type ShadowOptions } from "./effects";

export { subtract } from "./holes";

export { morph, type MorphOptions } from "./morph";

export { boxesOf, hitTest, placements, valueAt, type Matrix, type Placed } from "./boxes";

export { isScene } from "./is-scene";

export type * as Model from "./ir";

export type { Scene, Vec } from "./ir";
