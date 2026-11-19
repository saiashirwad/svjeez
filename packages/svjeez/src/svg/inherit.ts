import type { Element, SvgNode } from "./tree";

/**
 * A value that several children of a group repeat moves to the group, which they inherit it from. Nothing the author
 * writes asks for it, and nothing but size changes: a child only loses an attribute when the group gives it the same
 * value, and a group only takes one when no child would start to inherit something it did not have.
 */

const INHERITED = [
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "fill",
  "stroke",
  "stroke-width",
  "stroke-linecap",
  "stroke-linejoin",
] as const;

const FONT: ReadonlySet<string> = new Set(INHERITED.slice(0, 4));

const SHAPES: ReadonlySet<string> = new Set([
  "path",
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
]);

/** Elements that draw nothing of their own and take nothing from a group. */
const INERT: ReadonlySet<string> = new Set([
  "animate",
  "set",
  "animateTransform",
  "animateMotion",
  "mpath",
  "title",
  "desc",
  "style",
  "stop",
]);

const isInert = (node: Element): boolean => INERT.has(node.tag) || node.tag.startsWith("fe");

const isElement = (node: SvgNode): node is Element => node.kind === "element";

const drawnBy = (node: Element): Element[] =>
  node.children.filter(isElement).filter((child) => !isInert(child));

const covered = (node: Element, name: string): boolean => {
  if (node.attrs[name] !== undefined || node.tag === "image") return true;

  if (FONT.has(name) && SHAPES.has(node.tag)) return true;

  return node.tag === "g" && drawnBy(node).every((child) => covered(child, name));
};

/** For each @keyframes, what it sets; and for each class, the properties its animations move. */
const animatedBy = (css: string): ReadonlyMap<string, ReadonlySet<string>> => {
  const frames = new Map<string, Set<string>>();

  for (const [, name, body] of css.matchAll(/@keyframes ([\w-]+)\{((?:[^{}]*\{[^}]*\})*)\}/g)) {
    const set = new Set<string>();

    for (const [, property] of body!.matchAll(/(?:^|[{;])\s*([a-z-]+)\s*:/g)) set.add(property!);
    frames.set(name!, set);
  }

  const classes = new Map<string, Set<string>>();

  for (const [, name, list] of css.matchAll(/\.([\w-]+)\{animation-name:([^;}]*)/g)) {
    const set = new Set<string>();

    for (const frame of list!.split(","))
      for (const property of frames.get(frame.trim()) ?? []) set.add(property);
    classes.set(name!, set);
  }

  return classes;
};

export const inherit = (
  body: readonly SvgNode[],
  css: string,
  prefix: string,
): readonly SvgNode[] => {
  const classes = animatedBy(css);
  const plain = new Set(["a", "fb", "dm", "ds"].map((name) => prefix + name));

  /** Whether a group's own value for this attribute can change after it is written, or comes from somewhere else. */
  const moves = (node: Element, name: string): boolean => {
    const style = String(node.attrs.style ?? "");

    if (new RegExp(`(?:^|;)\\s*${name}\\s*:`).test(style)) return true;

    if (
      node.children.some(
        (child) => isElement(child) && INERT.has(child.tag) && child.attrs.attributeName === name,
      )
    )
      return true;

    return String(node.attrs.class ?? "")
      .split(/\s+/)
      .filter(Boolean)
      .some((each) =>
        plain.has(each) ? false : !(classes.get(each) && !classes.get(each)!.has(name)),
      );
  };

  const grouped = (node: Element): Element => {
    const drawn = drawnBy(node);

    if (node.tag !== "g" || drawn.length < 2) return node;
    const attrs = { ...node.attrs };
    const dropped = new Map<Element, Set<string>>();

    for (const name of INHERITED) {
      if (moves(node, name)) continue;
      let value = attrs[name] === undefined ? undefined : String(attrs[name]);

      if (value === undefined) {
        if (!drawn.every((child) => covered(child, name))) continue;
        const counts = new Map<string, number>();

        for (const child of drawn)
          if (child.attrs[name] !== undefined)
            counts.set(String(child.attrs[name]), (counts.get(String(child.attrs[name])) ?? 0) + 1);

        const [best] = [...counts].reduce<[string, number] | undefined>(
          (top, entry) => (top === undefined || entry[1] > top[1] ? entry : top),
          undefined,
        ) ?? [undefined];

        if (best === undefined || counts.get(best)! < 2) continue;
        value = best;
        attrs[name] = value;
      }

      for (const child of drawn)
        if (child.attrs[name] !== undefined && String(child.attrs[name]) === value)
          dropped.set(child, (dropped.get(child) ?? new Set()).add(name));
    }

    return {
      ...node,
      attrs,
      children: node.children.map((child) => {
        const names = isElement(child) ? dropped.get(child) : undefined;

        if (!names || !isElement(child)) return child;

        return {
          ...child,
          attrs: Object.fromEntries(Object.entries(child.attrs).filter(([key]) => !names.has(key))),
        };
      }),
    };
  };

  const visit = (node: SvgNode): SvgNode => {
    if (node.kind === "fragment") return { ...node, children: node.children.map(visit) };

    if (node.kind !== "element") return node;

    return grouped({ ...node, children: node.children.map(visit) });
  };

  return body.map(visit);
};
