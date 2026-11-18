/**
 * Write a scene: components (`<Shape>`, `<Text>`, `<Group>`, layout and `<Arrow>`), typed values for geometry and
 * paint, tracks and motion layers for time, and timelines of verbs on refs. Tools that read or draw a scene are in
 * `svjeez/scene/tools`.
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

export { scene } from "./lower";

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
} from "./nodes";

export type { Ref } from "./refs";

export { Align, Grid, Stack } from "./layout";

export { Arrow } from "./arrow";

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
} from "./values";

export { subtract } from "./holes";

export { linear, radial } from "./paint";

export { blur, shadow } from "./effects";

export { motion, track, type Anim, type Track } from "./track";

export { draw, enter, exit, sampled, shake, spin, wiggle } from "./recipes";

export { ease, type Curve } from "./spring";

export { span, type Span } from "./span";

export { par, seq, stagger, timeline, wait, type Action } from "./timeline";

export { morph } from "./morph";

export { picture } from "../picture";

export { font } from "../font/font";

export type { Vec } from "./ir";
