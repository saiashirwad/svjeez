import {
  classDiagram,
  type ClassDiagram,
  type ClassEnd,
  type ClassMember,
  type DiagramOptions,
} from "@svjeez/diagrams";
import type { Span } from "svjeez";
import { clean, fail, isDirection, sourceOf, unquote, type Line } from "./errors.ts";
import type { MermaidDirection, Place } from "./types.ts";

export interface MermaidClass {
  readonly id: string;
  readonly label: string;
  readonly annotation?: string;
  /** A plain string, or a member marked static (`$`) or abstract (`*`). */
  readonly attributes: readonly (string | ClassMember)[];
  readonly methods: readonly (string | ClassMember)[];
}

export interface MermaidClassNote {
  readonly text: string;
  readonly for?: string;
}

export interface MermaidClassRelation {
  readonly from: string;
  readonly to: string;
  readonly start: ClassEnd;
  readonly end: ClassEnd;
  readonly line: "solid" | "dashed";
  readonly label?: string;
  readonly fromLabel?: string;
  readonly toLabel?: string;
}

export interface ClassDoc {
  readonly kind: "class";
  readonly source: Place;
  readonly direction: MermaidDirection;
  readonly classes: readonly MermaidClass[];
  readonly relations: readonly MermaidClassRelation[];
  readonly notes: readonly MermaidClassNote[];
  readonly namespaces: readonly { readonly id: string; readonly classes: readonly string[] }[];
}

const SUPPORTED =
  'Supported: `class Name`, `class Name { +attribute  +method() }` (also on one line), `<<annotation>>`, members ending in `$` (static) or `*` (abstract), `note "text"` and `note for Name "text"`, `Name : +member`, relations `<|--` `*--` `o--` `-->` `..>` `..|>` `--` `..` with "cardinality" and `: label`, `namespace Name { ... }`, and `direction TB`, `LR`, `BT` or `RL`.';

const LEAVES = new Map<string, ClassEnd>([
  ["<|", "triangle"],
  ["|>", "triangle"],
  ["*", "diamond-filled"],
  ["o", "diamond"],
  ["<", "arrow"],
  [">", "arrow"],
]);

