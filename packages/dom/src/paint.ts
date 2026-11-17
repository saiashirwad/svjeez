import type { Paint, Pair, Rgb } from "./tree.ts";

export const isPair = <C extends string>(color: Paint<C>): color is Pair<C> =>
  typeof color !== "string";

export const paint = <C extends string>(light: C, dark: C): Paint<C> =>
  light === dark ? light : { light, dark };

export const sides = <C extends string>(color: Paint<C>): readonly C[] =>
  isPair(color) ? [color.light, color.dark] : [color];

export const mapPaint = <C extends string, D extends string>(
  color: Paint<C>,
  fn: (color: C) => D,
): Paint<D> => (isPair(color) ? paint(fn(color.light), fn(color.dark)) : fn(color));

export const channels = (color: string): [number, number, number, number] => {
  const [r = 0, g = 0, b = 0, a = 1] = (color.match(/[\d.]+/g) ?? []).map(Number);

  return [r, g, b, a];
};

export const transparent = (color: string): Rgb => {
  const [r, g, b] = channels(color);

  return `rgba(${r},${g},${b},0)`;
};

export const clear = (color: Paint): Paint => mapPaint(color, transparent);

export const opaque = (color: Paint | undefined): boolean =>
  color !== undefined && sides(color).every((c) => c.startsWith("rgb("));

export const invisible = (color: Paint): boolean => sides(color).every((c) => /,\s*0\)$/.test(c));

const hash = (text: string): string => {
  let h = 0x811c9dc5;

  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);

  return (h >>> 0).toString(36);
};

export const variable = (color: Pair<string>): string =>
  `dom-${hash(`${color.light}|${color.dark}`)}`;

export const schemeCss = (used: ReadonlyMap<string, Pair<string>>): string => {
  const names = [...used.keys()].sort();

  if (names.length === 0) return "";

  const decl = (side: "light" | "dark") =>
    names.map((n) => `--${n}:${used.get(n)![side]}`).join(";");

  return `svg{${decl("light")}}@media (prefers-color-scheme:dark){svg{${decl("dark")}}}`;
};
