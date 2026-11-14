import { isPair, paint, transparent } from "./paint.ts";
import type { Box, Gradient, Item, Paint, Shadow, Vector } from "./tree.ts";

/** The two passes read different pages: an app still changing, or a scheme that changes the markup. */
export class Differ extends Error {}

const differ = (where: string): never => {
  throw new Differ(
    `snap() laid the dark scheme out differently from the light one at ${where}. Both schemes must have the same elements and text.`,
  );
};

/** The color one pass read. A single pass never pairs, so this is the color itself. */
const plain = <C extends string>(color: Paint<C>): C => (isPair(color) ? color.light : color);

/** Both passes' color, where one may lack it: the missing side is the other's, clear. */
const pick = (light?: Paint, dark?: Paint): Paint | undefined =>
  light || dark
    ? paint(plain(light ?? transparent(plain(dark!))), plain(dark ?? transparent(plain(light!))))
    : undefined;

const mergeVector = (light: Vector, dark: Vector): Vector => ({
  ...light,
  attrs: Object.fromEntries(
    Object.entries(light.attrs).map(([k, v]) => {
      const other = dark.attrs[k];

      return [k, (k === "fill" || k === "stroke") && other ? paint(plain(v), plain(other)) : v];
    }),
  ),
  children: light.children.map((c, i) => mergeVector(c, dark.children[i] ?? differ(light.tag))),
});

const mergeItem = (light: Item, dark: Item): Item => {
  if (light.kind === "text" && dark.kind === "text") {
    if (dark.text !== light.text) differ(`"${light.text}"`);

    return { ...light, color: paint(plain(light.color), plain(dark.color)) };
  }

  if (light.kind === "graphic" && dark.kind === "graphic")
    return {
      ...light,
      children: light.children.map((c, i) => mergeVector(c, dark.children[i] ?? differ("svg"))),
    };

  if (light.kind === "image" && dark.kind === "image") return light;

  if (light.kind === "box" && dark.kind === "box") return merge(light, dark);

  return differ(light.kind);
};

const mergeShadows = (light: readonly Shadow[], dark: readonly Shadow[]): Shadow[] =>
  Array.from({ length: Math.max(light.length, dark.length) }, (_, i) => ({
    ...(light[i] ?? dark[i]!),
    color: pick(light[i]?.color, dark[i]?.color)!,
  }));

/**
 * A layer one scheme lacks is there but clear in it, as a fill is. Where the stops differ in number, light's shape
 * holds and each scheme keeps its own colors by position.
 */
const mergeGradients = (light: readonly Gradient[], dark: readonly Gradient[]): Gradient[] =>
  Array.from({ length: Math.max(light.length, dark.length) }, (_, i) => {
    const own = (light[i] ?? dark[i])!;
    const other = light[i] ? dark[i] : light[i];

    return {
      ...own,
      stops: own.stops.map((stop, k) => {
        const c = plain(stop.color);
        const o = other?.stops[Math.min(k, other.stops.length - 1)]?.color;
        const theirs = o && plain(o);

        return { ...stop, color: light[i] ? pick(c, theirs)! : pick(theirs, c)! };
      }),
    };
  });

/** One box tree whose colors follow the viewer's scheme, from a light and a dark read of the same page. */
export const merge = (light: Box, dark: Box): Box => {
  if (light.children.length !== dark.children.length) differ(`<${light.tag}>`);

  const insets = mergeShadows(light.insets ?? [], dark.insets ?? []);
  const gradients = mergeGradients(light.gradients ?? [], dark.gradients ?? []);

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
    shadows: mergeShadows(light.shadows, dark.shadows),
    gradients: gradients.length > 0 ? gradients : undefined,
    insets: insets.length > 0 ? insets : undefined,
    children: light.children.map((c, i) => mergeItem(c, dark.children[i]!)),
  };
};
