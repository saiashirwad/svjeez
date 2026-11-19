import { treemap, type DiagramOptions, type Treemap, type TreemapNode } from "@svjeez/diagrams";
import type { Span } from "svjeez";
import { clean, fail, sourceOf, type Line } from "./errors.ts";
import type { Place } from "./types.ts";

export interface TreemapNodeDoc {
  readonly label: string;
  /** Set on a leaf; a section's size is the sum of its children. */
  readonly value?: number;
  readonly source: Place;
  readonly children: readonly TreemapNodeDoc[];
}

export interface TreemapDoc {
  readonly kind: "treemap";
  readonly source: Place;
  readonly title?: string;
  readonly roots: readonly TreemapNodeDoc[];
}

const SUPPORTED =
  'Supported: `title Text`, then a hierarchy by indentation: a section is `"Name"` and a leaf is `"Name": 42`, written under its section. `:::class` suffixes and `classDef` lines are accepted and ignored.';

const NODE = /^(?:"([^"]*)"|'([^']*)')(?:\s*[:,]\s*(-?[\d_.,]+))?(?:\s*:::\s*[\w-]+)?$/;

interface Open {
  readonly indent: number;
  readonly label: string;
  readonly value: number | undefined;
  readonly source: Place;
  readonly line: Line;
  readonly children: Open[];
}

const valueOf = (l: Line, text: string): number => {
  const n = Number(text.replace(/[,_]/g, ""));

  if (!Number.isFinite(n))
    return fail(l, `the value ${JSON.stringify(text)} is not a number. Write it as 42 or 4.5.`);

  if (n <= 0)
    return fail(
      l,
      `the value ${text} is not above 0. Leaves are sized by their value, so write more than 0.`,
    );

  return n;
};

const freeze = (n: Open): TreemapNodeDoc => ({
  label: n.label,
  ...(n.value !== undefined && { value: n.value }),
  source: n.source,
  children: n.children.map(freeze),
});

const check = (n: Open): void => {
  if (n.value === undefined && n.children.length === 0)
    fail(
      n.line,
      'this section holds nothing. Indent leaves such as `"Leaf": 10` under it, or give it a value.',
    );

  for (const c of n.children) check(c);
};

export const parseTreemap = (header: Line, body: readonly Line[]): TreemapDoc => {
  if (header.text !== "treemap-beta" && header.text !== "treemap")
    return fail(header, "write just `treemap-beta` on the first line.");
  let title: string | undefined;
  const roots: Open[] = [];
  const stack: Open[] = [];

  for (const l of body) {
    const t = /^title\s+(.+)$/.exec(l.text);

    if (t) {
      title = clean(t[1]!);
      continue;
    }

    if (/^classDef\b/.test(l.text)) continue;

    if (/^(accTitle|accDescr)\b/.test(l.text))
      return fail(l, "accessibility lines are not supported: svjeez draws the title and nodes.");
    const m = NODE.exec(l.text);

    if (!m) return fail(l, `cannot read this line as a node. ${SUPPORTED}`);
    const label = clean(m[1] ?? m[2] ?? "");

    if (label === "") return fail(l, "a node needs a label inside its quotes.");
    const indent = l.indent ?? 0;

    const node: Open = {
      indent,
      label,
      value: m[3] === undefined ? undefined : valueOf(l, m[3]),
      source: sourceOf(l),
      line: l,
      children: [],
    };

    while (stack.length > 0 && stack.at(-1)!.indent >= indent) stack.pop();
    const parent = stack.at(-1);

    if (parent?.value !== undefined)
      return fail(
        l,
        `${JSON.stringify(parent.label)} has a value, so it is a leaf and cannot hold this line. Drop its value to make it a section.`,
      );

    if (parent) parent.children.push(node);
    else roots.push(node);
    stack.push(node);
  }

  if (roots.length === 0)
    return fail(
      header,
      'the treemap has no nodes. Add lines such as `"Group"` and `  "Leaf": 10`.',
    );

  for (const r of roots) check(r);

  return {
    kind: "treemap",
    source: sourceOf(header),
    ...(title !== undefined && { title }),
    roots: roots.map(freeze),
  };
};

export const drawTreemap = (
  doc: TreemapDoc,
  options: DiagramOptions & { readonly reveal?: Span },
): Treemap<string> => {
  const nodes: [string, TreemapNode][] = [];

  const walk = (n: TreemapNodeDoc, parent?: string): void => {
    const id = `node-${nodes.length + 1}`;

    nodes.push([
      id,
      {
        label: n.label,
        ...(n.value !== undefined && { value: n.value }),
        ...(parent !== undefined && { parent }),
      },
    ]);

    for (const c of n.children) walk(c, id);
  };

  for (const r of doc.roots) walk(r);

  return treemap(
    { ...(doc.title !== undefined && { title: doc.title }), nodes: Object.fromEntries(nodes) },
    options,
  );
};
