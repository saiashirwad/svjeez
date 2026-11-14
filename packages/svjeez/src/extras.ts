// "svjeez/extras" is deprecated: everything here now comes from "svjeez", except the kits that are still on their way
// to packages of their own (diagrams, axes, calculus, fields), and the editor palettes, which are in "@svjeez/code".
// It goes away in 1.0.
import * as root from "./index";

/** @deprecated Import `timeline` from "svjeez". */
export const timeline = root.timeline;

/** @deprecated Import `during` from "svjeez". */
export const during = root.during;

/** @deprecated Import `cut` from "svjeez". */
export const cut = root.cut;

/** @deprecated Import `shot` from "svjeez". */
export const shot = root.shot;

/** @deprecated Import `readingTime` from "svjeez". */
export const readingTime = root.readingTime;

/** @deprecated Import `visible` from "svjeez". */
export const visible = root.visible;

/** @deprecated Import `travel` from "svjeez". */
export const travel = root.travel;

/** @deprecated Import `beats` from "svjeez". */
export const beats = root.beats;

/** @deprecated Import `code` from "svjeez". */
export const code = root.code;

/** @deprecated Import `readout` from "svjeez". */
export const readout = root.readout;

/** @deprecated Import `morph` from "svjeez". */
export const morph = root.morph;

/** @deprecated Import `typewriter` from "svjeez". */
export const typewriter = root.typewriter;

/** @deprecated Import `reveal` from "svjeez". */
export const reveal = root.reveal;

/** @deprecated Import `Focus` from "svjeez". */
export const Focus = root.Focus;

/** @deprecated Import `Arrow` from "svjeez". */
export const Arrow = root.Arrow;

/** @deprecated Import `Callout` from "svjeez". */
export const Callout = root.Callout;

/** @deprecated Import `Brace` from "svjeez". */
export const Brace = root.Brace;

/** @deprecated Import `Underline` from "svjeez". */
export const Underline = root.Underline;

/** @deprecated Import `Marker` from "svjeez". */
export const Marker = root.Marker;

/** @deprecated Import `Camera` from "svjeez". */
export const Camera = root.Camera;

/** @deprecated Import `Steady` from "svjeez". */
export const Steady = root.Steady;

/** @deprecated Import `base16` from "svjeez". */
export const base16 = root.base16;

/** @deprecated Import `tint` from "svjeez". */
export const tint = root.tint;

/** @deprecated Import `adaptive` from "svjeez". */
export const adaptive = root.adaptive;

/** @deprecated Import `variables` from "svjeez". */
export const variables = root.variables;

/** @deprecated Import `defaultDark` from "svjeez". */
export const defaultDark = root.defaultDark;

/** @deprecated Import `defaultLight` from "svjeez". */
export const defaultLight = root.defaultLight;

/** @deprecated Import `systemLight` from "svjeez". */
export const systemLight = root.systemLight;

/** @deprecated Import `systemDark` from "svjeez". */
export const systemDark = root.systemDark;

/** @deprecated Import `appWindow` from "svjeez". */
export const appWindow = root.appWindow;

/** @deprecated Import `terminal` from "svjeez". */
export const terminal = root.terminal;

/** @deprecated Import `flow` from "svjeez". */
export const flow = root.flow;

/** @deprecated Import `ShotMove` from "svjeez". */
export type ShotMove = root.ShotMove;

/** @deprecated Import `ShotOptions` from "svjeez". */
export type ShotOptions = root.ShotOptions;

/** @deprecated Import `Beats` from "svjeez". */
export type Beats = root.Beats;

/** @deprecated Import `HeadingOptions` from "svjeez". */
export type HeadingOptions = root.HeadingOptions;

/** @deprecated Import `TravelOptions` from "svjeez". */
export type TravelOptions = root.TravelOptions;

/** @deprecated Import `Timeline` from "svjeez". */
export type Timeline<K extends string> = root.Timeline<K>;

/** @deprecated Import `TimelineOptions` from "svjeez". */
export type TimelineOptions = root.TimelineOptions;

/** @deprecated Import `Code` from "svjeez". */
export type Code = root.Code;

/** @deprecated Import `CodeOptions` from "svjeez". */
export type CodeOptions = root.CodeOptions;

/** @deprecated Import `CodeToken` from "svjeez". */
export type CodeToken = root.CodeToken;

/** @deprecated Import `CodeTokens` from "svjeez". */
export type CodeTokens = root.CodeTokens;

/** @deprecated Import `CodeRun` from "svjeez". */
export type CodeRun = root.CodeRun;

