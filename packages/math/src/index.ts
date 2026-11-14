export {
  tex,
  type Glyph,
  type Matrix,
  type Tex,
  type TexOptions,
  type WriteOptions,
} from "./tex.tsx";

export {
  epicycles,
  fourier,
  type Epicycles,
  type EpicyclesOptions,
  type EpicyclesSource,
  type Fourier,
  type FourierOptions,
  type FourierTerm,
  type Outline,
} from "./epicycles.tsx";

export { derive, type Derivation, type DeriveOptions, type DeriveStep } from "./derive.tsx";

export { counter, type Counter, type CounterOptions, type CounterValue } from "./counter.tsx";

export {
  construct,
  type AngleOptions,
  type BisectOptions,
  type CircleOptions,
  type ConstructOptions,
  type Construction,
  type GeoCircle,
  type GeoCurve,
  type GeoLine,
  type GeoPoint,
  type IntersectOptions,
  type LineOptions,
  type Look,
  type Pace,
  type PointOptions,
  type PolygonOptions,
  type SegmentOptions,
  type SettleOptions,
  type TickOptions,
  type Timing,
} from "./construct.tsx";

export {
  plane,
  type LabelOptions as PlaneLabelOptions,
  type LineOptions as SpanOptions,
  type Plane,
  type PlaneFunction,
  type PlaneMatrix,
  type PlaneOptions,
  type Plot,
  type PlotOptions,
  type PolygonOptions as PlanePolygonOptions,
  type StepOptions,
  type Vec2,
  type VectorOptions,
} from "./plane.tsx";

export {
  type CalculusArea,
  type CalculusAreaOptions,
  type Calculus,
  type CalculusCurve,
  type CalculusCurveOptions,
  type CalculusDot,
  type CalculusDotOptions,
  type CalculusLine,
  type CalculusLineOptions,
  type CalculusMorphOptions,
  type Moving,
  type Riemann,
  type RiemannOptions,
  type Sweep,
} from "./calculus.tsx";

export {
  contours,
  contourSweep,
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
} from "./field.tsx";
