import { clean, fail, isDirection, sourceOf, unquote, type Line } from "./errors.ts";
import type {
  FlowchartDoc,
  FlowEnd,
  FlowForm,
  FlowStyle,
  FlowSubgraph,
  MermaidFlowEdge,
  MermaidFlowNode,
} from "./types.ts";

const SUPPORTED =
  'Supported: `flowchart`/`graph` with a direction (TD, TB, BT, LR, RL), nodes `A[text]` `A(text)` `A([text])` `A{text}` `A((text))` `A(((text)))` `A[[text]]` `A[(text)]` `A{{text}}` `A[/text/]` `A[\\text\\]` `A[/text\\]` `A[\\text/]` `A>text]` `A@{ shape: hex, label: "text" }`, edges `-->` `---` `-.->` `==>` `<-->` `--o` `--x` `o--o` `x--x` `~~~` and longer `--->` with `|text|` or `-- text -->` labels, chains, `A & B --> C`, `subgraph id [title]` ... `end`, and `classDef`, `class`, `:::`, `style` and `linkStyle` for colors.';

type Closer = readonly [close: string, form: FlowForm];

const OPENERS: readonly (readonly [open: string, closers: readonly Closer[]])[] = [
  ["(((", [[")))", "doubleCircle"]]],
  ["[[", [["]]", "subroutine"]]],
  ["[(", [[")]", "cylinder"]]],
  ["((", [["))", "circle"]]],
  ["([", [["])", "stadium"]]],
  ["{{", [["}}", "hexagon"]]],
  [
    "[/",
    [
      ["/]", "parallelogram"],
      ["\\]", "trapezoid"],
    ],
  ],
  [
    "[\\",
    [
      ["\\]", "parallelogramBack"],
      ["/]", "trapezoidBack"],
    ],
  ],
  ["[", [["]", "rect"]]],
  ["(", [[")", "round"]]],
  ["{", [["}", "diamond"]]],
  [">", [["]", "asymmetric"]]],
];

const SHAPE_NAMES = new Map<string, FlowForm>(
  Object.entries({
    rect: "rect",
    rectangle: "rect",
    process: "rect",
    proc: "rect",
    rounded: "round",
    event: "round",
    stadium: "stadium",
    terminal: "stadium",
    pill: "stadium",
    "fr-rect": "subroutine",
    "framed-rectangle": "subroutine",
    subproc: "subroutine",
    subprocess: "subroutine",
    subroutine: "subroutine",
    cyl: "cylinder",
    cylinder: "cylinder",
    db: "cylinder",
    database: "cylinder",
    circle: "circle",
    circ: "circle",
    "sm-circ": "circle",
    "small-circle": "circle",
    start: "circle",
    "dbl-circ": "doubleCircle",
    "double-circle": "doubleCircle",
    diam: "diamond",
    diamond: "diamond",
    decision: "diamond",
    question: "diamond",
    hex: "hexagon",
    hexagon: "hexagon",
    prepare: "hexagon",
    "lean-r": "parallelogram",
    "lean-right": "parallelogram",
    "in-out": "parallelogram",
    "lean-l": "parallelogramBack",
    "lean-left": "parallelogramBack",
    "out-in": "parallelogramBack",
    "trap-b": "trapezoid",
    "trapezoid-bottom": "trapezoid",
    priority: "trapezoid",
    "trap-t": "trapezoidBack",
    "inv-trapezoid": "trapezoidBack",
    "trapezoid-top": "trapezoidBack",
    manual: "trapezoidBack",
    odd: "asymmetric",
  } satisfies Record<string, FlowForm>),
);

const NAMED_COLORS = new Map<string, `#${string}`>(
  Object.entries({
    white: "#ffffff",
    black: "#000000",
    red: "#ff0000",
    green: "#008000",
    blue: "#0000ff",
    yellow: "#ffff00",
    orange: "#ffa500",
    purple: "#800080",
    pink: "#ffc0cb",
    gray: "#808080",
    grey: "#808080",
    cyan: "#00ffff",
    magenta: "#ff00ff",
    lime: "#00ff00",
    teal: "#008080",
    navy: "#000080",
    maroon: "#800000",
    silver: "#c0c0c0",
    brown: "#a52a2a",
  } satisfies Record<string, `#${string}`>),
);

const DIRECTIONS = ["TD", "TB", "BT", "LR", "RL"] as const;
const UNSUPPORTED = /^(accTitle|accDescr|title)\s/;
const LABELLED = /^([<ox])?(--|-\.|==)\s+(.+?)\s+(-{2,}[>ox]|-{3,}|\.+-[>ox]?|={2,}[>ox]|={3,})/;
const PLAIN = /^([<ox])?(-{2,}|={2,}|-\.+-|~{3,})([>ox])?\s*(?:\|([^|]*)\|)?/;

