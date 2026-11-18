/**
 * Write a scene: components (`<Shape>`, `<Text>`, `<Group>`, layout and `<Arrow>`), typed values for geometry and
 * paint, tracks and motion layers for time, and timelines of verbs on refs. Tools that read or draw a scene are in
 * `svjeez/tools`.
 *
 * One rule orders every argument list: what, then when, then how. `track(0).to(1, span(0.2, 0.5), ease.out)`,
 * `card.move([40, 0], 0.5, ease.inOut)`, `enter(span(0, 0.4), { from: { scale: 0 }, curve: ease.pop })`. A recipe
 * whose "what" has a default takes it in its options, after the when.
 *
 * `at` is always a place, never a time: a node's own position in its parent. A motion layer's `offset` moves the node
 * from there, on top of it, and a timeline's `moveBy` moves its `at` by an amount. Time is a span: `span(start, over)`.
 *
 * Opacity: a prop is the node's own value; a motion layer (`enter`, `exit`, `motion()`) wraps it and multiplies;
 * a timeline verb (`ref.show`, `ref.hide`, `ref.to`) writes the prop's track.
 */

export { scene } from "./author/lower";

export {
  Group,
  Image,
  Instance,
  Run,
  Sequence,
  Shape,
  Text,
  canvas,
  ref,
  symbol,
  type SceneElement,
} from "./author/nodes";

export type { Ref } from "./author/refs";

export { Align, Grid, Stack } from "./author/layout";

export { Arrow } from "./author/arrow";

export {
  arc,
  circle,
  ellipse,
  line,
  path,
  pathData,
  polygon,
  polyline,
  rect,
  tokens,
  type Geometry,
  type Paint,
} from "./author/values";

export { subtract } from "./author/holes";

export { linear, radial } from "./author/paint";

export { blur, shadow } from "./author/effects";

export { motion, track, type Anim, type Track } from "./author/track";

export { draw, enter, exit, sampled, shake, spin, wiggle } from "./author/recipes";

export { ease, type Curve } from "./author/spring";

export { span, type Span } from "./author/span";

export { par, seq, stagger, timeline, wait, type Action } from "./author/timeline";

export { morph } from "./author/morph";

export { picture } from "./author/picture";

export { font } from "./font/font";

export type { Vec } from "./model/ir";
