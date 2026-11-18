import type { Vec } from "../model/ir";
import type { Anim } from "./track";
import type { Color } from "./values";

export type Effect =
  | { readonly kind: "blur"; readonly radius: Anim<number> }
  | {
      readonly kind: "shadow";
      readonly offset: Anim<Vec>;
      readonly blur: Anim<number>;
      readonly color: Color;
      readonly opacity: Anim<number>;
    };

export const blur = (radius: Anim<number>): Effect => ({ kind: "blur", radius });

export interface ShadowOptions {
  readonly color: Color;
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
