export type Hex = `#${string}`;

const clamp = (value: number): number => Math.max(0, Math.min(255, Math.round(value)));

/** A hex color moved toward white (amount above 0) or black (below 0); amount runs from -1 to 1. */
export const shade = (hex: Hex, amount: number): Hex => {
  const target = amount > 0 ? 255 : 0;
  const by = Math.abs(amount);

  const channels = [1, 3, 5].map((at) => {
    const value = parseInt(hex.slice(at, at + 2), 16);

    return clamp(value + (target - value) * by)
      .toString(16)
      .padStart(2, "0");
  });

  return `#${channels.join("")}`;
};
