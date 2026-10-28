import { clean, fail, unquote, type Line } from "./errors.ts";
import type { FlowchartDoc, FlowEdge, FlowNode, FlowForm, FlowSubgraph } from "./types.ts";

const SUPPORTED =
  "Supported: `flowchart`/`graph` with a direction, nodes `A[text]` `A(text)` `A([text])` `A{text}` `A((text))` `A[[text]]` `A[(text)]`, edges `-->` `---` `-.->` `==>` with `|text|` or `-- text -->` labels, chains, `A & B --> C`, and `subgraph id [title]` ... `end`.";

const OPENERS: readonly (readonly [open: string, close: string, form: FlowForm])[] = [
  ["[[", "]]", "subroutine"],
  ["[(", ")]", "cylinder"],
  ["((", "))", "circle"],
  ["([", "])", "stadium"],
  ["[", "]", "rect"],
  ["(", ")", "round"],
  ["{", "}", "diamond"],
];

const DIRECTIONS = ["TD", "TB", "BT", "LR", "RL"] as const;
const UNSUPPORTED = /^(classDef|class|style|linkStyle|click|direction|accTitle|accDescr|title)\s/;
const LABELLED = /^(?:--|-\.|==)\s+(.+?)\s+(-{2,}>|-{3,}|\.+->|\.+-|={2,}>|={3,})/;
const PLAIN = /^(-{2,}>|-{3,}|-\.+->|-\.+-|={2,}>|={3,})\s*(?:\|([^|]*)\|)?/;

interface Ref {
  readonly id: string;
  readonly form?: FlowForm;
  readonly label?: string;
}

interface Op {
  readonly line: FlowEdge["line"];
  readonly arrow: boolean;
  readonly label?: string;
}

/** The node at the start of `s`, and what is left after it. */
const readRef = (l: Line, s: string): [Ref, string] => {
  const id = /^\w+/.exec(s)?.[0];

  if (!id)
    return fail(l, `expected a node id, found ${JSON.stringify(s.slice(0, 12))}. ${SUPPORTED}`);
  const rest = s.slice(id.length);
  const opener = OPENERS.find(([open]) => rest.startsWith(open));

  if (!opener) return [{ id }, rest];
  const [open, close, form] = opener;
  const body = rest.slice(open.length).trimStart();
  let text: string;
  let after: string;

  if (body.startsWith('"')) {
    const end = body.indexOf('"', 1);
    const tail = end < 0 ? "" : body.slice(end + 1).trimStart();

    if (!tail.startsWith(close))
      return fail(l, `node ${id} has a quoted label that is not closed by ${close}.`);
    text = body.slice(1, end);
    after = tail.slice(close.length);
  } else {
    const end = body.indexOf(close);

    if (end < 0)
      return fail(
        l,
        `node ${id} opens with ${open} but never closes with ${close}. Quote a label that contains ${close}.`,
      );
    text = body.slice(0, end);
    after = body.slice(end + close.length);
  }

  const label = clean(text);

  if (!label) return fail(l, `node ${id} has an empty label.`);

  return [{ id, form, label }, after];
};

const readGroup = (l: Line, s: string): [Ref[], string] => {
  const refs: Ref[] = [];
  let rest = s.trimStart();

  for (;;) {
    const [ref, after] = readRef(l, rest);
    refs.push(ref);
    rest = after.trimStart();

    if (!rest.startsWith("&")) return [refs, rest];
    rest = rest.slice(1).trimStart();
  }
};

const readOp = (l: Line, s: string): [Op, string] => {
  const labelled = LABELLED.exec(s);
  const match = labelled ?? PLAIN.exec(s);

  if (!match)
    return fail(
      l,
      `expected an edge such as -->, ---, -.-> or ==>, found ${JSON.stringify(s.slice(0, 12))}. ${SUPPORTED}`,
    );
  const token = labelled ? match[2]! : match[1]!;
  const raw = labelled ? match[1] : match[2];

  return [
    {
      line: token.includes(".") ? "dotted" : token.startsWith("=") ? "thick" : "solid",
      arrow: token.endsWith(">"),
      label: raw === undefined ? undefined : clean(unquote(raw)) || undefined,
    },
    s.slice(match[0].length).trimStart(),
  ];
};

