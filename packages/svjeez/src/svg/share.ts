import { element, inline, type AttrValue, type Element, type SvgNode } from "./tree";

/**
 * A drawing that appears more than once is written once and copied: the same still markup, wherever it sits, becomes
 * one entry in <defs> and a <use> at each place. Nothing the author writes asks for it, and nothing but size changes.
 */

const DRAWN: ReadonlySet<string> = new Set([
  "g",
  "path",
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "image",
  "text",
]);

/** A drawing that moves is left where it is: only what holds still is shared. */
const MOVES = /\sclass="|<animate|<set[\s/>]/;

/** Elements in a node, counting the node: the page weighs what the browser has to build as well as bytes. */
const elementsIn = (node: SvgNode): number =>
  node.kind === "fragment"
    ? node.children.reduce((sum, child) => sum + elementsIn(child), 0)
    : node.kind === "element"
      ? 1 + node.children.reduce((sum, child) => sum + elementsIn(child), 0)
      : 0;

/** Bytes a copy has to save for each element it adds. */
const PER_ELEMENT = 1000;

/** Bytes a drawing has to save before a copy is worth a <use> and an entry in <defs>. */
const WORTH = 64;

interface Shared {
  readonly key: string;
  /** The element a copy becomes: its own placing, and a link to the shared drawing. */
  readonly copy: (id: string) => Element;
  /** The shared drawing, with whatever is copied inside it copied too. */
  readonly drawing: (id: string, within: (node: SvgNode) => SvgNode) => Element;
}

const sharedOf = (node: Element): Shared | undefined => {
  if (!DRAWN.has(node.tag)) return undefined;

  if (node.tag === "g") {
    if (node.children.length === 0) return undefined;

    return {
      key: `g ${node.children.map((child) => inline(child)).join("")}`,
      copy: (id) => element("use", { ...node.attrs, href: `#${id}` }),
      drawing: (id, within) => element("g", { id }, node.children.map(within)),
    };
  }

  const { drawn } = node;

  // A stroked drawing that moves is rasterised differently as a <use>, so it keeps its place.
  if (node.attrs.class !== undefined && node.attrs["stroke-width"] !== undefined) return undefined;

  if (!drawn && ["id", "class", "style"].some((name) => node.attrs[name] !== undefined))
    return undefined;
  const own: Record<string, AttrValue> = {};
  const kept: Record<string, AttrValue> = {};

  for (const [name, value] of Object.entries(node.attrs)) {
    if (name === "transform") own[name] = value;
    else if (drawn && !drawn.includes(name)) own[name] = value;
    else kept[name] = value;
  }

  const bare = element(node.tag, kept, node.children);

  return {
    key: inline(bare),
    copy: (id) => element("use", { href: `#${id}`, ...own }),
    drawing: (id) => element(node.tag, { id, ...kept }, node.children),
  };
};

const OPAQUE: ReadonlySet<string> = new Set([
  "defs",
  "style",
  "title",
  "desc",
  "text",
  "clipPath",
  "mask",
  "pattern",
  "filter",
]);

export const share = (body: readonly SvgNode[], prefix: string): readonly SvgNode[] => {
  const found = new Map<string, { count: number; first: Element; shared: Shared }>();

  const count = (node: SvgNode): void => {
    if (node.kind === "fragment") return node.children.forEach(count);

    if (node.kind !== "element" || node.tag === "defs") return;
    const shared = sharedOf(node);

    if (shared && !MOVES.test(shared.key)) {
      const known = found.get(shared.key);

      if (known) {
        known.count += 1;

        return;
      }

      found.set(shared.key, { count: 1, first: node, shared });
    }

    if (!OPAQUE.has(node.tag)) node.children.forEach(count);
  };

  body.forEach(count);

  const ids = new Map<string, string>();
  const drawings: Element[] = [];

  const worths = new Map<string, boolean>();

  const worth = (key: string): boolean => {
    const known = worths.get(key);

    if (known !== undefined) return known;
    const made = weighed(key);

    worths.set(key, made);

    return made;
  };

  const weighed = (key: string): boolean => {
    const entry = found.get(key);

    if (!entry || entry.count < 2) return false;
    const id = `${prefix}u${found.size}`;
    const saved = inline(entry.first).length - inline(entry.shared.copy(id)).length;
    const cost = inline(entry.shared.drawing(id, (node) => node)).length;

    // The shared drawing, its copies and the <defs> that holds it normally come to fewer elements than the copies they replace.
    const before = elementsIn(entry.first) * entry.count;
    const after = elementsIn(entry.shared.drawing(id, (node) => node)) + entry.count + 1;

    const net = saved * entry.count - cost;

    return net >= WORTH && (after < before || net >= PER_ELEMENT * (after - before));
  };

  const copied = (node: SvgNode): SvgNode => {
    if (node.kind === "fragment") return { ...node, children: node.children.map(copied) };

    if (node.kind !== "element" || node.tag === "defs") return node;
    const shared = sharedOf(node);

    if (shared && worth(shared.key)) {
      const known = ids.get(shared.key);
      const id = known ?? `${prefix}u${ids.size + 1}`;

      if (known === undefined) {
        ids.set(shared.key, id);
        drawings.push(shared.drawing(id, copied));
      }

      return shared.copy(id);
    }

    return OPAQUE.has(node.tag) ? node : { ...node, children: node.children.map(copied) };
  };

  const out = body.map(copied);

  if (drawings.length === 0) return body;
  const at = out.findIndex((node) => node.kind === "element" && node.tag === "defs");

  if (at < 0) return [element("defs", {}, drawings), ...out];

  return out.map((node, index) =>
    index === at && node.kind === "element"
      ? { ...node, children: [...drawings, ...node.children] }
      : node,
  );
};
