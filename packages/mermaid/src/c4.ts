import {
  c4,
  type C4,
  type C4Boundary,
  type C4Element,
  type C4Kind,
  type DiagramOptions,
} from "@svjeez/diagrams";
import type { Span } from "svjeez";
import { clean, fail, isDirection, sourceOf, unquote, type Line } from "./errors.ts";
import type { MermaidDirection, Place } from "./types.ts";

export type C4Header = "C4Context" | "C4Container" | "C4Component" | "C4Dynamic" | "C4Deployment";

export interface MermaidC4Shape {
  readonly id: string;
  readonly kind: C4Kind;
  readonly shape: "box" | "db" | "queue";
  readonly external: boolean;
  readonly label: string;
  readonly techn?: string;
  readonly descr?: string;
  /** The boundary this sits in. */
  readonly boundary?: string;
  readonly source: Place;
}

export interface MermaidC4Boundary {
  readonly id: string;
  readonly label: string;
  /** Such as "Enterprise", "System", "Container" or "node". */
  readonly type: string;
  readonly boundary?: string;
  readonly source: Place;
}

export interface MermaidC4Relation {
  readonly from: string;
  readonly to: string;
  readonly label: string;
  readonly techn?: string;
  /** The step number a `RelIndex` gives. */
  readonly index?: string;
  readonly both: boolean;
}

export interface C4Doc {
  readonly kind: "c4";
  readonly source: Place;
  readonly header: C4Header;
  readonly title?: string;
  readonly direction: MermaidDirection;
  readonly shapes: readonly MermaidC4Shape[];
  readonly boundaries: readonly MermaidC4Boundary[];
  readonly relations: readonly MermaidC4Relation[];
}

const SUPPORTED =
  'Supported: a header (C4Context, C4Container, C4Component, C4Dynamic or C4Deployment), `title Text`, Person, Person_Ext, System, Container and Component (each also with Db, Queue and _Ext variants), boundaries `Boundary`, `Enterprise_Boundary`, `System_Boundary`, `Container_Boundary`, `Node`, `Node_L`, `Node_R` and `Deployment_Node` opened with `{` and closed with `}`, relationships `Rel`, `BiRel`, `Rel_U`, `Rel_D`, `Rel_L`, `Rel_R`, `Rel_Back` and `RelIndex`, and `direction TB`, `LR`, `BT` or `RL`. Arguments are positional or `$name="value"`. `UpdateElementStyle`, `UpdateRelStyle` and `UpdateLayoutConfig` are read and ignored: svjeez themes and lays out diagrams itself.';

const HEADERS: readonly C4Header[] = [
  "C4Context",
  "C4Container",
  "C4Component",
  "C4Dynamic",
  "C4Deployment",
];

const IGNORED = new Set(["UpdateElementStyle", "UpdateRelStyle", "UpdateLayoutConfig"]);
const COSMETIC = ["sprite", "tags", "link"];

const SHAPES = new Map<string, readonly [C4Kind, string]>();

for (const [base, kind] of [
  ["Person", "person"],
  ["System", "system"],
  ["Container", "container"],
  ["Component", "component"],
] as const)
  for (const form of base === "Person" ? [""] : ["", "Db", "Queue"])
    for (const ext of ["", "_Ext"]) SHAPES.set(`${base}${form}${ext}`, [kind, `${form}${ext}`]);

const BOUNDARIES = new Map<string, { readonly slots: readonly string[]; readonly type?: string }>([
  ["Boundary", { slots: ["alias", "label", "type", "tags", "link"] }],
  ["Enterprise_Boundary", { slots: ["alias", "label", "tags", "link"], type: "Enterprise" }],
  ["System_Boundary", { slots: ["alias", "label", "tags", "link"], type: "System" }],
  ["Container_Boundary", { slots: ["alias", "label", "tags", "link"], type: "Container" }],
  ...["Node", "Node_L", "Node_R", "Deployment_Node"].map(
    (n) => [n, { slots: ["alias", "label", "type", "descr", "sprite", "tags", "link"] }] as const,
  ),
]);

const REL = ["from", "to", "label", "techn", "descr", "sprite", "tags", "link"];

const RELS = new Map<string, readonly string[]>([
  ...[
    "Rel",
    "BiRel",
    "Rel_U",
    "Rel_Up",
    "Rel_D",
    "Rel_Down",
    "Rel_L",
    "Rel_Left",
    "Rel_R",
    "Rel_Right",
    "Rel_Back",
  ].map((n) => [n, REL] as const),
  ["RelIndex", ["index", ...REL]],
]);