export const parseFlowchart = (header: Line, body: readonly Line[]): FlowchartDoc => {
  const parts = header.text.split(/\s+/);
  const direction = DIRECTIONS.find((d) => d === (parts[1] ?? "TD"));

  if (parts.length > 2 || !direction)
    fail(
      header,
      "a flowchart header is `flowchart TD` with one direction of TD, TB, BT, LR or RL.",
    );

  const nodes = new Map<string, { label: string; form: FlowForm }>();
  const edges: FlowEdge[] = [];
  const subgraphs: { id: string; title: string; nodes: string[]; line: Line }[] = [];
  let open: (typeof subgraphs)[number] | undefined;

  const owned = new Set<string>();

  const touch = (ref: Ref) => {
    const known = nodes.get(ref.id);

    if (!known) nodes.set(ref.id, { label: ref.label ?? ref.id, form: ref.form ?? "rect" });
    else if (ref.form) {
      known.label = ref.label!;
      known.form = ref.form;
    }

    if (open && !owned.has(ref.id)) {
      owned.add(ref.id);
      open.nodes.push(ref.id);
    }
  };

  for (const l of body) {
    const sub = /^subgraph\s+(.+)$/.exec(l.text);

    if (sub) {
      if (open)
        fail(
          l,
          `subgraph inside subgraph is not supported: svjeez groups are flat. Close ${JSON.stringify(open.id)} with \`end\` first.`,
        );
      const titled = /^(\w+)\s*\[(.*)\]$/.exec(sub[1]!.trim());
      const title = clean(unquote(titled ? titled[2]! : sub[1]!));
      const id = titled ? titled[1]! : title;

      if (!title) fail(l, "a subgraph needs a title.");

      if (subgraphs.some((g) => g.id === id))
        fail(l, `two subgraphs are named ${JSON.stringify(id)}.`);
      open = { id, title, nodes: [], line: l };
      subgraphs.push(open);
      continue;
    }

    if (l.text === "end") {
      if (!open) fail(l, "`end` closes a subgraph, and none is open.");
      open = undefined;
      continue;
    }

    const word = UNSUPPORTED.exec(l.text)?.[1];

    if (word)
      fail(
        l,
        `${word} is not supported: svjeez themes and positions diagrams itself. ${SUPPORTED}`,
      );

    let [group, rest] = readGroup(l, l.text);
    group.forEach(touch);

    while (rest) {
      const [op, afterOp] = readOp(l, rest);

      if (!afterOp) fail(l, "an edge needs a node after it.");
      const [next, afterNext] = readGroup(l, afterOp);
      next.forEach(touch);

      for (const from of group)
        for (const to of next)
          edges.push({ from: from.id, to: to.id, label: op.label, line: op.line, arrow: op.arrow });
      [group, rest] = [next, afterNext];
    }
  }

  if (open) fail(open.line, "this subgraph is never closed. Add `end` after its nodes.");

  if (nodes.size === 0) fail(header, "the flowchart has no nodes.");

  for (const g of subgraphs) {
    if (g.nodes.length === 0)
      fail(
        g.line,
        `subgraph ${JSON.stringify(g.id)} has no nodes; svjeez cannot draw an empty group.`,
      );

    if (nodes.has(g.id))
      fail(
        g.line,
        `${JSON.stringify(g.id)} names both a subgraph and a node. Edges to a subgraph are not supported; rename one.`,
      );
  }

  return {
    kind: "flowchart",
    direction,
    nodes: [...nodes].map(([id, n]): FlowNode => ({ id, ...n })),
    edges,
    subgraphs: subgraphs.map(({ id, title, nodes }): FlowSubgraph => ({ id, title, nodes })),
  };
};
