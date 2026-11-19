import { mindmap, type DiagramOptions, type Mindmap, type MindNode } from "@svjeez/diagrams";
import type { Span } from "svjeez";
import { clean, fail, sourceOf, unquote, type Line } from "./errors.ts";
import type { Place } from "./types.ts";

export type MindmapShape = "default" | "rect" | "round" | "circle" | "cloud" | "bang" | "hex";

export interface MindmapNodeDoc {
  readonly label: string;
  readonly shape: MindmapShape;
  readonly source: Place;
  readonly children: readonly MindmapNodeDoc[];
}

export interface MindmapDoc {
  readonly kind: "mindmap";
  readonly source: Place;
  readonly root: MindmapNodeDoc;
}

const SUPPORTED =
  'Supported: one root, then children indented under their parent; a node is plain text or `id[text]` `id(text)` `id((text))` `id))text((` `id)text(` `id{{text}}`, markdown strings such as "`**bold**`" (shown as plain text), and `::icon(...)` and `:::class` lines (accepted and not drawn).';

const SHAPES: readonly (readonly [RegExp, MindmapShape])[] = [
  [/^([^\s()[\]{}]*)\(\((.*)\)\)$/, "circle"],
  [/^([^\s()[\]{}]*)\)\)(.*)\(\($/, "bang"],
  [/^([^\s()[\]{}]*)\{\{(.*)\}\}$/, "hex"],
  [/^([^\s()[\]{}]*)\[(.*)\]$/, "rect"],
  [/^([^\s()[\]{}]*)\((.*)\)$/, "round"],
  [/^([^\s()[\]{}]*)\)(.*)\($/, "cloud"],
];

interface Open {
  readonly indent: number;
  readonly children: Open[];
  readonly label: string;
  readonly shape: MindmapShape;
  readonly source: Place;
}

const read = (l: Line) => {
  const shaped = SHAPES.flatMap(([pattern, shape]) => {
    const m = pattern.exec(l.text);

    return m ? [{ text: m[2]!, shape }] : [];
  })[0];

  const text = unquote((shaped?.text ?? l.text).trim());
  const markdown = /^`[^`]*`$/.test(text);

  const label = clean(
    markdown ? text.slice(1, -1).replace(/(\*\*|__)(.+?)\1|\*(\S[^*]*)\*/g, "$2$3") : text,
  );

  if (label === "") return fail(l, `a node needs some text. ${SUPPORTED}`);

  return { label, shape: shaped?.shape ?? "default" };
};

const freeze = (n: Open): MindmapNodeDoc => ({
  label: n.label,
  shape: n.shape,
  source: n.source,
  children: n.children.map(freeze),
});

export const parseMindmap = (header: Line, body: readonly Line[]): MindmapDoc => {
  if (header.text !== "mindmap") return fail(header, "write just `mindmap` on the first line.");

  if (body.length === 0)
    return fail(header, "the mindmap has no root. Add the centre idea on the next line.");
  const stack: Open[] = [];
  let root: Open | undefined;

  for (const l of body) {
    // Icons and style classes decorate the node above, and svjeez draws neither.
    if (/^::(icon\(.*\)|:\S.*)$/.test(l.text)) {
      if (root === undefined)
        return fail(l, "an icon or class belongs under a node, not before the root.");
      continue;
    }

    const indent = l.indent ?? 0;

    const { label, shape } = read({
      ...l,
      text: l.text.replace(/:::[\w-]+(?:\s+[\w-]+)*\s*$/, "").trimEnd(),
    });

    const node: Open = { indent, children: [], label, shape, source: sourceOf(l) };

    if (root === undefined) {
      root = node;
      stack.push(node);
      continue;
    }

    while (stack.length > 0 && stack.at(-1)!.indent >= indent) stack.pop();
    const parent = stack.at(-1);

    if (!parent)
      return fail(
        l,
        `there can be only one root, and ${JSON.stringify(root.label)} is it. Indent this line under a node.`,
      );
    parent.children.push(node);
    stack.push(node);
  }

  return { kind: "mindmap", source: sourceOf(header), root: freeze(root!) };
};

export const drawMindmap = (
  doc: MindmapDoc,
  options: DiagramOptions & { readonly reveal?: Span },
): Mindmap<string> => {
  const nodes: [string, MindNode][] = [];

  const walk = (n: MindmapNodeDoc, parent?: string) => {
    const id = `node-${nodes.length + 1}`;
    nodes.push([id, { label: n.label, shape: n.shape, ...(parent !== undefined && { parent }) }]);

    for (const c of n.children) walk(c, id);
  };

  walk(doc.root);

  return mindmap({ nodes: Object.fromEntries(nodes) }, options);
};
