import type { Paint, Pair, Rgb } from "./tree.ts";

export const isPair = <C extends string>(color: Paint<C>): color is Pair<C> =>
  typeof color !== "string";

/** One paint for both schemes: the color itself when they agree. */
export const paint = <C extends string>(light: C, dark: C): Paint<C> =>
  light === dark ? light : { light, dark };

/** Both sides of a paint, or the color alone. */
export const sides = <C extends string>(color: Paint<C>): readonly C[] =>
  isPair(color) ? [color.light, color.dark] : [color];

/** `fn` applied to a color, or to both sides of a paint that has two. */
export const mapPaint = <C extends string, D extends string>(
  color: Paint<C>,
  fn: (color: C) => D,
): Paint<D> => (isPair(color) ? paint(fn(color.light), fn(color.dark)) : fn(color));

/** Red, green, blue and alpha of an `rgb()` or `rgba()` color, the only kinds the page reader writes. */
export const channels = (color: string): [number, number, number, number] => {
  const [r = 0, g = 0, b = 0, a = 1] = (color.match(/[\d.]+/g) ?? []).map(Number);

  return [r, g, b, a];
};

/** The same color with nothing showing. */
export const transparent = (color: string): Rgb => {
  const [r, g, b] = channels(color);

  return `rgba(${r},${g},${b},0)`;
};

/** The same paint with nothing showing, so a fill one side lacks fades as a color change. */
export const clear = (color: Paint): Paint => mapPaint(color, transparent);

export const opaque = (color: Paint | undefined): boolean =>
  color !== undefined && sides(color).every((c) => c.startsWith("rgb("));

export const invisible = (color: Paint): boolean => sides(color).every((c) => /,\s*0\)$/.test(c));

/** FNV-1a, so a pair of colors gets a short name that stays the same from build to build. */
const hash = (text: string): string => {
  let h = 0x811c9dc5;

  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);

  return (h >>> 0).toString(36);
};

/** The CSS variable a pair is drawn with. Its name comes from its two colors, so one pair is one variable. */
export const variable = (color: Pair<string>): string =>
  `dom-${hash(`${color.light}|${color.dark}`)}`;

/** The rules that define `used`: light by default, dark when the viewer prefers it. */
export const schemeCss = (used: ReadonlyMap<string, Pair<string>>): string => {
  const names = [...used.keys()].sort();

  if (names.length === 0) return "";

  const decl = (side: "light" | "dark") =>
    names.map((n) => `--${n}:${used.get(n)![side]}`).join(";");

  return `svg{${decl("light")}}@media (prefers-color-scheme:dark){svg{${decl("dark")}}}`;
};
