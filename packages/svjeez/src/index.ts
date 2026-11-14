export { render, type RenderOptions } from "./render";

export { motion, ease, type Motion, type Stack, type Seconds, type Ease } from "./motion";

export {
  span,
  type Span,
  type OpenSpan,
  type Spanned,
  type OpenSpanned,
  type When,
  type SampleWindow,
} from "./span";

export { Clip, type ClipProps } from "./clip";

export { easeAt } from "./ease-at";

export { sample, valuesAt, type SampleOptions, type ValuesAtOptions } from "./valuesAt";

export { random } from "./random";

export { Pivot, type PivotProps } from "./pivot";

export {
  enter,
  exit,
  draw,
  shake,
  wiggle,
  sampled,
  sampledPath,
  type WiggleOptions,
  type SampledOptions,
} from "./recipes";

export { def, type Ref, type DefTag } from "./defs";

export { css, type Css, type Property, type Syntax, type SyntaxOf } from "./properties";

export { fx } from "./fx";

export { picture, Picture, type ImageFormat, type PictureData, type PictureProps } from "./picture";

export {
  font,
  type Font,
  type FontFamily,
  type FontFormat,
  type FontMetrics,
  type FontOptions,
  type FontStyle,
  type GlyphPath,
  type PathOptions,
  type TextPath,
  type FontValue,
  textWidth,
} from "./font/font";

export { strokeFont, type StrokeFont } from "./font/stroke";

export { Glyphs, type GlyphsProps } from "./glyphs";

export { Icon, type IconData, type IconProps } from "./icon";

export { Once, type OnceProps } from "./once";

export { Style, type StyleProps } from "./style";

export { spline, type Spline } from "./spline";

export {
  Ink,
  inkPath,
  tool,
  type Tool,
  type InkProps,
  type PenOptions,
  type BrushOptions,
  type NibOptions,
  type PencilOptions,
} from "./ink/ink";

export type { ElementProps } from "./el";

export type { Attrs, Tag, Color, Paint, Length } from "./attributes";

export { hexBytes, hexOf, type Hex } from "./color";

export type { Channel, ChannelValues, TagChannels, Values } from "./channels";

export type { SvgNode, Child } from "./svg";

export {
  rect,
  resample,
  polylinePath,
  pathLength,
  type Rect,
  type Point,
  type Edge,
  type PolylinePathOptions,
} from "./geometry";

export { matchPaths, type MatchOptions, type PathData, type SampledPathOptions } from "./paths";

export { num } from "./format";

export { groupBy } from "./layout/group";

export type { Box, Size } from "./layout/box";

export {
  timeline,
  show,
  during,
  cut,
  shot,
  type ShowOptions,
  type ShotMove,
  type ShotOptions,
  readingTime,
  visible,
  travel,
  type Beats,
  type HeadingOptions,
  type TravelOptions,
  type Timeline,
  type TimelineOptions,
  beats,
} from "./extras/timeline";

export {
  code,
  type Code,
  type CodeOptions,
  type CodeToken,
  type CodeTokens,
  type CodeRun,
  type CodePiece,
  type CodeWord,
  type CodeMetrics,
} from "./extras/code";

export { readout, type ReadoutOptions } from "./extras/readout";

export { morph, type MorphOptions, type Morphable, type MorphPiece } from "./extras/morph";

export { typewriter, type TypewriterOptions } from "./extras/typewriter";

export { reveal, type RevealOptions } from "./extras/reveal";

export { Focus, type FocusStop } from "./extras/focus";

export { Arrow, Callout, Brace, Underline } from "./extras/annotations";

export { Marker } from "./extras/marker";

export { Camera, Steady, type CameraProps, type CameraStop } from "./extras/camera";

export {
  base16,
  tint,
  adaptive,
  variables,
  defaultDark,
  defaultLight,
  systemLight,
  systemDark,
  type Base16,
  type Slot,
  type CodeRole,
} from "./extras/theme";

export { appWindow, type WindowOptions } from "./extras/window";

export { terminal, type TerminalCommand, type TerminalOptions } from "./extras/terminal";

export { flow, type FlowOptions, type FlowStyle } from "./extras/flow";

export type { Direction } from "./layout/box";
