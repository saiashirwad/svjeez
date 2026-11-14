import type { Box, Item, Paint, Vector } from "./tree.ts";

type Pair = Exclude<Paint, string>;

const hash = (text: string): string => {
  let h = 0x811c9dc5;

  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);

  return (h >>> 0).toString(36);
};

/** One paint for both schemes: the color itself when they agree. */
export const paint = (light: string, dark: string): Paint =>
  light === dark ? light : { light, dark };

/** Both values of a paint, or the color alone. */
export const sides = (color: Paint): readonly string[] =>
  typeof color === "string" ? [color] : [color.light, color.dark];

/** Apply `fn` to a color, or to both sides of a paint that has two. */
export const mapPaint = (color: Paint, fn: (color: string) => string): Paint =>
  typeof color === "string" ? fn(color) : paint(fn(color.light), fn(color.dark));

/** The same color with nothing showing. */
export const transparent = (color: string): string => {
  const [r = 0, g = 0, b = 0] = (color.match(/[\d.]+/g) ?? []).map(Number);

  return `rgba(${r},${g},${b},0)`;
};

/** The CSS variable a two-sided paint is drawn with. Its name comes from its two values, so one pair is one variable. */
export const variable = (color: Pair): string => `dom-${hash(`${color.light}|${color.dark}`)}`;

/** The rules that define `used`: light by default, dark when the viewer prefers it. */
export const schemeCss = (used: ReadonlyMap<string, Pair>): string => {
  const names = [...used.keys()].sort();

  if (names.length === 0) return "";

  const decl = (side: "light" | "dark") =>
    names.map((n) => `--${n}:${used.get(n)![side]}`).join(";");

  return `svg{${decl("light")}}@media (prefers-color-scheme:dark){svg{${decl("dark")}}}`;
};

const differ = (where: string): never => {
  throw new Error(
    `snap() laid the dark scheme out differently from the light one at ${where}. Both schemes must have the same elements and text.`,
  );
};

const mergeVector = (light: Vector, dark: Vector): Vector => ({
  ...light,
  attrs: Object.fromEntries(
    Object.entries(light.attrs).map(([k, v]) => [
      k,
      (k === "fill" || k === "stroke") && dark.attrs[k]
        ? paint(v as string, dark.attrs[k] as string)
        : v,
    ]),
  ),
  children: light.children.map((c, i) => mergeVector(c, dark.children[i] ?? differ(light.tag))),
});

const mergeItem = (light: Item, dark: Item): Item => {
  if (light.kind !== dark.kind) return differ(light.kind);

  switch (light.kind) {
    case "text": {
      const d = dark as typeof light;

      if (d.text !== light.text) differ(`"${light.text}"`);

      return { ...light, color: paint(light.color as string, d.color as string) };
    }

    case "graphic": {
      const d = dark as typeof light;

      return {
        ...light,
        children: light.children.map((c, i) => mergeVector(c, d.children[i] ?? differ("svg"))),
      };
    }

    case "image":
      return light;

    case "box":
      return merge(light, dark as Box);
  }
};

/** One box tree whose colors follow the viewer's scheme, from a light and a dark read of the same page. */
export const merge = (light: Box, dark: Box): Box => {
  if (light.children.length !== dark.children.length) differ(`<${light.tag}>`);

  const pick = (l?: Paint, d?: Paint) =>
    l || d
      ? paint((l ?? transparent(d as string)) as string, (d ?? transparent(l as string)) as string)
      : undefined;

  const shadows = Array.from(
    { length: Math.max(light.shadows.length, dark.shadows.length) },
    (_, i) => {
      const l = light.shadows[i];
      const d = dark.shadows[i];
      const base = l ?? d!;

      return { ...base, color: pick(l?.color, d?.color)! };
    },
  );

  return {
    ...light,
    background: pick(light.background, dark.background),
    border:
      light.border || dark.border
        ? {
            widths: (light.border ?? dark.border)!.widths,
            color: pick(light.border?.color, dark.border?.color)!,
          }
        : undefined,
    shadows,
    children: light.children.map((c, i) => mergeItem(c, dark.children[i]!)),
  };
};
