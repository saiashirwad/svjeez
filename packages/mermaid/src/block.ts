import {
  blockDiagram,
  type BlockDiagram,
  type BlockItem,
  type DiagramOptions,
} from "@svjeez/diagrams";
import type { Span } from "svjeez";
import { clean, fail, sourceOf, unquote, type Line } from "./errors.ts";
import type { Place } from "./types.ts";

export type BlockShapeDoc =
  | "rect"
  | "round"
  | "stadium"
  | "diamond"
  | "circle"
  | "subroutine"
  | "cylinder"
  | "arrow-right"
  | "arrow-left"
  | "arrow-up"
  | "arrow-down"
  | "arrow-x"
  | "arrow-y";

export interface BlockNodeDoc {
  readonly kind: "node";
  readonly id: string;
  readonly label: string;
  readonly shape: BlockShapeDoc;
  readonly span: number;
}

export interface BlockSpaceDoc {
  readonly kind: "space";
  readonly span: number;
}

export interface BlockGroupDoc {
  readonly kind: "group";
  readonly id: string;
  readonly span: number;
  readonly columns?: number;
  readonly items: readonly BlockItemDoc[];
}

export type BlockItemDoc = BlockNodeDoc | BlockSpaceDoc | BlockGroupDoc;

export interface BlockEdgeDoc {
  readonly from: string;
  readonly to: string;
  readonly label?: string;
  readonly line: "solid" | "dotted" | "thick";
  readonly arrow: boolean;
}

export interface BlockDoc {
  readonly kind: "block";
  readonly source: Place;
  readonly columns?: number;
  readonly items: readonly BlockItemDoc[];
  readonly edges: readonly BlockEdgeDoc[];
}

const SUPPORTED =
  'Supported: `columns N`, blocks `a` `a["text"]` `a("text")` `a(["text"])` `a{"text"}` `a(("text"))` `a[["text"]]` `a[("text")]` with a width `a:2`, block arrows `a<["text"]>(right)`, `space` or `space:N`, `block` ... `end` or `block:id:2` ... `end`, and edges `a --> b`, `a --- b`, `a ==> b`, `a -.-> b` or `a -- "text" --> b`.';

const OPENERS: readonly (readonly [open: string, close: string, shape: BlockShapeDoc])[] = [
  ["[[", "]]", "subroutine"],
  ["[(", ")]", "cylinder"],
  ["((", "))", "circle"],
  ["([", "])", "stadium"],
  ["[", "]", "rect"],
  ["(", ")", "round"],
  ["{", "}", "diamond"],
];

const UNSUPPORTED_SHAPES = ["(((", "{{", "[/", "[\\", ">"];
const UNSUPPORTED = /^(classDef|class|style|linkStyle|accTitle|accDescr|title)\b/;
const LABELLED = /^(?:--|-\.|==)\s+(.+?)\s+(-{2,}>|-{3,}|\.+->|\.+-|={2,}>|={3,})/;
const PLAIN = /^(-{2,}>|-{3,}|-\.+->|-\.+-|={2,}>|={3,})/;

const ARROWS = new Map<string, BlockShapeDoc>([
  ["right", "arrow-right"],
  ["left", "arrow-left"],
  ["up", "arrow-up"],
  ["down", "arrow-down"],
  ["x", "arrow-x"],
  ["y", "arrow-y"],
]);

type Draft<T> = { -readonly [K in keyof T]: T[K] };

interface Ref {
  readonly id: string;
  readonly shape?: BlockShapeDoc;
  readonly label?: string;
  readonly span: number;
}