const STATEMENT = /^(\w+)\s*\((.*)\)\s*(\{)?$/;

interface Fields {
  [key: string]: string;
}

const args = (l: Line, text: string): { readonly key?: string; readonly value: string }[] => {
  const out: { key?: string; value: string }[] = [];
  let at = "";
  let quoted = false;

  const push = () => {
    const raw = at.trim();
    const m = /^\$(\w+)\s*=\s*(.*)$/s.exec(raw);
    out.push(m ? { key: m[1]!, value: unquote(m[2]!.trim()) } : { value: unquote(raw) });
    at = "";
  };

  for (const c of text) {
    if (c === '"') quoted = !quoted;

    if (c === "," && !quoted) push();
    else at += c;
  }

  if (quoted) fail(l, 'a quote is never closed. Close the string with a second `"`.');

  if (at.trim() !== "" || out.length > 0) push();

  return out;
};

const bind = (l: Line, name: string, slots: readonly string[], text: string): Fields => {
  const fields: Fields = {};

  args(l, text).forEach((a, i) => {
    const key = a.key ?? slots[i];

    if (key === undefined || !slots.includes(key))
      fail(
        l,
        a.key === undefined
          ? `${name} takes at most ${slots.length} arguments (${slots.join(", ")}).`
          : `${name} has no argument $${key}. Its arguments are ${slots.join(", ")}.`,
      );

    if (key in fields) fail(l, `the argument ${key} is given twice.`);
    fields[key] = clean(a.value);
  });

  return fields;
};

const need = (l: Line, name: string, f: Fields, ...keys: string[]): void => {
  for (const k of keys) if (!f[k]) fail(l, `${name} needs ${k}. ${SUPPORTED}`);
};

export const parseC4 = (header: Line, body: readonly Line[]): C4Doc => {
  const head = HEADERS.find((h) => h === header.text);

  if (!head)
    return fail(header, `a C4 diagram header is one of ${HEADERS.join(", ")}, alone on its line.`);

  const shapes: MermaidC4Shape[] = [];
  const boundaries: MermaidC4Boundary[] = [];
  const rels: [Line, MermaidC4Relation][] = [];
  const names = new Set<string>();
  const stack: { readonly id: string; readonly line: Line }[] = [];
  let title: string | undefined;
  let direction: C4Doc["direction"] = "TB";
  let waiting: { readonly id: string; readonly line: Line } | undefined;

  const declare = (l: Line, id: string): void => {
    if (names.has(id)) fail(l, `the name ${JSON.stringify(id)} is already used.`);

    if (id.includes("/")) fail(l, 'a name cannot contain "/".');
    names.add(id);
  };

  for (const l of body) {
    if (waiting) {
      if (l.text !== "{") fail(waiting.line, "a boundary needs `{` after its arguments.");
      stack.push(waiting);
      waiting = undefined;
      continue;
    }

    if (l.text === "}") {
      if (stack.pop() === undefined) fail(l, "this `}` closes nothing. Remove it.");
      continue;
    }

    const titled = /^title\s+(.+)$/.exec(l.text)?.[1];

    if (titled !== undefined) {
      title = clean(titled);
      continue;
    }

    const dir = /^direction\s+(\w+)$/.exec(l.text)?.[1];

    if (dir) {
      if (!isDirection(dir)) fail(l, `direction ${dir} is not one of TB, LR, BT or RL.`);
      direction = dir;
      continue;
    }

    const m = STATEMENT.exec(l.text);

    if (!m) {
      const word = /^\w+/.exec(l.text)?.[0];

      if (word === "accTitle" || word === "accDescr")
        fail(l, `${word} is not supported: accessibility text is not read. ${SUPPORTED}`);
      fail(l, `cannot read this line. ${SUPPORTED}`);
    }

    const [, name, text, brace] = m!;
    const at = stack.at(-1)?.id;

    if (IGNORED.has(name!)) continue;
    const shape = SHAPES.get(name!);

    if (shape) {
      if (brace) fail(l, `${name} holds nothing. Only boundaries and nodes take \`{ }\`.`);
      const [kind, form] = shape;
      const roomy = kind === "container" || kind === "component";
      const slots = ["alias", "label", ...(roomy ? ["techn"] : []), "descr", ...COSMETIC];
      const f = bind(l, name!, slots, text!);
      need(l, name!, f, "alias", "label");
      declare(l, f.alias!);

      shapes.push({
        id: f.alias!,
        kind,
        shape: form.startsWith("Db") ? "db" : form.startsWith("Queue") ? "queue" : "box",
        external: form.endsWith("_Ext"),
        label: f.label!,
        ...(f.techn && { techn: f.techn }),
        ...(f.descr && { descr: f.descr }),
        ...(at !== undefined && { boundary: at }),
        source: sourceOf(l),
      });
      continue;
    }

    const wall = BOUNDARIES.get(name!);

    if (wall) {
      const f = bind(l, name!, wall.slots, text!);
      need(l, name!, f, "alias", "label");
      declare(l, f.alias!);

      boundaries.push({
        id: f.alias!,
        label: f.label!,
        type: wall.type ?? f.type ?? (name!.includes("Node") ? "node" : ""),
        ...(at !== undefined && { boundary: at }),
        source: sourceOf(l),
      });
      const open = { id: f.alias!, line: l };

      if (brace) stack.push(open);
      else waiting = open;
      continue;
    }

    const slots = RELS.get(name!);

    if (slots) {
      if (brace) fail(l, `${name} holds nothing. Only boundaries and nodes take \`{ }\`.`);
      const f = bind(l, name!, slots, text!);
      need(l, name!, f, "from", "to", "label");

      rels.push([
        l,
        {
          from: f.from!,
          to: f.to!,
          label: f.label!,
          ...(f.techn && { techn: f.techn }),
          ...(f.index && { index: f.index }),
          both: name === "BiRel",
        },
      ]);
      continue;
    }

    fail(l, `${JSON.stringify(name)} is not a C4 statement. ${SUPPORTED}`);
  }

  if (waiting) fail(waiting.line, "a boundary needs `{` after its arguments.");
  const unclosed = stack.at(-1);

  if (unclosed)
    fail(
      unclosed.line,
      `boundary ${JSON.stringify(unclosed.id)} is never closed. Add \`}\` after its contents.`,
    );

  if (shapes.length === 0) fail(header, "the C4 diagram has no elements.");
  const ids = new Set(shapes.map((s) => s.id));
  const walls = new Set(boundaries.map((b) => b.id));

  for (const b of boundaries)
    if (!shapes.some((s) => s.boundary === b.id) && !boundaries.some((c) => c.boundary === b.id))
      fail(
        { file: b.source.file, line: b.source.line, text: b.id },
        `boundary ${JSON.stringify(b.id)} is empty. Put an element in it, or remove it.`,
      );

  for (const [l, r] of rels)
    for (const end of [r.from, r.to])
      if (!ids.has(end))
        fail(
          l,
          walls.has(end)
            ? `${JSON.stringify(end)} is a boundary, and relationships join elements. Point it at an element inside.`
            : `${JSON.stringify(end)} is not an element. Declare it before the relationship.`,
        );

  return {
    kind: "c4",
    source: sourceOf(header),
    header: head,
    ...(title !== undefined && { title }),
    direction,
    shapes,
    boundaries,
    relations: rels.map(([, r]) => r),
  };
};

export interface C4DrawOptions extends DiagramOptions {
  readonly direction?: MermaidDirection;
  readonly reveal?: Span;
}

export const drawC4 = (doc: C4Doc, options: C4DrawOptions): C4<string> => {
  const { direction, ...rest } = options;

  const elements = Object.fromEntries(
    doc.shapes.map((s): [string, C4Element] => [
      s.id,
      {
        label: s.label,
        kind: s.kind,
        shape: s.shape,
        external: s.external,
        ...(s.techn && { techn: s.techn }),
        ...(s.descr && { descr: s.descr }),
        ...(s.boundary && { boundary: s.boundary }),
      },
    ]),
  );

  const boundaries = Object.fromEntries(
    doc.boundaries.map((b): [string, C4Boundary] => [
      b.id,
      {
        label: b.label,
        ...(b.type && { type: b.type }),
        ...(b.boundary && { boundary: b.boundary }),
      },
    ]),
  );

  return c4(
    {
      elements,
      boundaries,
      relations: doc.relations.map((r) => ({
        from: r.from,
        to: r.to,
        label: r.index ? `${r.index}: ${r.label}` : r.label,
        ...(r.techn && { techn: r.techn }),
        both: r.both,
      })),
    },
    { ...rest, direction: direction ?? doc.direction, ...(doc.title && { title: doc.title }) },
  );
};
