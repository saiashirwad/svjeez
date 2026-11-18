import { SceneError } from "./scene-error";

export type Seconds = number;

declare const easeBrand: unique symbol;

export type Ease = { readonly [easeBrand]: true } & EaseBody;

type EaseBody =
  | { readonly kind: "linear" }
  | { readonly kind: "bezier"; readonly points: readonly [number, number, number, number] }
  | { readonly kind: "steps"; readonly count: number };

// SAFETY: easeBrand is declare-only, so no runtime value carries it. Every caller passes a finished EaseBody, and this only adds the compile-time brand.
const brand = (body: EaseBody): Ease => body as Ease;

const bezier = (x1: number, y1: number, x2: number, y2: number): Ease => {
  if (![x1, y1, x2, y2].every(Number.isFinite) || x1 < 0 || x1 > 1 || x2 < 0 || x2 > 1)
    throw new SceneError(
      `ease.bezier needs x1 and x2 between 0 and 1 and a finite y1 and y2, got ${x1}, ${y1}, ${x2}, ${y2}.`,
    );

  return brand({ kind: "bezier", points: [x1, y1, x2, y2] });
};

const steps = (count: number): Ease => {
  if (!Number.isInteger(count) || count < 1)
    throw new SceneError(`ease.steps needs a positive whole count, got ${count}.`);

  return brand({ kind: "steps", count });
};

export const ease = {
  linear: brand({ kind: "linear" }),
  in: bezier(0.55, 0.06, 0.68, 0.19),
  out: bezier(0.23, 1, 0.32, 1),
  inOut: bezier(0.77, 0, 0.175, 1),
  pop: bezier(0.34, 1.56, 0.64, 1),
  hold: steps(1),
  steps,
  bezier,
} as const;

export const DEFAULT_EASE: Ease = ease.out;

export const isHold = (curve: Ease | undefined): boolean =>
  curve?.kind === "steps" && curve.count === 1;

export const EPSILON = 1e-9;

export const NUDGE = 1e-5;