const readRef = (l: Line, s: string): [Ref, string] => {
  const id = /^\w+/.exec(s)?.[0];

  if (!id)
    return fail(l, `expected a block id, found ${JSON.stringify(s.slice(0, 12))}. ${SUPPORTED}`);
  let rest = s.slice(id.length);
  let shape: BlockShapeDoc | undefined;
  let label: string | undefined;

  const text = (open: string, close: string, body: string): [string, string] => {
    const trimmed = body.trimStart();

    if (trimmed.startsWith('"')) {
      const end = trimmed.indexOf('"', 1);
      const tail = end < 0 ? "" : trimmed.slice(end + 1).trimStart();

      if (!tail.startsWith(close))
        return fail(l, `block ${id} has a quoted label that is not closed by ${close}.`);

      return [trimmed.slice(1, end), tail.slice(close.length)];
    }

    const end = trimmed.indexOf(close);

    if (end < 0)
      return fail(
        l,
        `block ${id} opens with ${open} but never closes with ${close}. Quote a label that contains ${close}.`,
      );

    return [trimmed.slice(0, end), trimmed.slice(end + close.length)];
  };

  if (rest.startsWith("<[")) {
    const [raw, after] = text("<[", "]>", rest.slice(2));
    const named = /^\(([^)]*)\)/.exec(after);

    if (!named)
      return fail(l, `block arrow ${id} needs a direction, as in ${id}<["text"]>(right).`);
    const dirs = named[1]!.split(",").map((d) => d.trim());

    if (!dirs.every((d) => ARROWS.has(d)))
      return fail(l, `block arrow ${id} points ${named[1]}. Use right, left, up, down, x or y.`);

    if (dirs.length !== 1)
      return fail(
        l,
        `block arrow ${id} points two ways. svjeez draws one arrow per block: use x for both left and right, y for both up and down.`,
      );
    shape = ARROWS.get(dirs[0]!);
    label = clean(raw);
    rest = after.slice(named[0].length);
  } else if (UNSUPPORTED_SHAPES.some((u) => rest.startsWith(u))) {
    return fail(
      l,
      `the shape after ${id} is not supported. svjeez draws [text] (text) ([text]) {text} ((text)) [[text]] [(text)] and block arrows.`,
    );
  } else {
    const opener = OPENERS.find(([open]) => rest.startsWith(open));

    if (opener) {
      const [open, close, kind] = opener;
      const [raw, after] = text(open, close, rest.slice(open.length));
      shape = kind;
      label = clean(raw);
      rest = after;

      if (label === "") return fail(l, `block ${id} has an empty label.`);
    }
  }

  const width = /^:(\d+)/.exec(rest);

  if (width) rest = rest.slice(width[0].length);
  const span = width ? Number(width[1]) : 1;

  if (span < 1) return fail(l, `block ${id} is ${span} columns wide. Write a width of 1 or more.`);

  return [{ id, shape, label, span }, rest];
};

