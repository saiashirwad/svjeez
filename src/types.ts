/** Shared animation data model. Kept separate from the SVG tree so both layers stay dependency-free. */

export type CssValue = string | number;

/** High-level motion properties. Any additional key is emitted as a CSS property. */
export interface MotionProps {
  opacity?: CssValue;
  x?: CssValue;
  y?: CssValue;
  scale?: CssValue;
  rotate?: CssValue;
  dashoffset?: CssValue;
  transform?: CssValue;
  [property: string]: CssValue | undefined;
}

export interface Frame {
  /** Time in seconds. */
  t: number;
  props: MotionProps;
  /** Per-keyframe CSS easing, applied from this frame to the next. */
  ease?: string;
}

export interface AnimationOptions {
  timing?: string;
  iterations?: number | "infinite";
  fill?: "none" | "forwards" | "backwards" | "both";
  /** Seconds. Applies once, not per iteration. */
  delay?: number;
}

export interface AnimationRequest {
  name: string;
  frames: Frame[];
  options?: AnimationOptions;
}
