export { looping, scene } from "./author/lower";

export {
  Group,
  Picture,
  Run,
  Sequence,
  Shape,
  Text,
  ref,
  type Bounds,
  type Child,
  type SceneElement,
} from "./author/nodes";

export type { Anchor, Ref } from "./author/refs";

export { component, type ComponentOptions, type Slots } from "./author/component";

export type { StandardJSONSchemaV1, StandardSchemaV1, JsonSchema } from "./author/standard";

export { Align, Center, Grid, spread, Stack } from "./author/layout";

export { Arrow } from "./author/arrow";

export {
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

export { linear, pattern, radial } from "./author/paint";

export { adjust, blur, displace, shadow } from "./author/effects";

export { track, type Anim, type Track } from "./author/track";

export { through, within } from "./author/derived";

export { enter, exit, sampled, wiggle } from "./author/recipes";

export { ease, type Curve } from "./author/spring";

export { span, type Span } from "./author/span";

export { clock, type Clock } from "./author/clock";

export { Slot, type SlotProps } from "./author/slot";

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

export { param } from "./params";

export { picture } from "./author/picture";

export { font } from "./font/font";

export type { Vec } from "./model/ir";
