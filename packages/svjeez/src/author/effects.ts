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
    }
  | {
      readonly kind: "emboss";
      readonly azimuth: number;
      readonly elevation: number;
      readonly depth: number;
      readonly radius: number;
      readonly color: Color;
      readonly specular: number;
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

export interface EmbossOptions {
  /**
   * Where the light comes from: `azimuth` in degrees clockwise from +x (y points down; default 225, the top left) and
   * `elevation` in degrees up from the surface (default 45).
   */
  readonly light?: { readonly azimuth?: number; readonly elevation?: number };
  /** How high the raised surface stands, in units (default 3). Larger is a steeper, darker bevel. */
  readonly depth?: number;
  /** How far in from the edge the bevel rounds off, in units (default 1.5). */
  readonly radius?: number;
  /** The color of the light (default white). */
  readonly color?: Color;
  /** How bright the glossy highlight is, 0 for a matte surface (default 0.6). */
  readonly specular?: number;
}

/** Lights the node's own shape as a bump map, so thread, glaze or a stamp reads as raised. */
export const emboss = ({
  light: { azimuth = 225, elevation = 45 } = {},
  depth = 3,
  radius = 1.5,
  color = "#ffffff",
  specular = 0.6,
}: EmbossOptions = {}): Effect => ({
  kind: "emboss",
  azimuth,
  elevation,
  depth,
  radius,
  color,
  specular,
});
