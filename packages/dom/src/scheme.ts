import { isPair, paint, transparent } from "./paint.ts";
import type { Box, Gradient, Item, Paint, Shadow, Vector } from "./tree.ts";

type Differ = (where: string) => void;

const plain = <C extends string>(color: Paint<C>): C => (isPair(color) ? color.light : color);

const pick = (light?: Paint, dark?: Paint): Paint | undefined =>
  light || dark
    ? paint(plain(light ?? transparent(plain(dark!))), plain(dark ?? transparent(plain(light!))))
    : undefined;

const keep = <T>(light: T, where: string, differ: Differ): T => {
  differ(where);

  return light;
};

const mergeVector = (light: Vector, dark: Vector, differ: Differ): Vector =>
  light.tag !== dark.tag || light.children.length !== dark.children.length
    ? keep(light, light.tag, differ)
    : {
        ...light,
        attrs: Object.fromEntries(
          Object.entries(light.attrs).map(([k, v]) => {
            const other = dark.attrs[k];

            return [
              k,
              (k === "fill" || k === "stroke") && other ? paint(plain(v), plain(other)) : v,
            ];
          }),
        ),
        children: light.children.map((c, i) => mergeVector(c, dark.children[i]!, differ)),
      };

const mergeItem = (light: Item, dark: Item, differ: Differ): Item => {
  if (light.kind === "text" && dark.kind === "text") {
    if (dark.text !== light.text) return keep(light, `"${light.text}"`, differ);

    return { ...light, color: paint(plain(light.color), plain(dark.color)) };
  }

  if (light.kind === "graphic" && dark.kind === "graphic") {
    if (light.children.length !== dark.children.length) return keep(light, "svg", differ);

    return {
      ...light,
      children: light.children.map((c, i) => mergeVector(c, dark.children[i]!, differ)),
    };
  }

  if (light.kind === "image" && dark.kind === "image") return light;

  if (light.kind === "box" && dark.kind === "box") return merge(light, dark, differ);

  return keep(light, light.kind, differ);
};

const mergeShadows = (light: readonly Shadow[], dark: readonly Shadow[]): Shadow[] =>
  Array.from({ length: Math.max(light.length, dark.length) }, (_, i) => ({
    ...(light[i] ?? dark[i]!),
    color: pick(light[i]?.color, dark[i]?.color)!,
  }));

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

export const merge = (light: Box, dark: Box, differ: Differ): Box => {
  const same = light.children.length === dark.children.length;

  if (!same) differ(`<${light.tag}>`);

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
    outline:
      light.outline || dark.outline
        ? {
            width: (light.outline ?? dark.outline)!.width,
            offset: (light.outline ?? dark.outline)!.offset,
            color: pick(light.outline?.color, dark.outline?.color)!,
          }
        : undefined,
    darkOpacity: dark.opacity !== light.opacity ? dark.opacity : undefined,
    shadows: mergeShadows(light.shadows, dark.shadows),
    gradients: gradients.length > 0 ? gradients : undefined,
    insets: insets.length > 0 ? insets : undefined,
    children: same
      ? light.children.map((c, i) => mergeItem(c, dark.children[i]!, differ))
      : light.children,
  };
};
