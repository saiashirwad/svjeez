import {
  curveBasis,
  curveCardinal,
  curveCatmullRom,
  curveLinear,
  curveMonotoneX,
  curveNatural,
  curveStep,
  curveStepAfter,
  curveStepBefore,
} from "d3-shape";

export type { CurveFactory } from "d3-shape";

/**
 * How a line or area runs between its points. Any d3-shape `CurveFactory` works as a `curve`;
 * these are the common ones.
 */
export const curve = {
  linear: curveLinear,
  monotone: curveMonotoneX,
  step: curveStep,
  stepBefore: curveStepBefore,
  stepAfter: curveStepAfter,
  natural: curveNatural,
  basis: curveBasis,
  cardinal: curveCardinal,
  catmullRom: curveCatmullRom,
} as const;