const CLASS = /^class\s+(\w+)(?:~([^~]+)~)?(?:\s*\["([^"]*)"\])?\s*(?:(\{)\s*(?:(.*?)\s*(\}))?)?$/;
const NOTE = /^note(?:\s+for\s+(\w+))?\s+"([^"]*)"$/;
const IGNORED = /^(?:classDef|cssClass|style|click|link|callback)\s+\S/;
const NAMESPACE = /^namespace\s+(\w+)\s*\{$/;
const ANNOTATION = /^<<\s*([^<>]+?)\s*>>(?:\s+(\w+))?$/;
const MEMBER = /^(\w+)\s*:\s*(.+)$/;

const RELATION =
  /^(\w+)\s+(?:"([^"]*)"\s+)?(<\||\*|o|<)?(--|\.\.)(\|>|\*|o|>)?\s+(?:"([^"]*)"\s+)?(\w+)(?:\s*:\s*(.*))?$/;

const UNSUPPORTED = new Map([
  ["accTitle", "accessibility text is not read"],
  ["accDescr", "accessibility text is not read"],
  ["title", "a diagram has no title"],
]);

interface Mutable {
  readonly id: string;
  label: string;
  annotation?: string;
  readonly attributes: (string | ClassMember)[];
  readonly methods: (string | ClassMember)[];
}

const generics = (text: string): string =>
  text.slice(0, 1) + text.slice(1).replace(/~([^~]+)~/g, "<$1>");

export const parseClass = (header: Line, body: readonly Line[]): ClassDoc => {
  if (header.text !== "classDiagram" && header.text !== "classDiagram-v2")
    fail(header, "a class diagram header is just `classDiagram`.");

  const classes = new Map<string, Mutable>();
  const relations: MermaidClassRelation[] = [];
  const notes: MermaidClassNote[] = [];
  const namespaces: { id: string; classes: string[]; line: Line }[] = [];
  const owner = new Map<string, string>();
  let direction: ClassDoc["direction"] = "TB";
  let space: (typeof namespaces)[number] | undefined;
  let open: { readonly cls: Mutable; readonly line: Line } | undefined;

  const touch = (id: string): Mutable => {
    let c = classes.get(id);

    if (!c) {
      c = { id, label: id, attributes: [], methods: [] };
      classes.set(id, c);
    }

    return c;
  };

  const member = (l: Line, c: Mutable, raw: string) => {
    const full = generics(clean(raw));
    const mark = /[*$]$/.exec(full)?.[0];
    const text = mark ? full.slice(0, -1).trimEnd() : full;

    if (!text) return;

    const item: string | ClassMember = mark
      ? { text, ...(mark === "$" ? { static: true } : { abstract: true }) }
      : text;

    (text.slice(1).includes(")") ? c.methods : c.attributes).push(item);
  };

  for (const raw of body) {
    if (open) {
      if (raw.text === "}") {
        open = undefined;
        continue;
      }

      const note = ANNOTATION.exec(raw.text);

      if (note) open.cls.annotation = clean(note[1]!);
      else member(raw, open.cls, raw.text);
      continue;
    }

    const l = { ...raw, text: raw.text.replace(/:::[\w-]+/g, "").trim() };

    if (IGNORED.test(l.text)) continue;

    if (l.text === "}") {
      if (!space) fail(l, "`}` closes a class or namespace body, and none is open.");
      space = undefined;
      continue;
    }

    const declared = CLASS.exec(l.text);

    if (declared) {
      const [, id, generic, label, brace, inline, closed] = declared;
      const c = touch(id!);
      c.label = label === undefined ? (generic ? `${id}<${generic}>` : id!) : clean(label);

      if (space) {
        const other = owner.get(id!);

        if (other !== undefined && other !== space.id)
          fail(l, `class ${id} is already in namespace ${JSON.stringify(other)}.`);

        if (other === undefined) {
          owner.set(id!, space.id);
          space.classes.push(id!);
        }
      }

      if (inline) {
        const note = ANNOTATION.exec(inline);

        if (note) c.annotation = clean(note[1]!);
        else member(l, c, inline);
      }

      if (brace && !closed) open = { cls: c, line: l };
      continue;
    }

    const named = NAMESPACE.exec(l.text);

    if (named) {
      if (space) fail(l, "nested namespaces are not supported: svjeez groups are flat.");

      if (namespaces.some((n) => n.id === named[1]))
        fail(l, `two namespaces are named ${JSON.stringify(named[1])}.`);
      space = { id: named[1]!, classes: [], line: l };
      namespaces.push(space);
      continue;
    }

    if (space) fail(l, "only `class` declarations go inside a namespace.");

    const dir = /^direction\s+(\w+)$/.exec(l.text)?.[1];

    if (dir) {
      if (!isDirection(dir)) fail(l, `direction ${dir} is not one of TB, LR, BT or RL.`);
      direction = dir;
      continue;
    }

    const annotated = ANNOTATION.exec(l.text);

    if (annotated) {
      if (!annotated[2])
        fail(l, "write the annotation inside the class body, or follow it with a class name.");
      touch(annotated[2]).annotation = clean(annotated[1]!);
      continue;
    }

    if (/^(accTitle|accDescr)\b/.test(l.text))
      fail(
        l,
        `${l.text.split(/\W/)[0]} is not supported: accessibility text is not read. ${SUPPORTED}`,
      );

    const noted = NOTE.exec(l.text);

    if (noted) {
      const text = noted[2]!.replace(/<br\s*\/?>/gi, "\\n");

      if (noted[1]) touch(noted[1]);
      notes.push({
        text: text
          .split("\\n")
          .map((t) => clean(t))
          .join("\n"),
        ...(noted[1] && { for: noted[1] }),
      });
      continue;
    }

    if (/\(\)\s*(--|\.\.)|(--|\.\.)\s*\(\)/.test(l.text))
      fail(
        l,
        `lollipop interfaces \`()--\` are not supported. Write the interface as a class with \`<<interface>>\` and use \`..|>\`.`,
      );

    const rel = RELATION.exec(l.text);

    if (rel) {
      const [, from, fromLabel, head, dots, tail, toLabel, to, label] = rel;
      const text = label === undefined ? undefined : clean(unquote(label));

      const cardinality = (t: string | undefined) =>
        t === undefined ? undefined : clean(t) || undefined;

      touch(from!);
      touch(to!);
      relations.push({
        from: from!,
        to: to!,
        start: (head && LEAVES.get(head)) || "none",
        end: (tail && LEAVES.get(tail)) || "none",
        line: dots === ".." ? "dashed" : "solid",
        ...(text && { label: text }),
        ...(cardinality(fromLabel) && { fromLabel: cardinality(fromLabel) }),
        ...(cardinality(toLabel) && { toLabel: cardinality(toLabel) }),
      });
      continue;
    }

    const added = MEMBER.exec(l.text);

    if (added) {
      member(l, touch(added[1]!), added[2]!);
      continue;
    }

    const word = /^\w+/.exec(l.text)?.[0];

    const why = word && UNSUPPORTED.get(word);

    if (why && /^\w+(\s|$)/.test(l.text)) fail(l, `${word} is not supported: ${why}. ${SUPPORTED}`);

    fail(l, `cannot read this line. ${SUPPORTED}`);
  }

  if (open) fail(open.line, `class ${open.cls.id} is never closed. Add \`}\` after its members.`);

  if (space)
    fail(space.line, `namespace ${space.id} is never closed. Add \`}\` after its classes.`);

  if (classes.size === 0) fail(header, "the class diagram has no classes.");

  for (const n of namespaces)
    if (n.classes.length === 0)
      fail(
        n.line,
        `namespace ${JSON.stringify(n.id)} has no classes; svjeez cannot draw an empty group.`,
      );

  for (const n of namespaces)
    if (classes.has(n.id))
      fail(n.line, `${JSON.stringify(n.id)} names both a namespace and a class. Rename one.`);

  return {
    kind: "class",
    source: sourceOf(header),
    direction,
    classes: [...classes.values()],
    relations,
    notes,
    namespaces: namespaces.map(({ id, classes }) => ({ id, classes })),
  };
};

export interface ClassDrawOptions extends DiagramOptions {
  readonly direction?: MermaidDirection;
  readonly reveal?: Span;
}

export const drawClass = (
  doc: ClassDoc,
  options: ClassDrawOptions,
): ClassDiagram<string, string> => {
  const { direction, ...rest } = options;

  return classDiagram(
    {
      classes: Object.fromEntries(
        doc.classes.map((c) => [
          c.id,
          {
            label: c.label,
            annotation: c.annotation,
            attributes: c.attributes,
            methods: c.methods,
          },
        ]),
      ),
      relations: doc.relations,
      notes: doc.notes,
      namespaces: Object.fromEntries(
        doc.namespaces.map((n) => [n.id, { label: n.id, classes: n.classes }]),
      ),
    },
    { ...rest, direction: direction ?? doc.direction },
  );
};
