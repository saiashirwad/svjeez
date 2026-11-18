import type { Vec } from "../model/ir";
import type { Anim } from "./track";
import type { Color } from "./values";

export type Effect =
  | { readonly kind: "blur"; readonly radius: Anim<number> }
  | {
      readonly kind: "adjust";
      readonly saturate: Anim<number>;
      readonly hue: Anim<number>;
      readonly brightness: Anim<number>;
      readonly contrast: Anim<number>;
    }
  | {
      readonly kind: "displace";
      readonly scale: Anim<number>;
      readonly frequency: Anim<number>;
      readonly seed: number;
      readonly octaves: number;
    }
  | {
      readonly kind: "shadow";
      readonly offset: Anim<Vec>;
      readonly blur: Anim<number>;
      readonly color: Anim<Color>;
      readonly opacity: Anim<number>;
    };

export const blur = (radius: Anim<number>): Effect => ({ kind: "blur", radius });

export interface AdjustOptions {
  /** 1 is unchanged, 0 is grey. */
  readonly saturate?: Anim<number>;
  /** Degrees around the color wheel. */
  readonly hue?: Anim<number>;
  /** 1 is unchanged, 0 is black. */
  readonly brightness?: Anim<number>;
  /** 1 is unchanged, 0 is flat grey. */
  readonly contrast?: Anim<number>;
}

export const adjust = ({
  saturate = 1,
  hue = 0,
  brightness = 1,
  contrast = 1,
}: AdjustOptions): Effect => ({ kind: "adjust", saturate, hue, brightness, contrast });

export interface DisplaceOptions {
  /** How far, in units, the noise pushes a point at most. */
  readonly scale: Anim<number>;
  /** Noise cycles per unit; around 0.02 is a gentle wobble. */
  readonly frequency: Anim<number>;
  /** Picks the noise; the same seed draws the same picture. */
  readonly seed: number;
  /** Layers of finer noise, 1 or more. */
  readonly octaves?: number;
}

export const displace = ({ scale, frequency, seed, octaves = 1 }: DisplaceOptions): Effect => ({
  kind: "displace",
  scale,
  frequency,
  seed,
  octaves,
});

export interface ShadowOptions {
  readonly color: Anim<Color>;
  readonly offset?: Anim<Vec>;
  readonly blur?: Anim<number>;
  readonly opacity?: Anim<number>;
}

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
