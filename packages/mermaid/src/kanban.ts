import {
  kanban,
  type DiagramOptions,
  type Kanban,
  type KanbanColumn,
  type KanbanPriority,
} from "@svjeez/diagrams";
import type { Span } from "svjeez";
import { clean, fail, sourceOf, unquote, type Line } from "./errors.ts";
import type { Place } from "./types.ts";

export interface MermaidKanbanCard {
  readonly id: string;
  readonly label: string;
  readonly ticket?: string;
  readonly assigned?: string;
  readonly priority?: KanbanPriority;
  readonly source: Place;
}

export interface MermaidKanbanColumn {
  readonly id: string;
  readonly label: string;
  readonly cards: readonly MermaidKanbanCard[];
  readonly source: Place;
}

export interface KanbanDoc {
  readonly kind: "kanban";
  readonly source: Place;
  readonly columns: readonly MermaidKanbanColumn[];
}

const SUPPORTED =
  "Supported: columns at the first indentation, cards indented under them, each written `id[Text]`, `[Text]` or plain text, optionally followed by `@{ assigned: name, ticket: ID, priority: High }` (priority is Very High, High, Medium, Low or Very Low).";

const PRIORITIES: readonly KanbanPriority[] = ["very high", "high", "medium", "low", "very low"];
const KEYS = ["assigned", "ticket", "priority"];

const UNSUPPORTED = new Map([
  ["icon", "svjeez draws text only"],
  ["label", "write the text in the brackets instead"],
  ["shape", "svjeez draws every card the same way"],
]);

const BRACKETED = /^([^\s[\]@]*)\[(.*?)\](?:\s*@\{(.*)\})?$/;
const PLAIN = /^(.*?)(?:\s*@\{(.*)\})?$/;

const entries = (l: Line, text: string): [string, string][] => {
  const parts: string[] = [];
  let at = "";
  let quote: string | undefined;

  for (const c of text) {
    if (quote === undefined && (c === '"' || c === "'")) quote = c;
    else if (c === quote) quote = undefined;

    if (c === "," && quote === undefined) {
      parts.push(at);
      at = "";
    } else at += c;
  }

  if (quote !== undefined) fail(l, `a quote is never closed in the metadata. ${SUPPORTED}`);
  parts.push(at);

  return parts.flatMap((p): [string, string][] => {
    if (p.trim() === "") return [];
    const m = /^\s*(\w+)\s*:\s*(.*?)\s*$/.exec(p);

    if (!m) return fail(l, `cannot read the metadata ${JSON.stringify(p.trim())}. ${SUPPORTED}`);
    const key = m[1]!;
    const why = UNSUPPORTED.get(key);

    if (why) return fail(l, `${key} is not supported: ${why}. ${SUPPORTED}`);

    if (!KEYS.includes(key)) return fail(l, `unknown metadata ${key}. ${SUPPORTED}`);

    return [[key, clean(unquote(m[2]!.replace(/^'(.*)'$/, "$1")))]];
  });
};

interface Open {
  readonly indent: number;
  readonly id: string;
  readonly label: string;
  readonly source: Place;
  readonly cards: MermaidKanbanCard[];
}

export const parseKanban = (header: Line, body: readonly Line[]): KanbanDoc => {
  if (header.text !== "kanban") return fail(header, "write just `kanban` on the first line.");

  if (body.length === 0) return fail(header, `the board has no columns. ${SUPPORTED}`);

  const columns: Open[] = [];
  const used = new Set<string>();
  const explicit = new Set<string>();
  const first = body[0]!.indent ?? 0;

  const idOf = (l: Line, id: string, label: string): string => {
    if (id !== "") {
      if (explicit.has(id))
        fail(l, `the id ${JSON.stringify(id)} is already used. Give it another.`);
      explicit.add(id);
    }

    const base = id === "" ? label : id;
    let unique = base;

    for (let n = 2; used.has(unique); n++) unique = `${base}#${n}`;
    used.add(unique);

    return unique;
  };

  for (const l of body) {
    if (l.text.startsWith("::icon"))
      return fail(l, "icons are not supported: svjeez draws text only. Delete the ::icon line.");

    if (l.text.startsWith(":::") || /\S:::\S/.test(l.text))
      return fail(l, "styling classes (:::name) are not supported. Delete the class.");

    const indent = l.indent ?? 0;

    if (indent < first)
      return fail(
        l,
        `this line is indented less than the first column, so it is neither a column nor a card. ${SUPPORTED}`,
      );

    const m = BRACKETED.exec(l.text) ?? PLAIN.exec(l.text)!;
    const bracketed = BRACKETED.test(l.text);
    const [, id, text, meta] = bracketed ? m : [m[0], "", m[1], m[2]];
    const label = clean(unquote(text!.replace(/^`|`$/g, "")));

    if (label === "") return fail(l, `a column or card needs some text. ${SUPPORTED}`);
    const unique = idOf(l, id!, label);

    if (indent === first) {
      columns.push({ indent, id: unique, label, source: sourceOf(l), cards: [] });

      if (meta !== undefined) fail(l, "a column has no metadata. Put it on a card.");
      continue;
    }

    const fields = new Map(meta === undefined ? [] : entries(l, meta));
    const priority = fields.get("priority")?.toLowerCase();

    // SAFETY: the cast only feeds the membership test that rejects anything else.
    if (priority !== undefined && !PRIORITIES.includes(priority as KanbanPriority))
      fail(
        l,
        `priority ${JSON.stringify(fields.get("priority"))} is not one of Very High, High, Medium, Low, Very Low.`,
      );
    const ticket = fields.get("ticket");
    const assigned = fields.get("assigned");

    columns.at(-1)!.cards.push({
      id: unique,
      label,
      ...(ticket && { ticket }),
      ...(assigned && { assigned }),
      // SAFETY: checked against PRIORITIES above.
      ...(priority && { priority: priority as KanbanPriority }),
      source: sourceOf(l),
    });
  }

  return {
    kind: "kanban",
    source: sourceOf(header),
    columns: columns.map((c) => ({ id: c.id, label: c.label, cards: c.cards, source: c.source })),
  };
};

export const drawKanban = (
  doc: KanbanDoc,
  options: DiagramOptions & { readonly reveal?: Span },
): Kanban<string> =>
  kanban(
    {
      columns: doc.columns.map((c): KanbanColumn => ({
        id: c.id,
        label: c.label,
        cards: c.cards.map((k) => ({
          id: k.id,
          label: k.label,
          ...(k.ticket && { ticket: k.ticket }),
          ...(k.assigned && { assigned: k.assigned }),
          ...(k.priority && { priority: k.priority }),
        })),
      })),
    },
    options,
  );
