import type { Paint, Pair, Rgb } from "./tree.ts";

export const isPair = <C extends string>(color: Paint<C>): color is Pair<C> =>
  typeof color !== "string";

export const paint = <C extends string>(light: C, dark: C): Paint<C> =>
  light === dark ? light : { light, dark };

export const sides = <C extends string>(color: Paint<C>): readonly C[] =>
  isPair(color) ? [color.light, color.dark] : [color];

const channels = (color: string): [number, number, number, number] => {
  const [r = 0, g = 0, b = 0, a = 1] = (color.match(/[\d.]+/g) ?? []).map(Number);

  return [r, g, b, a];
};

export const transparent = (color: string): Rgb => {
  const [r, g, b] = channels(color);

  return `rgba(${r},${g},${b},0)`;
};