type Paint = { -readonly [K in keyof FlowStyle]: FlowStyle[K] };

interface Ref {
  readonly id: string;
  readonly form?: FlowForm;
  readonly label?: string;
  readonly classes: readonly string[];
}

interface Op {
  readonly line: MermaidFlowEdge["line"];
  readonly head: FlowEnd;
  readonly tail: FlowEnd;
  readonly label?: string;
  readonly id?: string;
}

const endOf = (mark: string | undefined): FlowEnd => {
  if (mark === ">" || mark === "<") return "arrow";

  if (mark === "o") return "circle";

  return mark === "x" ? "cross" : "none";
};

/** A markdown string "`**bold**`" is drawn as the plain text it holds. */
const plain = (text: string): string => {
  const marked = /^`([\s\S]*)`$/.exec(text.trim());

  if (!marked) return clean(text);

  return clean(
    marked[1]!.replace(/(\*\*|__)(.+?)\1/g, "$2").replace(/(\*|_)(\S(?:.*?\S)?)\1/g, "$2"),
  );
};

const colorOf = (l: Line, key: string, value: string): `#${string}` | undefined => {
  const v = value.trim().toLowerCase();

  if (v === "none" || v === "transparent") return undefined;

  if (/^#(?:[\da-f]{3}|[\da-f]{6})$/.test(v)) {
    // SAFETY: the pattern pins the text to a # hex color.
    return v as `#${string}`;
  }

  return (
    NAMED_COLORS.get(v) ??
    fail(l, `${key}:${value.trim()} is not a color. Use #rgb, #rrggbb or a basic name like red.`)
  );
};

const styleOf = (l: Line, text: string): FlowStyle => {
  const style: Paint = {};

  for (const piece of text.split(/,(?=\s*[\w-]+\s*:)/)) {
    const pair = /^\s*([\w-]+)\s*:\s*(.+?)\s*$/.exec(piece);

    if (!pair) fail(l, `expected key:value style pairs such as fill:#f9f,stroke:#333.`);
    const [key, value] = [pair![1]!, pair![2]!];

    if (key === "fill" || key === "stroke" || key === "color") {
      const color = colorOf(l, key, value);

      if (color) style[key] = color;
    } else if (key === "stroke-width") {
      const width = /^(\d+(?:\.\d+)?)(?:px)?$/.exec(value);

      if (!width) fail(l, `stroke-width:${value} is not a number of pixels.`);
      style.width = Number(width![1]);
    } else if (key === "stroke-dasharray") {
      const dash = value.split(/[\s,]+/).map(Number);

      if (dash.some((n) => !Number.isFinite(n) || n < 0))
        fail(l, `stroke-dasharray:${value} is not a list of numbers.`);

      if (dash.some((n) => n > 0)) style.dash = dash;
    }
  }

  return style;
};

const readClasses = (s: string): [string[], string] => {
  const classes: string[] = [];
  let rest = s;

  for (let m = /^:::([\w-]+)/.exec(rest); m; m = /^:::([\w-]+)/.exec(rest)) {
    classes.push(m[1]!);
    rest = rest.slice(m[0].length);
  }

  return [classes, rest];
};

const splitTop = (text: string): string[] => {
  const parts: string[] = [];
  let [quoted, start] = [false, 0];

  [...text].forEach((c, i) => {
    if (c === '"') quoted = !quoted;

    if (c === "," && !quoted) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  });
  parts.push(text.slice(start));

  return parts;
};

const readShape = (l: Line, id: string, s: string): [Ref, string] => {
  const end = (() => {
    let quoted = false;

    for (let i = 2; i < s.length; i++) {
      if (s[i] === '"') quoted = !quoted;

      if (s[i] === "}" && !quoted) return i;
    }

    return -1;
  })();

  if (end < 0) return fail(l, `node ${id} opens @{ but never closes with }.`);
  const props = new Map<string, string>();

  for (const part of splitTop(s.slice(2, end))) {
    const pair = /^\s*([\w-]+)\s*:\s*([\s\S]*?)\s*$/.exec(part);

    if (pair) props.set(pair[1]!, unquote(pair[2]!.replace(/^'(.*)'$/s, '"$1"')));
  }

  const name = props.get("shape");
  const form = name === undefined ? "rect" : SHAPE_NAMES.get(name);

  if (!form)
    return fail(
      l,
      `shape ${JSON.stringify(name)} is not supported. Use one of ${[...SHAPE_NAMES.keys()].join(", ")}.`,
    );
  const label = props.has("label") ? plain(props.get("label")!) : undefined;

  if (label === "") return fail(l, `node ${id} has an empty label.`);

  return [{ id, form, label, classes: [] }, s.slice(end + 1)];
};