export const parseBlock = (header: Line, body: readonly Line[]): BlockDoc => {
  if (!/^block(?:-beta)?$/.test(header.text))
    return fail(header, `cannot read the block header. Write \`block-beta\`. ${SUPPORTED}`);

  const root: Draft<BlockDoc> = {
    kind: "block",
    source: sourceOf(header),
    items: [],
    edges: [],
  };

  const edges: BlockEdgeDoc[] = [];
  const placed = new Map<string, Draft<BlockNodeDoc> | Draft<BlockGroupDoc>>();

  const stack: { items: BlockItemDoc[]; group?: Draft<BlockGroupDoc>; line?: Line }[] = [
    { items: [] },
  ];

  let anonymous = 0;

  const here = () => stack.at(-1)!;

  const touch = (l: Line, ref: Ref): void => {
    const known = placed.get(ref.id);

    if (!known) {
      const node: Draft<BlockNodeDoc> = {
        kind: "node",
        id: ref.id,
        label: ref.label ?? ref.id,
        shape: ref.shape ?? "rect",
        span: ref.span,
      };

      placed.set(ref.id, node);
      here().items.push(node);

      return;
    }

    if (ref.shape === undefined) return;

    if (known.kind === "group")
      return fail(l, `${ref.id} names a block group, which cannot take a shape or label.`);
    known.shape = ref.shape;
    known.label = ref.label ?? known.label;
  };

  for (const l of body) {
    const word = UNSUPPORTED.exec(l.text)?.[1];

    if (word)
      return fail(
        l,
        `${word} is not supported: svjeez themes and positions diagrams itself. ${SUPPORTED}`,
      );

    const columns = /^columns\s+(\S+)$/.exec(l.text);

    if (columns) {
      const n = columns[1] === "auto" ? undefined : Number(columns[1]);

      if (n !== undefined && !(Number.isInteger(n) && n >= 1))
        return fail(l, "columns needs a whole number of 1 or more, or `auto`.");
      const target = here().group ?? root;
      target.columns = n;
      continue;
    }

    const open = /^block(?::(\w+))?(?::(\d+))?$/.exec(l.text);

    if (open) {
      const id = open[1] ?? `group-${++anonymous}`;

      if (placed.has(id)) return fail(l, `the id ${id} is already used. Give each block its own.`);
      const items: BlockItemDoc[] = [];

      const group: Draft<BlockGroupDoc> = {
        kind: "group",
        id,
        span: open[2] === undefined ? 1 : Number(open[2]),
        items,
      };

      placed.set(id, group);
      here().items.push(group);
      stack.push({ items, group, line: l });
      continue;
    }

    if (l.text === "end") {
      if (stack.length === 1) return fail(l, "`end` closes a block, and none is open.");
      const closed = stack.pop()!;

      if (closed.items.length === 0)
        return fail(l, "this block group is empty. Put a block in it, or leave it out.");
      continue;
    }

    let rest = l.text;
    let last: Ref | undefined;

    while (rest !== "") {
      const space = /^space(?::(\d+))?(?=\s|$)/.exec(rest);

      if (space) {
        const span = space[1] === undefined ? 1 : Number(space[1]);

        if (span < 1) return fail(l, "space needs a width of 1 or more.");
        here().items.push({ kind: "space", span });
        rest = rest.slice(space[0].length).trimStart();
        last = undefined;
        continue;
      }

      const labelled = last ? LABELLED.exec(rest) : null;
      const plain = last && !labelled ? PLAIN.exec(rest) : null;

      if (last && (labelled || plain)) {
        const match = (labelled ?? plain)!;
        const token = labelled ? match[2]! : match[0];
        const after = rest.slice(match[0].length).trimStart();

        if (after === "") return fail(l, "an edge needs a block after it.");
        const [next, afterNext] = readRef(l, after);
        touch(l, next);

        if (next.id === last.id)
          return fail(l, `${last.id} points back to itself. Edges join two different blocks.`);
        edges.push({
          from: last.id,
          to: next.id,
          ...(labelled && { label: clean(unquote(match[1]!)) }),
          line: token.includes(".") ? "dotted" : token.startsWith("=") ? "thick" : "solid",
          arrow: token.endsWith(">"),
        });
        last = next;
        rest = afterNext.trimStart();
        continue;
      }

      const [ref, after] = readRef(l, rest);
      touch(l, ref);
      last = ref;
      rest = after.trimStart();
    }
  }

  if (stack.length > 1)
    return fail(stack.at(-1)!.line!, "this block is never closed. Add `end` after its cells.");

  for (const e of edges)
    if (!placed.has(e.from) || !placed.has(e.to))
      return fail(header, "an edge names a block that does not exist.");

  if (!placed.size) return fail(header, "the block diagram has no blocks.");

  root.items = stack[0]!.items;
  root.edges = edges;

  return root;
};

const itemOf = (item: BlockItemDoc): BlockItem => {
  if (item.kind === "space") return { space: item.span };

  if (item.kind === "group")
    return {
      id: item.id,
      span: item.span,
      columns: item.columns,
      cells: item.items.map(itemOf),
    };

  return { id: item.id, label: item.label, shape: item.shape, span: item.span };
};

export const drawBlock = (
  doc: BlockDoc,
  options: DiagramOptions & { readonly reveal?: Span },
): BlockDiagram =>
  blockDiagram(
    {
      columns: doc.columns,
      cells: doc.items.map(itemOf),
      edges: doc.edges.map(
        (e) =>
          [e.from, e.to, e.label, { line: e.line, head: e.arrow ? "filled" : "none" }] as const,
      ),
    },
    options,
  );
