import type { Box, Item, Vector } from "./tree.ts";

/**
 * Colors that differ between the light and dark scheme become CSS variables. A variable's name comes from its two
 * values, so the same pair always gets the same name and two snapshots can share one.
 */
const pairs = new Map<string, { readonly light: string; readonly dark: string }>();

const hash = (text: string): string => {
  let h = 0x811c9dc5;

  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);

  return (h >>> 0).toString(36);
};

const nameOf = (color: string): string | undefined => /^var\(--(dom-[a-z0-9]+)\)$/.exec(color)?.[1];

/** One color for both schemes: the color itself when they agree, else a variable. */
export const adaptive = (light: string, dark: string): string => {
  if (light === dark) return light;
  const name = `dom-${hash(`${light}|${dark}`)}`;
  pairs.set(name, { light, dark });

  return `var(--${name})`;
};

/** Apply `fn` to a color, or to both sides of an adaptive one. */
export const mapColor = (color: string, fn: (color: string) => string): string => {
  const name = nameOf(color);
  const pair = name === undefined ? undefined : pairs.get(name);

  return pair ? adaptive(fn(pair.light), fn(pair.dark)) : fn(color);
};

/** Both values of an adaptive color, or the color alone. */
export const sides = (color: string): readonly string[] => {
  const name = nameOf(color);
  const pair = name === undefined ? undefined : pairs.get(name);

  return pair ? [pair.light, pair.dark] : [color];
};

/** The rules that define the variables `used`: light by default, dark when the viewer prefers it. */
export const schemeCss = (used: Iterable<string>): string => {
  const names = [
    ...new Set([...used].map(nameOf).filter((n): n is string => n !== undefined)),
  ].sort();

  if (names.length === 0) return "";

  const decl = (side: "light" | "dark") =>
    names.map((n) => `--${n}:${pairs.get(n)![side]}`).join(";");

  return `svg{${decl("light")}}@media (prefers-color-scheme:dark){svg{${decl("dark")}}}`;
};

const differ = (where: string): never => {
  throw new Error(
    `snapshot() laid the dark scheme out differently from the light one at ${where}. Both schemes must have the same elements and text.`,
  );
};

const mergeVector = (light: Vector, dark: Vector): Vector => ({
  ...light,
  attrs: Object.fromEntries(
    Object.entries(light.attrs).map(([k, v]) => [
      k,
      (k === "fill" || k === "stroke") && dark.attrs[k] ? adaptive(v, dark.attrs[k]) : v,
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

      return { ...light, color: adaptive(light.color, d.color) };
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

/** One box tree whose colors follow the viewer's scheme, from a light and a dark snapshot of the same markup. */
export const merge = (light: Box, dark: Box): Box => {
  if (light.children.length !== dark.children.length) differ(`<${light.tag}>`);

  const clear = (c: string) =>
    c.replace(/rgba?\(([^,]+),([^,]+),([^,)]+)(,[^)]*)?\)/, "rgba($1,$2,$3,0)");

  const pick = (l?: string, d?: string) =>
    l || d ? adaptive(l ?? clear(d!), d ?? clear(l!)) : undefined;

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