const readRef = (l: Line, s: string): [Ref, string] => {
  const [ref, after] = readNode(l, s);
  const [classes, rest] = readClasses(after);

  return [{ ...ref, classes }, rest];
};

const readNode = (l: Line, s: string): [Ref, string] => {
  const id = /^\w+/.exec(s)?.[0];

  if (!id)
    return fail(l, `expected a node id, found ${JSON.stringify(s.slice(0, 12))}. ${SUPPORTED}`);
  const rest = s.slice(id.length);

  if (rest.startsWith("@{")) return readShape(l, id, rest);
  const opener = OPENERS.find(([open]) => rest.startsWith(open));

  if (!opener) return [{ id, classes: [] }, rest];
  const [open, closers] = opener;
  const body = rest.slice(open.length).trimStart();
  let text: string;
  let after: string;
  let form: FlowForm;
  const names = closers.map(([c]) => c).join(" or ");

  if (body.startsWith('"')) {
    const end = body.indexOf('"', 1);
    const tail = end < 0 ? "" : body.slice(end + 1).trimStart();
    const closer = closers.find(([c]) => tail.startsWith(c));

    if (!closer) return fail(l, `node ${id} has a quoted label that is not closed by ${names}.`);
    text = body.slice(1, end);
    after = tail.slice(closer[0].length);
    form = closer[1];
  } else {
    const found = closers
      .map(([c, f]) => [body.indexOf(c), c, f] as const)
      .filter(([at]) => at >= 0)
      .sort((x, y) => x[0] - y[0])[0];

    if (!found)
      return fail(
        l,
        `node ${id} opens with ${open} but never closes with ${names}. Quote a label that contains ${names}.`,
      );
    text = body.slice(0, found[0]);
    after = body.slice(found[0] + found[1].length);
    form = found[2];
  }

  const label = plain(text);

  if (!label) return fail(l, `node ${id} has an empty label.`);

  return [{ id, form, label, classes: [] }, after];
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

const readOp = (l: Line, input: string): [Op, string] => {
  const named = /^(\w+)@(?=[<ox~=-])/.exec(input);
  const s = named ? input.slice(named[0].length) : input;
  const labelled = LABELLED.exec(s);
  const match = labelled ?? PLAIN.exec(s);
  const body = labelled ? labelled[2]! : match?.[2];
  const end = labelled ? labelled[4]!.at(-1) : match?.[3];
  const mark = labelled ? (/[>ox]$/.test(labelled[4]!) ? end : undefined) : end;

  if (!match || (!labelled && !mark && (body === "--" || body === "==")))
    return fail(
      l,
      `expected an edge such as -->, ---, -.->, ==>, <--> or ~~~, found ${JSON.stringify(s.slice(0, 12))}. ${SUPPORTED}`,
    );
  const raw = labelled ? labelled[3] : match[4];
  const invisible = body!.startsWith("~");

  return [
    {
      line: invisible
        ? "invisible"
        : body!.includes(".")
          ? "dotted"
          : body!.startsWith("=")
            ? "thick"
            : "solid",
      head: invisible ? "none" : endOf(mark),
      tail: invisible ? "none" : endOf(match[1]),
      label: raw === undefined ? undefined : plain(unquote(raw)) || undefined,
      id: named?.[1],
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
  const edges: { -readonly [K in keyof MermaidFlowEdge]: MermaidFlowEdge[K] }[] = [];
  const subgraphs: { id: string; title: string; nodes: string[]; line: Line }[] = [];
  let open: (typeof subgraphs)[number] | undefined;

  const owned = new Set<string>();
  const edgeIds = new Set<string>();
  const classDefs = new Map<string, FlowStyle>();
  const applied = new Map<string, { name: string; line: Line }[]>();
  const direct: { id: string; style: FlowStyle; line: Line }[] = [];
  const links: { at: number | "default"; style: FlowStyle; line: Line }[] = [];

  const touch = (ref: Ref, l: Line) => {
    const known = nodes.get(ref.id);

    if (ref.form) nodes.set(ref.id, { label: ref.label ?? known?.label ?? ref.id, form: ref.form });
    else if (!known) nodes.set(ref.id, { label: ref.id, form: "rect" });

    for (const name of ref.classes)
      applied.set(ref.id, [...(applied.get(ref.id) ?? []), { name, line: l }]);

    if (open && !owned.has(ref.id)) {
      owned.add(ref.id);
      open.nodes.push(ref.id);
    }
  };

  const statement = (l: Line): boolean => {
    const def = /^classDef\s+(\S+)\s+(.+)$/.exec(l.text);

    if (def) {
      const style = styleOf(l, def[2]!);

      for (const name of def[1]!.split(","))
        classDefs.set(name, { ...classDefs.get(name), ...style });

      return true;
    }

    const cls = /^class\s+(\S+)\s+([\w-]+(?:,[\w-]+)*)$/.exec(l.text);

    if (cls) {
      for (const id of cls[1]!.split(","))
        for (const name of cls[2]!.split(","))
          applied.set(id, [...(applied.get(id) ?? []), { name, line: l }]);

      return true;
    }

    const style = /^style\s+(\S+)\s+(.+)$/.exec(l.text);

    if (style) {
      for (const id of style[1]!.split(","))
        direct.push({ id, style: styleOf(l, style[2]!), line: l });

      return true;
    }

    const link = /^linkStyle\s+(default|\d+(?:\s*,\s*\d+)*)\s+(.+)$/.exec(l.text);

    if (link) {
      const made = styleOf(l, link[2]!);

      for (const at of link[1]!.split(","))
        links.push({ at: at.trim() === "default" ? "default" : Number(at), style: made, line: l });

      return true;
    }

    return /^click\s/.test(l.text);
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
      const title = plain(unquote(titled ? titled[2]! : sub[1]!));
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

    const dir = /^direction\s+(\w+)$/.exec(l.text)?.[1];

    if (dir !== undefined) {
      if (!open) fail(l, "direction goes in the header, or inside a subgraph.");

      if (!isDirection(dir)) fail(l, `direction ${dir} is not one of TB, LR, BT or RL.`);
      continue;
    }

    if (statement(l)) continue;

    const word = UNSUPPORTED.exec(l.text)?.[1];

    if (word)
      fail(
        l,
        `${word} is not supported: svjeez themes and positions diagrams itself. ${SUPPORTED}`,
      );

    const edgeLine = /^(\w+)@\{/.exec(l.text)?.[1];

    if (edgeLine && edgeIds.has(edgeLine)) continue;

    let [group, rest] = readGroup(l, l.text);
    group.forEach((r) => touch(r, l));

    while (rest) {
      const [op, afterOp] = readOp(l, rest);

      if (!afterOp) fail(l, "an edge needs a node after it.");
      const [next, afterNext] = readGroup(l, afterOp);
      next.forEach((r) => touch(r, l));

      if (op.id) edgeIds.add(op.id);

      for (const from of group)
        for (const to of next)
          edges.push({
            from: from.id,
            to: to.id,
            label: op.label,
            line: op.line,
            head: op.head,
            tail: op.tail,
          });
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

  const groupIds = new Set(subgraphs.map((g) => g.id));
  const styles = new Map<string, FlowStyle>();

  for (const [id, list] of applied) {
    if (!nodes.has(id)) {
      if (groupIds.has(id)) continue;
      fail(list[0]!.line, `class names ${JSON.stringify(id)}, which is not a node.`);
    }

    const merged: Paint = { ...classDefs.get("default") };

    for (const { name, line } of list) {
      const def = classDefs.get(name);

      if (!def)
        fail(
          line,
          `class ${JSON.stringify(name)} is not defined. Add \`classDef ${name} fill:#f9f\`.`,
        );
      Object.assign(merged, def);
    }

    styles.set(id, merged);
  }

  for (const { id, style, line } of direct) {
    if (!nodes.has(id)) {
      if (groupIds.has(id)) continue;
      fail(line, `style names ${JSON.stringify(id)}, which is not a node.`);
    }

    styles.set(id, { ...(styles.get(id) ?? classDefs.get("default")), ...style });
  }

  const base = classDefs.get("default");

  for (const [id] of nodes) if (base && !styles.has(id)) styles.set(id, base);

  for (const { at, style, line } of links.toSorted(
    (a, b) => Number(b.at === "default") - Number(a.at === "default"),
  )) {
    const targets = at === "default" ? edges : [edges[at]];

    if (targets[0] === undefined)
      fail(
        line,
        `linkStyle ${at} is out of range: the flowchart has ${edges.length} edges, numbered from 0.`,
      );

    for (const edge of targets)
      edge!.style = {
        ...edge!.style,
        ...(style.stroke && { stroke: style.stroke }),
        ...(style.width !== undefined && { width: style.width }),
      };
  }

  return {
    kind: "flowchart",
    source: sourceOf(header),
    direction,
    nodes: [...nodes].map(([id, n]): MermaidFlowNode => {
      const style = styles.get(id);

      return style && Object.keys(style).length > 0 ? { id, ...n, style } : { id, ...n };
    }),
    edges,
    subgraphs: subgraphs.map(({ id, title, nodes }): FlowSubgraph => ({ id, title, nodes })),
  };
};
