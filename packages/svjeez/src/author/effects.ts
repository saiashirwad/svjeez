import type { Vec } from "../model/ir";
import type { Anim } from "./track";
import type { Color } from "./values";

/**
 * What a node's drawing goes through after its clip and mask, in the order `effects` lists them. Lengths are in the
 * node's own units, so they scale with it.
 */
export type Effect =
  | { readonly kind: "blur"; readonly radius: Anim<number> }
  | {
      readonly kind: "shadow";
      readonly offset: Anim<Vec>;
      readonly blur: Anim<number>;
      readonly color: Color;
      readonly opacity: Anim<number>;
    };

/** A Gaussian blur. `radius` is its standard deviation, as CSS `blur()` takes it: 0 is sharp. */
export const blur = (radius: Anim<number>): Effect => ({ kind: "blur", radius });

export interface ShadowOptions {
  readonly color: Color;
  /** How far the shadow sits from the drawing. Default [0, 0]. */
  readonly offset?: Anim<Vec>;
  /** How soft it is: the standard deviation of its blur. Default 0, a hard copy. */
  readonly blur?: Anim<number>;
  /** Multiplies the color's own alpha. Default 1. */
  readonly opacity?: Anim<number>;
}

/** A copy of the drawing's shape in `color`, moved by `offset`, blurred, and laid under it. */
export const shadow = ({
  color,
  offset = [0, 0],
  blur = 0,
  opacity = 1,
}: ShadowOptions): Effect => ({
  kind: "shadow",
  offset,
  blur,
  color,
  opacity,
});
