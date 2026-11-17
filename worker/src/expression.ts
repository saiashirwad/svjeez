import {
  absDependencies,
  acosDependencies,
  addDependencies,
  asinDependencies,
  atan2Dependencies,
  atanDependencies,
  cbrtDependencies,
  ceilDependencies,
  compileDependencies,
  cosDependencies,
  coshDependencies,
  create,
  divideDependencies,
  eDependencies,
  expDependencies,
  floorDependencies,
  logDependencies,
  log10Dependencies,
  maxDependencies,
  minDependencies,
  modDependencies,
  multiplyDependencies,
  piDependencies,
  powDependencies,
  roundDependencies,
  signDependencies,
  sinDependencies,
  sinhDependencies,
  sqrtDependencies,
  subtractDependencies,
  tanDependencies,
  tanhDependencies,
  unaryMinusDependencies,
  unaryPlusDependencies,
  type EvalFunction,
  type FactoryFunctionMap,
} from "mathjs/number";

/**
 * Arithmetic and the elementary functions only: no import, evaluate, parse or units, so an expression from a request
 * can compute and do nothing else. mathjs interprets the tree it parses; it never calls eval or new Function, which a
 * Worker forbids.
 */
const factories = {
  absDependencies,
  acosDependencies,
  addDependencies,
  asinDependencies,
  atan2Dependencies,
  atanDependencies,
  cbrtDependencies,
  ceilDependencies,
  compileDependencies,
  cosDependencies,
  coshDependencies,
  divideDependencies,
  eDependencies,
  expDependencies,
  floorDependencies,
  logDependencies,
  log10Dependencies,
  maxDependencies,
  minDependencies,
  modDependencies,
  multiplyDependencies,
  piDependencies,
  powDependencies,
  roundDependencies,
  signDependencies,
  sinDependencies,
  sinhDependencies,
  sqrtDependencies,
  subtractDependencies,
  tanDependencies,
  tanhDependencies,
  unaryMinusDependencies,
  unaryPlusDependencies,
};

// SAFETY: mathjs types each *Dependencies export as possibly undefined; every one of these is defined.
const math = create(factories as FactoryFunctionMap);

/** The functions an expression may call, for the model's instructions. */
export const FUNCTIONS =
  "sin, cos, tan, asin, acos, atan, atan2, sinh, cosh, tanh, sqrt, cbrt, exp, log, log10, abs, sign, floor, ceil, round, min, max, mod";

/** A value of `variables` for every point; NaN where the expression has no finite real value. */
export type Expression = (variables: Readonly<Record<string, number>>) => number;

const reason = (error: Error | string) => (error instanceof Error ? error.message : error);

/**
 * `source`, compiled once and evaluated per point. `path` names the param in errors. A syntax error throws here, an
 * unknown name or function on the first evaluation.
 */
export const expression = (source: string, path: string, example: string): Expression => {
  const fail = (why: string): never => {
    throw new Error(
      `${path} "${source}" cannot be evaluated: ${why}. Write it like ${example}, with * for products, ^ for powers, pi, e and only ${FUNCTIONS}.`,
    );
  };

  let compiled: EvalFunction | undefined;

  try {
    compiled = math.compile(source);
  } catch (error) {
    fail(reason(error instanceof Error ? error : String(error)));
  }

  return (variables) => {
    try {
      const value = compiled?.evaluate({ ...variables });

      return Number.isFinite(value) ? value : NaN;
    } catch (error) {
      return fail(reason(error instanceof Error ? error : String(error)));
    }
  };
};
