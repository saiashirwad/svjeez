import type { Color } from "./attributes";

/** Red, green, blue and alpha bytes of `#rgb`, `#rrggbb` or `#rrggbbaa`. The caller has checked the shape. */
export const hexBytes = (hex: Extract<Color, `#${string}`>): readonly [number, number, number, number] => {
  const digits = hex.slice(1);
  const full = digits.length === 3 ? [...digits].map((digit) => digit + digit).join("") : digits;
  const [r, g, b, a = 255] = (full.match(/../g) ?? []).map((pair) => parseInt(pair, 16));
  return [r!, g!, b!, a];
};
