// Edit a svjeez scene's source through controls. `createEditor` holds the file and its picture; every framework's
// components bind it, and the control math here is what they share.
export {
  createEditor,
  handleAt,
  handleOf,
  init,
  timeAt,
  update,
  valueOf,
  type Clock,
  type Cmd,
  type Editor,
  type Effects,
  type Grip,
  type Init,
  type Input,
  type Msg,
  type Picture,
  type State,
} from "./editor.ts";

export {
  bend,
  bezierOf,
  curveOf,
  nudge,
  paramFor,
  rgbOf,
  scrub,
  valuesOf,
  withRgb,
  type Bezier,
  type Settable,
  type Value,
  type ValueOf,
} from "./controls.ts";

export { measureMove, type Move } from "./probe.ts";

export type { Compiled, SceneSize, SourceError } from "./compile.ts";

export type { Kind, Line, Literal, Piece } from "./source.ts";
