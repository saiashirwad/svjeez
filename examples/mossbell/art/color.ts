export type Hex = `#${string}`;

const clamp = (value: number): number => Math.max(0, Math.min(255, Math.round(value)));

const channels = (hex: Hex): number[] => [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16));

const hexOf = (values: readonly number[]): Hex =>
  `#${values.map((value) => clamp(value).toString(16).padStart(2, "0")).join("")}`;

/** One hex color moved toward another: 0 is `from`, 1 is `to`. */
export const mix = (from: Hex, to: Hex, amount: number): Hex => {
  const target = channels(to);

  return hexOf(channels(from).map((value, i) => value + ((target[i] ?? value) - value) * amount));
};

/** A hex color moved toward white (amount above 0) or black (below 0); amount runs from -1 to 1. */
export const shade = (hex: Hex, amount: number): Hex =>
  mix(hex, amount > 0 ? "#ffffff" : "#000000", Math.abs(amount));

export const isHex = (color: string): color is Hex => /^#[0-9a-f]{6}$/i.test(color);
