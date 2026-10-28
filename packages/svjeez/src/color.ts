import type { Color } from "./attributes";

/** A hex color: `#rgb`, `#rrggbb` or `#rrggbbaa`. The type fixes only the leading `#`. */
export type Hex = Extract<Color, `#${string}`>;

const SOLID = /^#(?:[\da-f]{3}|[\da-f]{6})$/i;
const WITH_ALPHA = /^#(?:[\da-f]{3}|[\da-f]{6}|[\da-f]{8})$/i;

/** `color` as a hex color, or an error naming `caller`. The type only fixes the leading `#`, and untyped callers may pass anything, so the shape is checked here. With `alpha`, `#rrggbbaa` passes too. */
export const hexOf = (color: Hex, caller: string, alpha = false): Hex => {
  if (!(alpha ? WITH_ALPHA : SOLID).test(color))
    throw new Error(
      `${caller} needs ${alpha ? "#rgb, #rrggbb or #rrggbbaa" : "#rgb or #rrggbb"} colors, got ${color}.`,
    );

  return color;
};

/** Red, green, blue and alpha bytes of `#rgb`, `#rrggbb` or `#rrggbbaa`. The caller has checked the shape. */
export const hexBytes = (hex: Hex): readonly [number, number, number, number] => {
  const digits = hex.slice(1);
  const full = digits.length === 3 ? [...digits].map((digit) => digit + digit).join("") : digits;
  const [r, g, b, a = 255] = (full.match(/../g) ?? []).map((pair) => parseInt(pair, 16));

  return [r!, g!, b!, a];
};