/** @deprecated Import `CodePiece` from "svjeez". */
export type CodePiece = root.CodePiece;

/** @deprecated Import `CodeWord` from "svjeez". */
export type CodeWord = root.CodeWord;

/** @deprecated Import `CodeMetrics` from "svjeez". */
export type CodeMetrics = root.CodeMetrics;

/** @deprecated Import `ReadoutOptions` from "svjeez". */
export type ReadoutOptions = root.ReadoutOptions;

/** @deprecated Import `MorphOptions` from "svjeez". */
export type MorphOptions = root.MorphOptions;

/** @deprecated Import `Morphable` from "svjeez". */
export type Morphable = root.Morphable;

/** @deprecated Import `MorphPiece` from "svjeez". */
export type MorphPiece = root.MorphPiece;

/** @deprecated Import `TypewriterOptions` from "svjeez". */
export type TypewriterOptions = root.TypewriterOptions;

/** @deprecated Import `RevealOptions` from "svjeez". */
export type RevealOptions = root.RevealOptions;

/** @deprecated Import `FocusStop` from "svjeez". */
export type FocusStop = root.FocusStop;

/** @deprecated Import `CameraStop` from "svjeez". */
export type CameraStop = root.CameraStop;

/** @deprecated Import `Base16` from "svjeez". */
export type Base16 = root.Base16;

/** @deprecated Import `Slot` from "svjeez". */
export type Slot = root.Slot;

/** @deprecated Import `CodeRole` from "svjeez". */
export type CodeRole = root.CodeRole;

/** @deprecated Import `WindowOptions` from "svjeez". */
export type WindowOptions = root.WindowOptions;

/** @deprecated Import `TerminalCommand` from "svjeez". */
export type TerminalCommand = root.TerminalCommand;

/** @deprecated Import `TerminalOptions` from "svjeez". */
export type TerminalOptions = root.TerminalOptions;

/** @deprecated Import `FlowOptions` from "svjeez". */
export type FlowOptions = root.FlowOptions;

/** @deprecated Import `FlowStyle` from "svjeez". */
export type FlowStyle = root.FlowStyle;

/** @deprecated Import `Direction` from "svjeez". */
export type Direction = root.Direction;

export {
  tomorrowNight,
  tomorrow,
  solarizedDark,
  solarizedLight,
  gruvboxDark,
  gruvboxLight,
} from "./extras/palettes";

export { axes, type Axes, type AxesOptions, type Plot, type PlotOptions } from "./extras/axes";

export {
  type Area,
  type AreaOptions,
  type Calculus,
  type Curve,
  type CurveOptions,
  type Dot,
  type DotOptions,
  type Line,
  type LineOptions,
  type MorphCurveOptions,
  type Moving,
  type Riemann,
  type RiemannOptions,
  type Sweep,
} from "./extras/calculus";

export {
  type Anchor,
  type Diagram,
  type DiagramOptions,
  type Labelled,
  type NodeRole,
} from "./extras/diagrams/kit";

export {
  flowchart,
  type Flowchart,
  type FlowchartOptions,
  type FlowchartEdge,
  type FlowchartGroup,
} from "./extras/diagrams/flowchart";

export {
  sequence,
  type Sequence,
  type SequenceMessage,
  type SequenceOptions,
} from "./extras/diagrams/sequence";

export {
  lanes,
  type Lanes,
  type LanesOptions,
  type LaneEvent,
  type LaneLink,
  type LaneSpan,
} from "./extras/diagrams/lanes";

export { tree, type Tree, type TreeOptions, type TreeSpec } from "./extras/diagrams/tree";

export {
  stateMachine,
  type Checked,
  type StateIds,
  type StateMachine,
  type StateOptions,
  type StateSpec,
  type WalkToken,
  type Transition,
  type Walk,
} from "./extras/diagrams/state";

export {
  contours,
  contourSweep,
  fieldFlow,
  fieldLines,
  slopeField,
  slopeSolution,
  streamlines,
  vectorField,
  type FieldArrow,
  type Bounds,
  type ContourLevel,
  type ContourLine,
  type ContourOptions,
  type ContourSweep,
  type ContourSweepOptions,
  type FieldFlowOptions,
  type FieldLinesOptions,
  type Grid,
  type SlopeFieldOptions,
  type SlopeFieldResult,
  type SlopeSolution,
  type SolutionOptions,
  type Streamlines,
  type StreamlinesOptions,
  type VectorField,
  type VectorFieldOptions,
  type VectorFieldResult,
} from "./extras/field";
